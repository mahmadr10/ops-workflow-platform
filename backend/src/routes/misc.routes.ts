import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole, blockReadonlyWrites } from '../middleware/auth';
import { asyncHandler, ApiError } from '../middleware/errorHandler';
import { reminderService } from '../services/reminder.service';

// Small supporting routers: users list (for assignee pickers), labels, reminder rules, notifications log.

export const usersRouter = Router();
usersRouter.use(requireAuth, blockReadonlyWrites);
usersRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, department: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    res.json(users);
  })
);

const departmentEnum = z.enum(['ALL', 'RECRUITMENT', 'SALES', 'INTERNAL_TASKS', 'CLIENT_PROJECTS', 'PROCUREMENT']);

function generatePassword(): string {
  // Readable-ish random password: e.g. "k3f9-Qm2x-7hLp"
  return crypto.randomBytes(9).toString('base64url').match(/.{1,4}/g)!.join('-');
}

const createUserSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  role: z.enum(['ADMIN', 'MANAGER', 'EMPLOYEE', 'READONLY']),
  department: departmentEnum.optional(),
  password: z.string().min(8).max(72).optional(),
});

// POST /api/users - Admin creates a new team account directly (no self-service signup needed).
// If no password is given, a random one is generated and returned once in the response so the
// admin can hand it to the new user; it is never stored or shown again. `department` scopes what
// operational data this user's AI chatbot can see (ALL for admins/managers who oversee everything).
usersRouter.post(
  '/',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const data = createUserSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new ApiError(409, 'A user with this email already exists');

    const temporaryPassword = data.password || generatePassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);
    const user = await prisma.user.create({
      data: { name: data.name, email: data.email, role: data.role, department: data.department || 'ALL', passwordHash },
      select: { id: true, name: true, email: true, role: true, department: true, createdAt: true },
    });

    res.status(201).json({ user, temporaryPassword });
  })
);

const updateUserRoleSchema = z.object({ role: z.enum(['ADMIN', 'MANAGER', 'EMPLOYEE', 'READONLY']) });

// PATCH /api/users/:id/role - Admin changes an existing user's role
usersRouter.patch(
  '/:id/role',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const { role } = updateUserRoleSchema.parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { role },
      select: { id: true, name: true, email: true, role: true, department: true },
    });
    res.json(user);
  })
);

const updateDepartmentSchema = z.object({ department: departmentEnum });

// PATCH /api/users/:id/department - Admin changes which department's data this user's AI
// chatbot can see.
usersRouter.patch(
  '/:id/department',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const { department } = updateDepartmentSchema.parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { department },
      select: { id: true, name: true, email: true, role: true, department: true },
    });
    res.json(user);
  })
);

export const labelsRouter = Router();
labelsRouter.use(requireAuth, blockReadonlyWrites);
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
reminderRulesRouter.use(requireAuth, blockReadonlyWrites);
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
notificationsRouter.use(requireAuth, blockReadonlyWrites);

// GET /api/notifications - by default, only the notifications addressed to the logged-in user
// (this is what actually shows up in their bell icon). Admins/Managers can pass ?all=true to
// see the full delivery log across every user, for oversight.
notificationsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const wantsAll = req.query.all === 'true' && (req.user!.role === 'ADMIN' || req.user!.role === 'MANAGER');
    const where = wantsAll ? {} : { userId: req.user!.id };
    res.json(await prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100 }));
  })
);
