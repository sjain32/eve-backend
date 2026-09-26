import { z } from "zod";

// ─────────────────────────────────────────
// Create Centre
// ─────────────────────────────────────────
export const createCentreSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Centre name must be at least 2 characters")
    .max(200, "Centre name must be at most 200 characters"),

  location: z
    .string()
    .trim()
    .min(3, "Location must be at least 3 characters")
    .max(255, "Location must be at most 255 characters"),
});

// ─────────────────────────────────────────
// Update Centre
// ─────────────────────────────────────────
export const updateCentreSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Centre name must be at least 2 characters")
    .max(200, "Centre name must be at most 200 characters")
    .optional(),

  location: z
    .string()
    .trim()
    .min(3, "Location must be at least 3 characters")
    .max(255, "Location must be at most 255 characters")
    .optional(),
}).refine((data) => data.name !== undefined || data.location !== undefined, {
  message: "At least one field (name or location) must be provided",
});
