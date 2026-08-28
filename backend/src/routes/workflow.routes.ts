import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { asyncHandler, ApiError } from '../middleware/errorHandler';
import { broadcastWorkflowsChanged } from '../lib/realtime';

export const workflowRouter = Router();
workflowRouter.use(requireAuth);

// GET /api/workflows - list all workflows with their dynamic statuses
workflowRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const workflows = await prisma.workflow.findMany({
      include: { statuses: { orderBy: { order: 'asc' } }, _count: { select: { items: true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json(workflows);
  })
);

workflowRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const workflow = await prisma.workflow.findUnique({
      where: { id: req.params.id },
      include: { statuses: { orderBy: { order: 'asc' } } },
    });
    if (!workflow) throw new ApiError(404, 'Workflow not found');
    res.json(workflow);
  })
);

const statusInput = z.object({
  name: z.string().min(1).max(60),
  color: z.string().optional(),
  isTerminal: z.boolean().optional(),
  isSuccess: z.boolean().optional(),
});

const createWorkflowSchema = z.object({
  name: z.string().min(2).max(100),
  key: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/, 'key must be lowercase alphanumeric with dashes'),
  description: z.string().max(500).optional(),
  statuses: z.array(statusInput).min(2, 'A workflow needs at least 2 statuses'),
});

// POST /api/workflows - Admin/Manager define a brand new workflow with fully custom statuses.
// This is the "no hardcoded statuses" requirement: statuses are rows in workflow_statuses.
workflowRouter.post(
  '/',
  requireRole('ADMIN', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const data = createWorkflowSchema.parse(req.body);
    const existing = await prisma.workflow.findUnique({ where: { key: data.key } });
    if (existing) throw new ApiError(409, 'Workflow key already exists');

    const workflow = await prisma.workflow.create({
      data: {
        name: data.name,
        key: data.key,
        description: data.description,
        createdById: req.user!.id,
        statuses: {
          create: data.statuses.map((s, index) => ({
            name: s.name,
            order: index,
            color: s.color || '#6366f1',
            isTerminal: s.isTerminal || false,
            isSuccess: s.isSuccess || false,
          })),
        },
      },
      include: { statuses: { orderBy: { order: 'asc' } } },
    });
    broadcastWorkflowsChanged();
    res.status(201).json(workflow);
  })
);

const addStatusSchema = statusInput;

// POST /api/workflows/:id/statuses - append a new status to an existing workflow (still dynamic)
workflowRouter.post(
  '/:id/statuses',
  requireRole('ADMIN', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const data = addStatusSchema.parse(req.body);
    const maxOrder = await prisma.workflowStatus.aggregate({
      where: { workflowId: req.params.id },
      _max: { order: true },
    });
    const status = await prisma.workflowStatus.create({
      data: {
        workflowId: req.params.id,
        name: data.name,
        order: (maxOrder._max.order ?? -1) + 1,
        color: data.color || '#6366f1',
        isTerminal: data.isTerminal || false,
        isSuccess: data.isSuccess || false,
      },
    });
    broadcastWorkflowsChanged();
    res.status(201).json(status);
  })
);

// DELETE /api/workflows/:id
workflowRouter.delete(
  '/:id',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    await prisma.workflow.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);
