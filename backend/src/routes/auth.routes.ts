import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { signToken, requireAuth } from '../middleware/auth';
import { asyncHandler, ApiError } from '../middleware/errorHandler';

export const authRouter = Router();

const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['ADMIN', 'MANAGER', 'EMPLOYEE', 'READONLY']).optional(),
});

// POST /api/auth/register
authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const data = registerSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new ApiError(409, 'Email already registered');

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await prisma.user.create({
      data: { name: data.name, email: data.email, passwordHash, role: data.role || 'EMPLOYEE' },
    });

    const token = signToken({ id: user.id, email: user.email, role: user.role, name: user.name });
    res
      .status(201)
      .json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, department: user.department } });
  })
);

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

// POST /api/auth/login
authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const data = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user) throw new ApiError(401, 'Invalid email or password');

    const valid = await bcrypt.compare(data.password, user.passwordHash);
    if (!valid) throw new ApiError(401, 'Invalid email or password');

    const token = signToken({ id: user.id, email: user.email, role: user.role, name: user.name });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, department: user.department } });
  })
);

// GET /api/auth/me
authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: req.user });
  })
);
