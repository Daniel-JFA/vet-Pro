import pino from 'pino';
import { pinoHttp } from 'pino-http';
import { env } from '../config/env.js';

export const logger = pino({
  level:
    process.env.LOG_LEVEL ||
    (process.env.NODE_ENV === 'test'
      ? 'silent'
      : env.isProduction
      ? 'info'
      : 'debug'),
  transport: !env.isProduction && process.env.NODE_ENV !== 'test'
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname'
        }
      }
    : undefined
});

export const httpLogger = pinoHttp({
  logger,
  genReqId: (req: any) => req.id || req.headers['x-request-id'] || undefined,
  customLogLevel: (_req, res, err) => {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage: (req, res) => `${req.method} ${req.url} -> ${res.statusCode}`
});
