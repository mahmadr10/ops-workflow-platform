import nodemailer from 'nodemailer';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { NotificationChannel } from '@prisma/client';
import { broadcastNotification } from '../lib/realtime';

/**
 * Notification engine. Adapter per channel. Every send is persisted to the Notification table
 * (PENDING -> SENT/FAILED) so delivery is auditable, independent of whether the external
 * channel is actually configured in this environment.
 */

async function sendWebhook(url: string, payload: Record<string, unknown>) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Webhook responded ${res.status}`);
}

async function sendSlack(text: string) {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) throw new Error('SLACK_WEBHOOK_URL not configured');
  await sendWebhook(url, { text });
}

async function sendDiscord(text: string) {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) throw new Error('DISCORD_WEBHOOK_URL not configured');
  await sendWebhook(url, { content: text });
}

async function sendTeams(text: string) {
  const url = process.env.TEAMS_WEBHOOK_URL;
  if (!url) throw new Error('TEAMS_WEBHOOK_URL not configured');
  await sendWebhook(url, { text });
}

async function sendGenericWebhook(subject: string, message: string, meta: Record<string, unknown>) {
  const url = process.env.GENERIC_WEBHOOK_URL;
  if (!url) throw new Error('GENERIC_WEBHOOK_URL not configured');
  await sendWebhook(url, { subject, message, ...meta });
}

let mailer: nodemailer.Transporter | null = null;
function getMailer() {
  if (mailer) return mailer;
  if (!process.env.SMTP_HOST) return null;
  mailer = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  return mailer;
}

async function sendEmail(to: string, subject: string, message: string) {
  const transport = getMailer();
  if (!transport) throw new Error('SMTP not configured');
  await transport.sendMail({ from: process.env.SMTP_FROM || 'ops-platform@example.com', to, subject, text: message });
}

interface DispatchParams {
  channel: NotificationChannel;
  subject: string;
  message: string;
  userId?: string;
  userEmail?: string;
  itemId?: string;
}

export const notificationService = {
  async dispatch(params: DispatchParams) {
    const record = await prisma.notification.create({
      data: {
        channel: params.channel,
        subject: params.subject,
        message: params.message,
        userId: params.userId,
        itemId: params.itemId,
        status: 'PENDING',
      },
    });

    try {
      switch (params.channel) {
        case 'SLACK':
          await sendSlack(`*${params.subject}*\n${params.message}`);
          break;
        case 'DISCORD':
          await sendDiscord(`**${params.subject}**\n${params.message}`);
          break;
        case 'TEAMS':
          await sendTeams(`${params.subject}\n${params.message}`);
          break;
        case 'WEBHOOK':
          await sendGenericWebhook(params.subject, params.message, { itemId: params.itemId });
          break;
        case 'EMAIL':
          if (!params.userEmail) throw new Error('No recipient email');
          await sendEmail(params.userEmail, params.subject, params.message);
          break;
      }
      await prisma.notification.update({ where: { id: record.id }, data: { status: 'SENT', sentAt: new Date() } });
      logger.info({ channel: params.channel, subject: params.subject }, 'notification_sent');
    } catch (err) {
      const error = err instanceof Error ? err.message : 'unknown error';
      await prisma.notification.update({ where: { id: record.id }, data: { status: 'FAILED', error } });
      logger.warn({ channel: params.channel, error }, 'notification_failed_channel_not_configured_or_unreachable');
    }
    if (params.userId) broadcastNotification(params.userId);
    return record;
  },
};
