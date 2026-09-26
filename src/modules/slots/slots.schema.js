import { z } from "zod";

// Re-usable date string validator (YYYY-MM-DD)
const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
  .refine((d) => !isNaN(Date.parse(d)), "Invalid date");

// Re-usable time string validator (HH:MM, 24-hour)
const timeString = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Time must be in HH:MM format (24-hour)");

// ─────────────────────────────────────────
// Generate slots for a centre-test
// Two modes driven by the presence of `slots`:
//
//  AUTO mode  — omit `slots` entirely.
//               Generates 9:00–19:00 in 30-min increments for every
//               date in [startDate, endDate].
//
//  MANUAL mode — provide `slots` array with explicit times.
// ─────────────────────────────────────────
export const generateSlotsSchema = z
  .object({
    centreTestId: z.string().uuid("centreTestId must be a valid UUID"),

    startDate: dateString,

    // endDate defaults to startDate when omitted (single day)
    endDate: dateString.optional(),

    // capacity per slot (default 1)
    capacity: z
      .number()
      .int("Capacity must be a whole number")
      .min(1, "Capacity must be at least 1")
      .max(100, "Capacity must be at most 100")
      .default(1),

    // MANUAL mode — explicit list of HH:MM start times
    slots: z
      .array(timeString, { error: "slots must be an array of HH:MM strings" })
      .min(1, "Provide at least one slot time")
      .optional(),
  })
  .refine(
    (d) => {
      if (!d.endDate) return true;
      return new Date(d.endDate) >= new Date(d.startDate);
    },
    { message: "endDate must be on or after startDate", path: ["endDate"] }
  );

// ─────────────────────────────────────────
// Delete / clear slots for a date range
// ─────────────────────────────────────────
export const deleteSlotsSchema = z
  .object({
    centreTestId: z.string().uuid("centreTestId must be a valid UUID"),
    startDate: dateString,
    endDate: dateString.optional(),
  })
  .refine(
    (d) => {
      if (!d.endDate) return true;
      return new Date(d.endDate) >= new Date(d.startDate);
    },
    { message: "endDate must be on or after startDate", path: ["endDate"] }
  );
