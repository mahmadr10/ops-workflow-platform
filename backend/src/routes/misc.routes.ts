import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { reminderService } from '../services/reminder.service';

// Small supporting routers: users list (for assignee pickers), labels, reminder rules, notifications log.

export const usersRouter = Router();
usersRouter.use(requireAuth);
usersRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({ select: { id: true, name: true, email: true, role: true } });
    res.json(users);
  })
);

export const labelsRouter = Router();
labelsRouter.use(requireAuth);
labelsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await prisma.label.findMany());
  })
);
const labelSchema = z.object({ name: z.string().min(1).max(40), color: z.string().optional() });
labelsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = labelSchema.parse(req.body);
    res.status(201).json(await prisma.label.create({ data: { name: data.name, color: data.color || '#94a3b8' } }));
  })
);

export const reminderRulesRouter = Router();
reminderRulesRouter.use(requireAuth);
reminderRulesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await prisma.reminderRule.findMany({ include: { status: true, workflow: true } }));
  })
);
const ruleSchema = z.object({
  workflowId: z.string().uuid(),
  statusId: z.string().uuid(),
  daysInStatus: z.number().int().min(0),
  message: z.string().min(1).max(500),
  channels: z.array(z.enum(['EMAIL', 'SLACK', 'DISCORD', 'TEAMS', 'WEBHOOK'])).min(1),
});
reminderRulesRouter.post(
  '/',
  requireRole('ADMIN', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const data = ruleSchema.parse(req.body);
    res.status(201).json(await prisma.reminderRule.create({ data }));
  })
);
// POST /api/reminder-rules/run-now - manually trigger the automation engine (useful for the demo)
reminderRulesRouter.post(
  '/run-now',
  requireRole('ADMIN', 'MANAGER'),
  asyncHandler(async (_req, res) => {
    await reminderService.evaluateReminderRules();
    await reminderService.refreshRiskScores();
    res.json({ ok: true, message: 'Reminder rules evaluated and risk scores refreshed' });
  })
);

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);
notificationsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await prisma.notification.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }));
  })
);
