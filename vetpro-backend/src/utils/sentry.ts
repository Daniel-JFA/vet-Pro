import * as Sentry from '@sentry/node';
import { env } from '../config/env.js';

export function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    return;
  }

  Sentry.init({
    dsn,
    environment: env.isProduction ? 'production' : process.env.NODE_ENV || 'development',
    tracesSampleRate: env.isProduction ? 0.2 : 1.0
  });
}

export { Sentry };
