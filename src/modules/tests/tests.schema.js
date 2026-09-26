import { z } from "zod";

// ─────────────────────────────────────────
// Create a master test (global catalogue)
// ─────────────────────────────────────────
export const createTestSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Test name must be at least 2 characters")
    .max(150, "Test name must be at most 150 characters"),

  description: z
    .string()
    .trim()
    .max(2000, "Description must be at most 2000 characters")
    .optional(),
});

// ─────────────────────────────────────────
// Add a test to a centre (CentreTest listing)
// ─────────────────────────────────────────
export const addTestToCentreSchema = z.object({
  testId: z.string().uuid("testId must be a valid UUID"),

  price: z
    .number({ required_error: "Price is required" })
    .nonnegative("Price must be 0 or greater")
    .multipleOf(0.01, "Price can have at most 2 decimal places"),
});

// ─────────────────────────────────────────
// Update a centre-test listing (price / active flag)
// ─────────────────────────────────────────
export const updateCentreTestSchema = z.object({
  price: z
    .number()
    .nonnegative("Price must be 0 or greater")
    .multipleOf(0.01, "Price can have at most 2 decimal places")
    .optional(),

  isActive: z.boolean().optional(),
}).refine((d) => d.price !== undefined || d.isActive !== undefined, {
  message: "At least one field (price or isActive) must be provided",
});
