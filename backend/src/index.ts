import 'dotenv/config';
import http from 'http';
import { createApp } from './app';
import { logger } from './lib/logger';
import { startReminderEngine } from './services/reminder.service';
import { initRealtime } from './lib/realtime';

const PORT = Number(process.env.PORT || 4000);
const app = createApp();
const httpServer = http.createServer(app);

initRealtime(httpServer);

httpServer.listen(PORT, () => {
  logger.info(`Ops Platform API listening on port ${PORT}`);
  logger.info(`Swagger docs: http://localhost:${PORT}/api/docs`);
  logger.info(`WebSocket real-time updates ready`);
  startReminderEngine();
});

process.on('unhandledRejection', (reason) => logger.error({ reason }, 'unhandled_rejection'));
process.on('uncaughtException', (err) => logger.error({ err }, 'uncaught_exception'));
