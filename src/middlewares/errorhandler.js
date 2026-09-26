/**
 * Error Handler Middleware
 *
 * Centralised error processing for the entire Express app.
 * All thrown errors eventually land here via Express's async error
 * propagation (v5 forwards async throws automatically).
 *
 * AppError  — operational errors (known, client-facing)
 * Everything else — unexpected errors (logged, sanitised response)
 */

import { env } from "../config/env.js";
import { ZodError } from "zod";

// ─────────────────────────────────────────
// AppError  (operational / expected errors)
// ─────────────────────────────────────────

export class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

// ─────────────────────────────────────────
// 404 handler  (mount before errorHandler)
// ─────────────────────────────────────────

export function notFoundHandler(req, _res, next) {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
}

// ─────────────────────────────────────────
// Global error handler  (4-arg Express signature)
// ─────────────────────────────────────────

export function errorHandler(err, _req, res, _next) {
  // ── Zod validation errors ──────────────────────────────────
  if (err instanceof ZodError) {
    const errors = err.issues.map((e) => ({
      field: e.path.join("."),
      message: e.message,
    }));
    res.status(400).json({
      status: "error",
      message: "Validation failed",
      errors,
    });
    return;
  }

  // ── Operational (known) errors ─────────────────────────────
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      status: "error",
      message: err.message,
    });
    return;
  }

  // ── Prisma known errors ────────────────────────────────────
  if (isPrismaError(err)) {
    const handled = handlePrismaError(err);
    if (handled) {
      res.status(handled.status).json({
        status: "error",
        message: handled.message,
      });
      return;
    }
  }

  // ── Unknown / programming errors ───────────────────────────
  // Log the full error server-side, never leak internals to the client
  console.error("[Unhandled Error]", err);

  const message =
    env.NODE_ENV === "development" && err instanceof Error
      ? err.message
      : "An unexpected error occurred";

  res.status(500).json({
    status: "error",
    message,
  });
}

// ─────────────────────────────────────────
// Prisma error helpers
// ─────────────────────────────────────────

function isPrismaError(err) {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    typeof err.code === "string"
  );
}

function handlePrismaError(err) {
  switch (err.code) {
    case "P2002": {
      // Unique constraint violation
      const field = err.meta?.target?.join(", ") ?? "field";
      return { status: 409, message: `A record with this ${field} already exists` };
    }
    case "P2025":
      // Record not found
      return { status: 404, message: "Record not found" };
    case "P2003":
      // Foreign key constraint
      return { status: 400, message: "Related record does not exist" };
    default:
      return null;
  }
}
