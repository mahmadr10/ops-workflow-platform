import cron from 'node-cron';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { notificationService } from './notification.service';
import { aiService } from './ai.service';
import { logActivity } from '../utils/activityLogger';

/**
 * Reminder Automation Engine.
 * Rule shape: IF item.status == X AND daysInStatus >= N THEN send reminder on configured channels.
 * Also doubles as the hourly "AI agent monitors workflows" bonus: recomputes risk scores and
 * flags idle/blocked items with an AI-suggested next action.
 */
async function evaluateReminderRules() {
  const rules = await prisma.reminderRule.findMany({ where: { active: true }, include: { status: true, workflow: true } });
  const now = Date.now();

  for (const rule of rules) {
    const items = await prisma.item.findMany({
      where: { statusId: rule.statusId },
      include: { assignee: true },
    });

    for (const item of items) {
      const daysInStatus = Math.floor((now - item.statusEnteredAt.getTime()) / (1000 * 60 * 60 * 24));
      if (daysInStatus < rule.daysInStatus) continue;

      for (const channel of rule.channels) {
        await notificationService.dispatch({
          channel,
          subject: `Reminder: "${item.title}" stuck in ${rule.status.name}`,
          message: rule.message,
          userId: item.assigneeId ?? undefined,
          userEmail: item.assignee?.email,
          itemId: item.id,
        });
      }

      await logActivity({
        itemId: item.id,
        action: 'REMINDER_SENT',
        toValue: rule.status.name,
        meta: { rule: rule.id, daysInStatus },
      });
    }
  }
}

async function refreshRiskScores() {
  const items = await prisma.item.findMany({ include: { status: true } });
  const now = Date.now();

  for (const item of items) {
    if (item.status.isTerminal) continue;
    const daysInStatus = Math.floor((now - item.statusEnteredAt.getTime()) / (1000 * 60 * 60 * 24));
    const isOverdue = !!item.dueDate && item.dueDate.getTime() < now;
    const riskScore = aiService.computeRiskScore(daysInStatus, item.priority, isOverdue);

    let aiNextAction = item.aiNextAction;
    if (riskScore >= 60 && daysInStatus >= 2) {
      aiNextAction = await aiService.suggestNextAction(item.title, item.status.name, daysInStatus, item.description || '');
    }

    await prisma.item.update({ where: { id: item.id }, data: { riskScore, aiNextAction } });
  }
  logger.info({ count: items.length }, 'risk_scores_refreshed');
}

export function startReminderEngine() {
  // Every hour: the AI monitoring agent bonus requirement.
  cron.schedule('0 * * * *', async () => {
    logger.info('reminder_engine_tick_started');
    try {
      await evaluateReminderRules();
      await refreshRiskScores();
    } catch (err) {
      logger.error({ err }, 'reminder_engine_tick_failed');
    }
  });
  logger.info('reminder_engine_scheduled_hourly');
}

export const reminderService = { evaluateReminderRules, refreshRiskScores };
