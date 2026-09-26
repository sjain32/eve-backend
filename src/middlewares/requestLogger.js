/**
 * HTTP request logger middleware — pino-http
 *
 * Logs every request with method, url, status, response time, and
 * the authenticated user ID when available.
 *
 * Skips the /health endpoint to avoid log noise.
 */

import pinoHttp from "pino-http";
import { logger } from "../config/logger.js";

export const requestLogger = pinoHttp({
  logger,

  // Skip health check pings
  autoLogging: {
    ignore: (req) => req.url === "/health",
  },

  // Attach user id to each log line when authenticated
  customProps: (req) => ({
    userId: req.user?.id ?? "unauthenticated",
  }),

  // Shorten the log level for common status codes
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },

  // What to include in the request log
  serializers: {
    req: (req) => ({
      method: req.method,
      url:    req.url,
      id:     req.id,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },
});
