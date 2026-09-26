/**
 * Zod Validation Middleware
 *
 * Wraps a Zod schema and validates req.body against it.
 * On failure the ZodError is forwarded to the global error handler
 * which formats it into a structured 400 response.
 *
 * Usage:
 *   router.post("/register", validate(registerSchema), handler)
 */

export function validate(schema) {
  return function validationMiddleware(req, _res, next) {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      // Forward ZodError to the global error handler
      return next(result.error);
    }
    // Replace req.body with the parsed + transformed data
    // (e.g. trimmed strings, lowercased email)
    req.body = result.data;
    next();
  };
}
