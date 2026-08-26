import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

// GET /api/dashboard - executive dashboard cards + chart datasets
dashboardRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const now = new Date();

    const [total, active, blocked, completed, overdue, byStatus, items, workflows] = await Promise.all([
      prisma.item.count(),
      prisma.item.count({ where: { status: { isTerminal: false } } }),
      prisma.item.count({ where: { riskScore: { gte: 60 } } }),
      prisma.item.count({ where: { status: { isTerminal: true, isSuccess: true } } }),
      prisma.item.count({ where: { dueDate: { lt: now }, status: { isTerminal: false } } }),
      prisma.workflowStatus.findMany({
        include: { _count: { select: { items: true } }, workflow: { select: { name: true } } },
        orderBy: { order: 'asc' },
      }),
      prisma.item.findMany({ include: { status: true, assignee: true, activities: true } }),
      prisma.workflow.findMany({ include: { statuses: true } }),
    ]);

    const avgRisk = items.length ? Math.round(items.reduce((s, i) => s + i.riskScore, 0) / items.length) : 0;

    // Completion trend: completed items per day, last 14 days
    const trendMap = new Map<string, number>();
    for (let d = 13; d >= 0; d--) {
      const day = new Date(now);
      day.setDate(day.getDate() - d);
      trendMap.set(day.toISOString().slice(0, 10), 0);
    }
    for (const item of items) {
      if (item.status.isTerminal) {
        const key = item.updatedAt.toISOString().slice(0, 10);
        if (trendMap.has(key)) trendMap.set(key, (trendMap.get(key) || 0) + 1);
      }
    }
    const completionTrend = Array.from(trendMap.entries()).map(([date, count]) => ({ date, count }));

    // Assignee performance: completed count per assignee
    const perfMap = new Map<string, number>();
    for (const item of items) {
      if (item.status.isTerminal && item.assignee) {
        perfMap.set(item.assignee.name, (perfMap.get(item.assignee.name) || 0) + 1);
      }
    }
    const assigneePerformance = Array.from(perfMap.entries()).map(([name, count]) => ({ name, count }));

    // Average cycle time per workflow (creation -> terminal status), in days
    const cycleTimes: { workflow: string; avgDays: number }[] = [];
    for (const wf of workflows) {
      const wfItems = items.filter((i) => i.workflowId === wf.id && i.status.isTerminal);
      if (!wfItems.length) {
        cycleTimes.push({ workflow: wf.name, avgDays: 0 });
        continue;
      }
      const totalDays = wfItems.reduce((s, i) => s + (i.updatedAt.getTime() - i.createdAt.getTime()) / (1000 * 60 * 60 * 24), 0);
      cycleTimes.push({ workflow: wf.name, avgDays: Math.round((totalDays / wfItems.length) * 10) / 10 });
    }

    // Workflow bottlenecks: status with the highest average time-in-status among active items
    const bottlenecks = byStatus
      .filter((s) => s._count.items > 0)
      .map((s) => ({ status: s.name, workflow: s.workflow.name, itemCount: s._count.items }))
      .sort((a, b) => b.itemCount - a.itemCount)
      .slice(0, 8);

    res.json({
      cards: { total, active, blocked, completed, overdue, avgRiskScore: avgRisk },
      statusDistribution: byStatus.map((s) => ({ status: s.name, workflow: s.workflow.name, count: s._count.items, color: s.color })),
      completionTrend,
      cycleTimes,
      assigneePerformance,
      bottlenecks,
    });
  })
);
