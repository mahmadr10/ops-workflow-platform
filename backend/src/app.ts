import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path';
import { requestContext } from './middleware/requestContext';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { metricsMiddleware, registry } from './lib/metrics';
import { authRouter } from './routes/auth.routes';
import { workflowRouter } from './routes/workflow.routes';
import { itemRouter } from './routes/item.routes';
import { aiRouter } from './routes/ai.routes';
import { dashboardRouter } from './routes/dashboard.routes';
import { reportsRouter } from './routes/reports.routes';
import { usersRouter, labelsRouter, reminderRulesRouter, notificationsRouter } from './routes/misc.routes';
import { systemRouter } from './routes/system.routes';

export function createApp() {
  const app = express();

  // Security hardening
  app.use(helmet());
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN?.split(',') || '*',
      credentials: true,
    })
  );
  app.use(compression());
  app.use(express.json({ limit: '2mb' }));
  app.use(requestContext);
  app.use(metricsMiddleware);

  // Rate limiting (OWASP: brute force / abuse protection)
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api', limiter);

  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });
  app.use('/api/auth', authLimiter);

  // Observability
  app.get('/health', (_req, res) => res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() }));
  app.get('/metrics', async (_req, res) => {
    res.setHeader('Content-Type', registry.contentType);
    res.send(await registry.metrics());
  });

  // API docs
  try {
    const openapiDoc = YAML.load(path.join(process.cwd(), 'openapi.yaml'));
    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapiDoc));
  } catch {
    // openapi.yaml missing in this environment: docs route simply unavailable, app still runs
  }

  // API routes
  app.use('/api/auth', authRouter);
  app.use('/api/workflows', workflowRouter);
  app.use('/api/items', itemRouter);
  app.use('/api/ai', aiRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/labels', labelsRouter);
  app.use('/api/reminder-rules', reminderRulesRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/system', systemRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
