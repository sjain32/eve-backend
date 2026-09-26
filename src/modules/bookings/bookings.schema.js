import { z } from "zod";

// ─────────────────────────────────────────
// Create a booking
// ─────────────────────────────────────────
export const createBookingSchema = z.object({
  slotId: z.string().uuid("slotId must be a valid UUID"),
});

// ─────────────────────────────────────────
// Cancel a booking (body just needs the reason optionally)
// ─────────────────────────────────────────
export const cancelBookingSchema = z.object({
  reason: z
    .string()
    .trim()
    .max(500, "Reason must be at most 500 characters")
    .optional(),
});
