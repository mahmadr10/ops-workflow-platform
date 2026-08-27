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
