import { Router } from 'express';

import {
  createDevOtpInboxController,
  type DevOtpInboxUseCase,
} from '../controllers/dev-inbox.controller.js';

export type DevRouterDependencies = {
  inboxService?: DevOtpInboxUseCase;
};

export function createDevRouter(dependencies: DevRouterDependencies = {}) {
  const router = Router();

  router.get('/otp-inbox', createDevOtpInboxController(dependencies.inboxService));

  return router;
}
