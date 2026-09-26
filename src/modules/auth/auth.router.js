import { Router } from "express";
import {
  registerHandler,
  loginHandler,
  logoutHandler,
  refreshHandler,
  meHandler,
} from "./auth.controller.js";
import { authenticate } from "../../middlewares/auth.js";
import { validate } from "../../middlewares/validations.js";
import {
  registerSchema,
  loginSchema,
  refreshSchema,
} from "./auth.schema.js";

const router = Router();

// ── Public routes ────────────────────────────────────────────
// No auth middleware — these create or renew credentials

/** Register a new account */
router.post("/register", validate(registerSchema), registerHandler);

/** Log in with email + password */
router.post("/login", validate(loginSchema), loginHandler);

/** Exchange a refresh token for a new token pair */
router.post("/refresh", validate(refreshSchema), refreshHandler);

// ── Protected routes ─────────────────────────────────────────
// authenticate verifies the access JWT AND checks the session row in the DB

/** Log out the current session (revokes the session) */
router.post("/logout", authenticate, logoutHandler);

/** Return the currently authenticated user */
router.get("/me", authenticate, meHandler);

export default router;
