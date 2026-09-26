import { z } from "zod";

// ─────────────────────────────────────────
// Initiate a payment for a booking
// ─────────────────────────────────────────
export const initiatePaymentSchema = z.object({
  bookingId: z.string().uuid("bookingId must be a valid UUID"),
});

// ─────────────────────────────────────────
// Webhook payload from the simulated provider
//
// The provider sends:
//   eventId       — unique dedup key (idempotency)
//   providerRefId — the provider's payment reference
//   status        — SUCCESS | FAILED
//   bookingId     — which booking this relates to
//   amount        — the charged amount (for verification)
// ─────────────────────────────────────────
export const webhookSchema = z.object({
  eventId: z
    .string()
    .trim()
    .min(1, "eventId is required")
    .max(150, "eventId must be at most 150 characters"),

  providerRefId: z
    .string()
    .trim()
    .min(1, "providerRefId is required")
    .max(100, "providerRefId must be at most 100 characters"),

  status: z.enum(["SUCCESS", "FAILED"], {
    error: "status must be SUCCESS or FAILED",
  }),

  bookingId: z.string().uuid("bookingId must be a valid UUID"),

  amount: z
    .number()
    .positive("amount must be positive"),
});
