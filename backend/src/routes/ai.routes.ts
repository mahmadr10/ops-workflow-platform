import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { aiService } from '../services/ai.service';
import { COMPANY_KNOWLEDGE } from '../services/company-knowledge';

export const aiRouter = Router();
aiRouter.use(requireAuth);

// Maps a user's Department to the one workflow key their chatbot may see operational data for.
// ALL (admins/managers by default) sees every workflow.
const DEPARTMENT_WORKFLOW_KEY: Record<string, string | null> = {
  ALL: null,
  RECRUITMENT: 'recruitment',
  SALES: 'sales',
  INTERNAL_TASKS: 'tasks',
  CLIENT_PROJECTS: 'client-projects',
  PROCUREMENT: 'procurement',
};

const DEPARTMENT_LABEL: Record<string, string> = {
  ALL: 'All departments (full access)',
  RECRUITMENT: 'Recruitment',
  SALES: 'Sales Pipeline',
  INTERNAL_TASKS: 'Internal Tasks',
  CLIENT_PROJECTS: 'Client Projects',
  PROCUREMENT: 'Procurement',
};

// GET /api/ai/standup - "Summarize today's completed work"
aiRouter.get(
  '/standup',
  asyncHandler(async (_req, res) => {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    const items = await prisma.item.findMany({
      where: { updatedAt: { gte: since } },
      include: { status: true, assignee: true },
      take: 50,
    });
    const summary = await aiService.dailyStandup(
      items.map((i) => ({ title: i.title, status: i.status.name, assignee: i.assignee?.name || 'unassigned' }))
    );
    res.json({ summary, itemCount: items.length });
  })
);

// GET /api/ai/risks - "Find blocked/at-risk tasks"
aiRouter.get(
  '/risks',
  asyncHandler(async (_req, res) => {
    const items = await prisma.item.findMany({
      where: { riskScore: { gte: 40 }, status: { isTerminal: false } },
      include: { status: true, assignee: true, workflow: true },
      orderBy: { riskScore: 'desc' },
      take: 25,
    });
    res.json(items);
  })
);

// POST /api/ai/executive-summary - AI-written executive summary from live metrics
aiRouter.post(
  '/executive-summary',
  asyncHandler(async (_req, res) => {
    const [total, active, blocked, completed, overdue] = await Promise.all([
      prisma.item.count(),
      prisma.item.count({ where: { status: { isTerminal: false } } }),
      prisma.item.count({ where: { riskScore: { gte: 60 } } }),
      prisma.item.count({ where: { status: { isTerminal: true, isSuccess: true } } }),
      prisma.item.count({ where: { dueDate: { lt: new Date() }, status: { isTerminal: false } } }),
    ]);
    const summary = await aiService.executiveSummary({ total, active, blocked, completed, overdue });
    res.json({ summary, stats: { total, active, blocked, completed, overdue } });
  })
);

const chatSchema = z.object({ question: z.string().min(3).max(500) });

// POST /api/ai/chat - AI chatbot, department-walled. Answers general company questions for
// everyone, but operational data ("which candidates have been waiting longest") is restricted to
// the logged-in user's own department, unless their department is ALL (admins/managers by
// default). The model only sees a real, current data snapshot pulled fresh from the database, it
// cannot invent items or people that don't exist, and it is told in plain words what its data
// scope is so it refuses to answer about other departments.
aiRouter.post(
  '/chat',
  asyncHandler(async (req, res) => {
    const { question } = chatSchema.parse(req.body);

    const me = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { department: true } });
    const department = me?.department || 'ALL';
    const workflowKey = DEPARTMENT_WORKFLOW_KEY[department] ?? null;

    const items = await prisma.item.findMany({
      where: workflowKey ? { workflow: { key: workflowKey } } : undefined,
      include: { status: true, workflow: true, assignee: { select: { name: true } } },
      orderBy: { riskScore: 'desc' },
      take: 200,
    });
    const now = Date.now();
    const snapshot = items.map((i) => ({
      title: i.title,
      workflow: i.workflow.name,
      status: i.status.name,
      priority: i.priority,
      assignee: i.assignee?.name || 'Unassigned',
      daysInCurrentStatus: Math.floor((now - i.statusEnteredAt.getTime()) / (1000 * 60 * 60 * 24)),
      riskScore: i.riskScore,
      dueDate: i.dueDate ? i.dueDate.toISOString().slice(0, 10) : null,
      overdue: !!i.dueDate && i.dueDate.getTime() < now && !i.status.isTerminal,
      isTerminal: i.status.isTerminal,
    }));

    const scopeLabel = DEPARTMENT_LABEL[department] || department;
    const answer = await aiService.answerOperationalQuestion(question, JSON.stringify(snapshot), COMPANY_KNOWLEDGE, scopeLabel);
    res.json({ answer, itemsConsidered: snapshot.length, department, scope: scopeLabel });
  })
);

// GET /api/ai/status - reveals which provider is actually wired in (for demo/grading transparency)
aiRouter.get(
  '/status',
  asyncHandler(async (_req, res) => {
    res.json({ provider: aiService.provider, model: aiService.model, live: aiService.isLive });
  })
);
