import { prisma } from '../lib/prisma';

interface LogParams {
  itemId: string;
  actorId?: string;
  action: string;
  fromValue?: string | null;
  toValue?: string | null;
  meta?: Record<string, unknown>;
}

// Appends an immutable audit entry. Never call update/delete on ActivityLog anywhere in the app.
export async function logActivity(params: LogParams) {
  return prisma.activityLog.create({
    data: {
      itemId: params.itemId,
      actorId: params.actorId,
      action: params.action,
      fromValue: params.fromValue ?? null,
      toValue: params.toValue ?? null,
      meta: (params.meta ?? {}) as any,
    },
  });
}
