/**
 * IP-based rate limiters using express-rate-limit
 *
 * Two tiers:
 *
 *  globalLimiter   — applied to every route: 200 req / 15 min per IP
 *                    Protects against general abuse / scrapers
 *
 *  authLimiter     — applied to /auth/register, /auth/login only:
 *                    20 req / 15 min per IP
 *                    Limits brute-force and credential stuffing
 *
 *  paymentLimiter  — applied to POST /payments:
 *                    10 req / 15 min per IP
 *                    Extra caution on the payment path
 *
 * Note: the per-user leaky-bucket limiter (rateLimitByUser) in
 * src/middlewares/auth.js handles authenticated post-login rate limiting.
 * These IP limiters guard the unauthenticated surface.
 */

import rateLimit from "express-rate-limit";

const windowMs = 15 * 60 * 1000; // 15 minutes

function makeHandler(message) {
  return (_req, res) => {
    res.status(429).json({
      status:  "error",
      message,
    });
  };
}

export const globalLimiter = rateLimit({
  windowMs,
  max: 200,
  standardHeaders: true,   // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders:   false,  // Disable the `X-RateLimit-*` headers
  handler: makeHandler("Too many requests — please slow down"),
});

export const authLimiter = rateLimit({
  windowMs,
  max: 20,
  standardHeaders: true,
  legacyHeaders:   false,
  handler: makeHandler("Too many authentication attempts — try again in 15 minutes"),
});

export const paymentLimiter = rateLimit({
  windowMs,
  max: 10,
  standardHeaders: true,
  legacyHeaders:   false,
  handler: makeHandler("Too many payment requests — try again in 15 minutes"),
});
