import { Router } from "express";
import { authenticate, authorise } from "../../middlewares/auth.js";
import { validate } from "../../middlewares/validations.js";
import { initiatePaymentSchema, webhookSchema } from "./payments.schema.js";
import {
  initiatePaymentHandler,
  getPaymentHandler,
  webhookHandler,
} from "./payments.controller.js";

const router = Router();

// ── Webhook — NO auth, but validated + idempotent ────────────
// Must be registered BEFORE the authenticate middleware below.
// Real implementations would verify a provider signature here.
router.post("/webhook", validate(webhookSchema), webhookHandler);

// ── Authenticated patient routes ─────────────────────────────
router.use(authenticate, authorise("PATIENT"));

// Initiate payment for a PENDING booking
router.post("/", validate(initiatePaymentSchema), initiatePaymentHandler);

// Get payment status for a booking the patient owns
router.get("/:bookingId", getPaymentHandler);

export default router;
