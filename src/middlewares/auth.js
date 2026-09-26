/**
 * Authentication Middleware
 *
 * Dual-layer verification:
 *   1. JWT signature + expiry (stateless, fast)
 *   2. Session row in the DB (stateful, revocable)
 *
 * A token is only valid when BOTH layers pass.
 * This means logout is immediate — deleting the session row
 * invalidates all tokens for that session even before JWT expiry.
 *
 * Usage:
 *   router.get("/protected", authenticate, handler)
 *
 * After passing, req.user is guaranteed to be set:
 *   { id, name, email, sessionId }
 */

import { prisma } from "../prisma/client.js";
import { verifyAccessToken } from "../modules/auth/auth.service.js";
import { AppError } from "./errorhandler.js";

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

/**
 * Extract a Bearer token from the Authorization header.
 * Returns null if the header is absent or malformed.
 */
function extractBearerToken(req) {
  const header = req.headers.authorization;
  if (typeof header !== "string") return null;

  const parts = header.split(" ");
  if (parts.length !== 2 || parts[0]?.toLowerCase() !== "bearer") return null;

  return parts[1] ?? null;
}

// ─────────────────────────────────────────
// authenticate  (middleware)
// ─────────────────────────────────────────

export async function authenticate(req, _res, next) {
  // 1. Pull the token from the Authorization header
  const token = extractBearerToken(req);
  if (!token) {
    return next(new AppError("Authentication required — no token provided", 401));
  }

  // 2. Verify JWT signature and expiry (throws AppError on failure)
  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    return next(err);
  }

  const { sub: userId, sessionId } = payload;

  // 3. Validate the session row exists and has not been revoked / expired
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      userId: true,
      revokedAt: true,
      expiresAt: true,
      user: {
        select: { id: true, name: true, email: true, role: true },
      },
    },
  });

  if (
    !session ||
    session.userId !== userId ||
    session.revokedAt !== null ||
    session.expiresAt < new Date()
  ) {
    return next(new AppError("Session is invalid or has been revoked", 401));
  }

  // 4. Attach the user + sessionId to the request for downstream handlers
  req.user = {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: session.user.role,
    sessionId: session.id,
  };

  next();
}

// ─────────────────────────────────────────
// Role-based authorisation guard
// ─────────────────────────────────────────

/**
 * Restrict a route to users whose role is in the allowed list.
 * Must be placed AFTER `authenticate` in the middleware chain.
 *
 * Usage:
 *   router.post("/centres", authenticate, authorise("CENTRE_HEAD"), handler)
 *   router.get("/bookings", authenticate, authorise("PATIENT", "CENTRE_HEAD"), handler)
 */
export function authorise(...roles) {
  return function authoriseMiddleware(req, _res, next) {
    if (!req.user) {
      return next(new AppError("Authentication required", 401));
    }
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError(
          `Access denied — requires role: ${roles.join(" or ")}`,
          403
        )
      );
    }
    next();
  };
}

// ─────────────────────────────────────────
// Rate limiting — leaky bucket per user
// ─────────────────────────────────────────

const buckets = new Map();

/**
 * Per-authenticated-user leaky-bucket rate limiter.
 * Capacity:   maxTokens requests per window
 * Leak rate:  one token recovered every `leakIntervalMs` ms
 *
 * Designed to sit AFTER `authenticate` so req.user is always set.
 *
 * Usage (e.g. 30 req / 60 s per user):
 *   router.get("/heavy", authenticate, rateLimitByUser(), handler)
 */
export function rateLimitByUser(maxTokens = 30, leakIntervalMs = 2_000) {
  return function rateLimitMiddleware(req, _res, next) {
    // Should only be used after authenticate, but guard defensively
    if (!req.user) {
      return next(new AppError("Authentication required", 401));
    }

    const userId = req.user.id;
    const now = Date.now();

    let bucket = buckets.get(userId);
    if (!bucket) {
      bucket = { tokens: maxTokens - 1, lastRefill: now };
      buckets.set(userId, bucket);
      return next();
    }

    // Leak: recover tokens proportional to elapsed time
    const elapsed = now - bucket.lastRefill;
    const recovered = Math.floor(elapsed / leakIntervalMs);
    if (recovered > 0) {
      bucket.tokens = Math.min(maxTokens, bucket.tokens + recovered);
      bucket.lastRefill = now;
    }

    if (bucket.tokens <= 0) {
      return next(new AppError("Too many requests — please slow down", 429));
    }

    bucket.tokens -= 1;
    next();
  };
}
