import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, blockReadonlyWrites } from '../middleware/auth';
import { asyncHandler, ApiError } from '../middleware/errorHandler';
import { logActivity } from '../utils/activityLogger';
import { aiService } from '../services/ai.service';
import { upload } from '../lib/upload';
import { broadcastItemsChanged } from '../lib/realtime';

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
    broadcastItemsChanged(item.workflowId, 'item_created');
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
    broadcastItemsChanged(item.workflowId, 'item_updated');
    res.json(item);
  })
);

const statusChangeSchema = z.object({ statusId: z.string().uuid() });

// PATCH /api/items/:id/status - drives the Kanban drag-and-drop. Logs an audit entry, generates
// an AI transition note automatically, and pushes a live update to every other viewer of this
// workflow so their board refreshes instantly too, not just the browser that dragged the card.
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
    broadcastItemsChanged(item.workflowId, 'status_changed');

    // Auto Notes: AI-generated professional note after every status transition (fire-and-forget,
    // never blocks the drag-and-drop response).
    aiService
      .generateTransitionNote(item.title, before.status.name, newStatus.name)
      .then(async (note) => {
        await prisma.comment.create({ data: { itemId: item.id, authorId: req.user!.id, body: note, aiGenerated: true } });
        broadcastItemsChanged(item.workflowId, 'ai_note_added');
      })
      .catch(() => undefined);

    res.json(item);
  })
);

// DELETE /api/items/:id
itemRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const item = await prisma.item.findUnique({ where: { id: req.params.id } });
    if (!item) throw new ApiError(404, 'Item not found');
    await prisma.item.delete({ where: { id: req.params.id } });
    broadcastItemsChanged(item.workflowId, 'item_deleted');
    res.status(204).send();
  })
);

// ---- Comments ----
const commentSchema = z.object({ body: z.string().min(1).max(2000) });

itemRouter.post(
  '/:id/comments',
  asyncHandler(async (req, res) => {
    const { body } = commentSchema.parse(req.body);
    const item = await prisma.item.findUnique({ where: { id: req.params.id } });
    if (!item) throw new ApiError(404, 'Item not found');
    const comment = await prisma.comment.create({
      data: { itemId: req.params.id, authorId: req.user!.id, body },
      include: { author: { select: { id: true, name: true } } },
    });
    await logActivity({ itemId: req.params.id, actorId: req.user!.id, action: 'COMMENT_ADDED' });
    broadcastItemsChanged(item.workflowId, 'comment_added');
    res.status(201).json(comment);
  })
);

// ---- Attachments: real file uploads (multipart), stored on disk and served back statically.
// Swappable for S3/MinIO later without touching the API shape (see lib/upload.ts).
itemRouter.post(
  '/:id/attachments',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const item = await prisma.item.findUnique({ where: { id: req.params.id } });
    if (!item) throw new ApiError(404, 'Item not found');
    if (!req.file) throw new ApiError(400, 'No file uploaded (expected multipart field "file")');

    const attachment = await prisma.attachment.create({
      data: {
        itemId: req.params.id,
        uploadedById: req.user!.id,
        filename: req.file.originalname,
        url: `/uploads/${req.file.filename}`,
        sizeBytes: req.file.size,
      },
    });
    await logActivity({ itemId: req.params.id, actorId: req.user!.id, action: 'ATTACHMENT_ADDED', toValue: attachment.filename });
    broadcastItemsChanged(item.workflowId, 'attachment_added');
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
