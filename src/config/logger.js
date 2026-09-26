/**
 * Centralised logger — pino
 *
 * In development: pretty-prints with colours (pino-pretty auto-detected)
 * In production:  JSON lines — pipe to any log aggregator (Datadog, Loki, etc.)
 *
 * Usage:
 *   import { logger } from './config/logger.js';
 *   logger.info({ userId }, 'User logged in');
 *   logger.error({ err }, 'Unexpected failure');
 */

import pino from "pino";

const isDev = process.env["NODE_ENV"] !== "production";

export const logger = pino({
  level: process.env["LOG_LEVEL"] ?? (isDev ? "debug" : "info"),

  // Pretty print in development — falls back to JSON when pino-pretty
  // is not installed (e.g. in production containers)
  transport: isDev
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss",
          ignore: "pid,hostname",
        },
      }
    : undefined,

  // Redact secrets from log output — never log tokens or passwords
  redact: {
    paths: [
      "req.headers.authorization",
      "req.body.password",
      "req.body.refreshToken",
      "*.passwordHash",
      "*.refreshTokenHash",
    ],
    censor: "[REDACTED]",
  },

  // Standard fields on every log line
  base: {
    env: process.env["NODE_ENV"] ?? "development",
  },
});
