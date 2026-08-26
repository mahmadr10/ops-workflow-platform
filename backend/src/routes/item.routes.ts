import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, blockReadonlyWrites } from '../middleware/auth';
import { asyncHandler, ApiError } from '../middleware/errorHandler';
import { logActivity } from '../utils/activityLogger';
import { aiService } from '../services/ai.service';

export const itemRouter = Router();
itemRouter.use(requireAuth, blockReadonlyWrites);

const itemInclude = {
  status: true,
  workflow: true,
  assignee: { select: { id: true, name: true, email: true } },
  createdBy: { select: { id: true, name: true, email: true } },
  labels: { include: { label: true } },
  _count: { select: { comments: true, attachments: true } },
};

// GET /api/items - powers the Kanban board (?workflowId=) and advanced search (text, assignee,
// priority, labels, workflow, date, status - all combinable as query params)
itemRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { workflowId, statusId, assigneeId, priority, labelId, q, dueBefore, dueAfter } = req.query as Record<string, string>;

    const where: any = {};
    if (workflowId) where.workflowId = workflowId;
    if (statusId) where.statusId = statusId;
    if (assigneeId) where.assigneeId = assigneeId;
    if (priority) where.priority = priority;
    if (labelId) where.labels = { some: { labelId } };
    if (q) where.OR = [{ title: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }];
    if (dueBefore || dueAfter) {
      where.dueDate = {};
      if (dueBefore) where.dueDate.lte = new Date(dueBefore);
      if (dueAfter) where.dueDate.gte = new Date(dueAfter);
    }

    const items = await prisma.item.findMany({ where, include: itemInclude, orderBy: { updatedAt: 'desc' } });
    res.json(items);
  })
);

itemRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const item = await prisma.item.findUnique({
      where: { id: req.params.id },
      include: {
        ...itemInclude,
        comments: { include: { author: { select: { id: true, name: true } } }, orderBy: { createdAt: 'asc' } },
        attachments: true,
        activities: { include: { actor: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!item) throw new ApiError(404, 'Item not found');
    res.json(item);
  })
);

const createItemSchema = z.object({
  workflowId: z.string().uuid(),
  statusId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  assigneeId: z.string().uuid().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  labelIds: z.array(z.string().uuid()).optional(),
  customFields: z.record(z.any()).optional(),
});

// POST /api/items
itemRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = createItemSchema.parse(req.body);
    const item = await prisma.item.create({
      data: {
        workflowId: data.workflowId,
        statusId: data.statusId,
        title: data.title,
        description: data.description,
        priority: data.priority || 'MEDIUM',
        assigneeId: data.assigneeId || null,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        customFields: data.customFields || {},
        createdById: req.user!.id,
        labels: data.labelIds ? { create: data.labelIds.map((labelId) => ({ labelId })) } : undefined,
      },
      include: itemInclude,
    });
    await logActivity({ itemId: item.id, actorId: req.user!.id, action: 'CREATED', toValue: item.title });
    res.status(201).json(item);
  })
);

const updateItemSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  assigneeId: z.string().uuid().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  customFields: z.record(z.any()).optional(),
});

// PATCH /api/items/:id
itemRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = updateItemSchema.parse(req.body);
    const before = await prisma.item.findUnique({ where: { id: req.params.id } });
    if (!before) throw new ApiError(404, 'Item not found');

    const item = await prisma.item.update({
      where: { id: req.params.id },
      data: {
        ...data,
        dueDate: data.dueDate === undefined ? undefined : data.dueDate ? new Date(data.dueDate) : null,
      },
      include: itemInclude,
    });

    if (data.priority && data.priority !== before.priority) {
      await logActivity({ itemId: item.id, actorId: req.user!.id, action: 'PRIORITY_CHANGED', fromValue: before.priority, toValue: data.priority });
    }
    if (data.assigneeId !== undefined && data.assigneeId !== before.assigneeId) {
      await logActivity({ itemId: item.id, actorId: req.user!.id, action: 'ASSIGNEE_CHANGED', fromValue: before.assigneeId, toValue: data.assigneeId || 'unassigned' });
    }
    if (data.title || data.description || data.dueDate !== undefined || data.customFields) {
      await logActivity({ itemId: item.id, actorId: req.user!.id, action: 'FIELDS_UPDATED', meta: data as any });
    }
    res.json(item);
  })
);

const statusChangeSchema = z.object({ statusId: z.string().uuid() });

// PATCH /api/items/:id/status - drives the Kanban drag-and-drop. Logs an audit entry and
// generates an AI transition note automatically.
itemRouter.patch(
  '/:id/status',
  asyncHandler(async (req, res) => {
    const { statusId } = statusChangeSchema.parse(req.body);
    const before = await prisma.item.findUnique({ where: { id: req.params.id }, include: { status: true } });
    if (!before) throw new ApiError(404, 'Item not found');

    const newStatus = await prisma.workflowStatus.findUnique({ where: { id: statusId } });
    if (!newStatus || newStatus.workflowId !== before.workflowId) {
      throw new ApiError(400, 'Status does not belong to this item workflow');
    }

    const item = await prisma.item.update({
      where: { id: req.params.id },
      data: { statusId, statusEnteredAt: new Date() },
      include: itemInclude,
    });

    await logActivity({
      itemId: item.id,
      actorId: req.user!.id,
      action: 'STATUS_CHANGED',
      fromValue: before.status.name,
      toValue: newStatus.name,
    });

    // Auto Notes: AI-generated professional note after every status transition (fire-and-forget,
    // never blocks the drag-and-drop response).
    aiService
      .generateTransitionNote(item.title, before.status.name, newStatus.name)
      .then((note) =>
        prisma.comment.create({ data: { itemId: item.id, authorId: req.user!.id, body: note, aiGenerated: true } })
      )
      .catch(() => undefined);

    res.json(item);
  })
);

// DELETE /api/items/:id
itemRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await prisma.item.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);

// ---- Comments ----
const commentSchema = z.object({ body: z.string().min(1).max(2000) });

itemRouter.post(
  '/:id/comments',
  asyncHandler(async (req, res) => {
    const { body } = commentSchema.parse(req.body);
    const comment = await prisma.comment.create({
      data: { itemId: req.params.id, authorId: req.user!.id, body },
      include: { author: { select: { id: true, name: true } } },
    });
    await logActivity({ itemId: req.params.id, actorId: req.user!.id, action: 'COMMENT_ADDED' });
    res.status(201).json(comment);
  })
);

// ---- Attachments (metadata; file bytes handled by the storage layer / pre-signed URL in prod) ----
const attachmentSchema = z.object({ filename: z.string().min(1), url: z.string().min(1), sizeBytes: z.number().int().nonnegative() });

itemRouter.post(
  '/:id/attachments',
  asyncHandler(async (req, res) => {
    const data = attachmentSchema.parse(req.body);
    const attachment = await prisma.attachment.create({
      data: { itemId: req.params.id, uploadedById: req.user!.id, ...data },
    });
    await logActivity({ itemId: req.params.id, actorId: req.user!.id, action: 'ATTACHMENT_ADDED', toValue: data.filename });
    res.status(201).json(attachment);
  })
);

// ---- AI: per-item summary ----
itemRouter.get(
  '/:id/ai-summary',
  asyncHandler(async (req, res) => {
    const item = await prisma.item.findUnique({
      where: { id: req.params.id },
      include: { activities: { orderBy: { createdAt: 'asc' } }, status: true },
    });
    if (!item) throw new ApiError(404, 'Item not found');
    const timeline = item.activities.map((a) => `${a.action} (${a.fromValue ?? ''} -> ${a.toValue ?? ''}) at ${a.createdAt.toISOString()}`);
    const summary = await aiService.summarizeHistory(item.title, timeline);
    await prisma.item.update({ where: { id: item.id }, data: { aiSummary: summary } });
    res.json({ summary });
  })
);
