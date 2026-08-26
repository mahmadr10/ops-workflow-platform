import 'dotenv/config';
import { createApp } from './app';
import { logger } from './lib/logger';
import { startReminderEngine } from './services/reminder.service';

const PORT = Number(process.env.PORT || 4000);
const app = createApp();

app.listen(PORT, () => {
  logger.info(`Ops Platform API listening on port ${PORT}`);
  logger.info(`Swagger docs: http://localhost:${PORT}/api/docs`);
  startReminderEngine();
});

process.on('unhandledRejection', (reason) => logger.error({ reason }, 'unhandled_rejection'));
process.on('uncaughtException', (err) => logger.error({ err }, 'uncaught_exception'));
