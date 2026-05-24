import express from 'express';

import { errorHandler } from './middleware/error-handler.js';
import { notFoundHandler } from './middleware/not-found.js';
import { healthRouter } from './routes/health.routes.js';
import { createOtpRouter, type OtpRouterDependencies } from './routes/otp.routes.js';

export type AppDependencies = {
  otp?: OtpRouterDependencies;
};

export function createApp(dependencies: AppDependencies = {}) {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));

  app.use('/health', healthRouter);
  app.use('/otp', createOtpRouter(dependencies.otp));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
