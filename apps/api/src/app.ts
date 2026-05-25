import express from 'express';

import { corsMiddleware } from './middleware/cors.js';
import { errorHandler } from './middleware/error-handler.js';
import { notFoundHandler } from './middleware/not-found.js';
import { createDevRouter, type DevRouterDependencies } from './routes/dev.routes.js';
import { healthRouter } from './routes/health.routes.js';
import { createOtpRouter, type OtpRouterDependencies } from './routes/otp.routes.js';
import { createSettingsRouter, type SettingsRouterDependencies } from './routes/settings.routes.js';

export type AppDependencies = {
  dev?: DevRouterDependencies;
  otp?: OtpRouterDependencies;
  settings?: SettingsRouterDependencies;
};

export function createApp(dependencies: AppDependencies = {}) {
  const app = express();

  app.disable('x-powered-by');
  app.use(corsMiddleware);
  app.use(express.json({ limit: '16kb' }));

  app.use('/health', healthRouter);
  app.use('/otp', createOtpRouter(dependencies.otp));
  app.use('/settings', createSettingsRouter(dependencies.settings));
  app.use('/dev', createDevRouter(dependencies.dev));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
