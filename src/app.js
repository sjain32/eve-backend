import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env.js";
import { requestLogger } from "./middlewares/requestLogger.js";
import { globalLimiter, authLimiter, paymentLimiter } from "./middlewares/rateLimiter.js";
import { swaggerSpec } from "./docs/swagger.js";
import authRouter      from "./modules/auth/auth.router.js";
import centresRouter   from "./modules/centers/centres.router.js";
import testsRouter     from "./modules/tests/tests.router.js";
import slotsRouter     from "./modules/slots/slots.router.js";
import discoveryRouter from "./modules/discovery/discovery.router.js";
import bookingsRouter  from "./modules/bookings/bookings.router.js";
import paymentsRouter  from "./modules/payments/payments.router.js";
import { notFoundHandler, errorHandler } from "./middlewares/errorhandler.js";

const app = express();

// ─────────────────────────────────────────
// Security headers
// ─────────────────────────────────────────
app.use(helmet());

// ─────────────────────────────────────────
// CORS
// ─────────────────────────────────────────
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || env.ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS policy: origin ${origin} is not allowed`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ─────────────────────────────────────────
// Request logging (pino-http)
// ─────────────────────────────────────────
app.use(requestLogger);

// ─────────────────────────────────────────
// Global rate limiter (200 req / 15 min per IP)
// ─────────────────────────────────────────
app.use(globalLimiter);

// ─────────────────────────────────────────
// Body parsing
// ─────────────────────────────────────────
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// ─────────────────────────────────────────
// Swagger UI  — /api-docs
// ─────────────────────────────────────────
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: "Eve Platform API",
  swaggerOptions:  { persistAuthorization: true },
}));

// Expose the raw OpenAPI JSON for tooling
app.get("/api-docs.json", (_req, res) => res.json(swaggerSpec));

// ─────────────────────────────────────────
// Health check  (unauthenticated, no rate limit)
// ─────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─────────────────────────────────────────
// API routes
// ─────────────────────────────────────────
app.use("/api/v1/auth",     authLimiter, authRouter);
app.use("/api/v1/centres",  centresRouter);
app.use("/api/v1/tests",    testsRouter);
app.use("/api/v1/slots",    slotsRouter);
app.use("/api/v1/discover", discoveryRouter);
app.use("/api/v1/bookings", bookingsRouter);
app.use("/api/v1/payments", paymentLimiter, paymentsRouter);

// ─────────────────────────────────────────
// 404 + global error handler  (must be LAST)
// ─────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
