import { z } from "zod";

// Allowed roles a caller can self-select at registration
export const USER_ROLES = /** @type {const} */ (["PATIENT", "CENTRE_HEAD"]);

// ─────────────────────────────────────────
// Register
// ─────────────────────────────────────────
export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(120, "Name must be at most 120 characters"),

  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Invalid email address")
    .max(255, "Email must be at most 255 characters"),

  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be at most 128 characters")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&^#])/,
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&^#)"
    ),

  // Optional — defaults to PATIENT when omitted
  role: z
    .enum(["PATIENT", "CENTRE_HEAD"], {
      error: "Role must be either PATIENT or CENTRE_HEAD",
    })
    .default("PATIENT"),
});

// ─────────────────────────────────────────
// Login
// ─────────────────────────────────────────
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Invalid email address"),

  password: z.string().min(1, "Password is required"),
});

// ─────────────────────────────────────────
// Refresh
// ─────────────────────────────────────────
export const refreshSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});
