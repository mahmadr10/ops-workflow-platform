import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler, ApiError } from '../middleware/errorHandler';
import { seedDemoData } from '../services/seed.service';

export const systemRouter = Router();

// POST /api/system/seed-demo-data
// One-time demo data loader for hosts with no shell access (e.g. Render's free tier).
// Requires the SEED_SECRET env var as a header, and refuses to run if any workflow already
// exists, so it can never be used to duplicate data or reseed a live database by accident.
systemRouter.post(
  '/seed-demo-data',
  asyncHandler(async (req, res) => {
    const configuredSecret = process.env.SEED_SECRET;
    if (!configuredSecret) {
      throw new ApiError(503, 'SEED_SECRET is not configured on this deployment');
    }
    if (req.headers['x-seed-secret'] !== configuredSecret) {
      throw new ApiError(401, 'Invalid seed secret');
    }

    const existing = await prisma.workflow.count();
    if (existing > 0) {
      return res.json({ seeded: false, message: 'Database already has data, refusing to reseed.' });
    }

    const result = await seedDemoData(prisma);
    res.json({ seeded: true, ...result });
  })
);

// POST /api/system/reset-demo-data
// Wipes every workflow/item/user (in FK-safe order) and reseeds the pristine demo dataset.
// Useful to restore the "stuck candidate" and other rehearsed demo scenarios to their original
// state after real usage/testing has moved things around, right before a live demo. Same
// SEED_SECRET guard as the seed endpoint, works identically on any host, no shell access needed.
systemRouter.post(
  '/reset-demo-data',
  asyncHandler(async (req, res) => {
    const configuredSecret = process.env.SEED_SECRET;
    if (!configuredSecret) {
      throw new ApiError(503, 'SEED_SECRET is not configured on this deployment');
    }
    if (req.headers['x-seed-secret'] !== configuredSecret) {
      throw new ApiError(401, 'Invalid seed secret');
    }

    await prisma.$transaction([
      prisma.notification.deleteMany(),
      prisma.activityLog.deleteMany(),
      prisma.itemLabel.deleteMany(),
      prisma.comment.deleteMany(),
      prisma.attachment.deleteMany(),
      prisma.item.deleteMany(),
      prisma.reminderRule.deleteMany(),
      prisma.workflowStatus.deleteMany(),
      prisma.workflow.deleteMany(),
      prisma.label.deleteMany(),
      prisma.user.deleteMany(),
    ]);

    const result = await seedDemoData(prisma);
    res.json({ reset: true, ...result });
  })
);
