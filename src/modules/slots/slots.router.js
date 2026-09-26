import { Router } from "express";
import { authenticate, authorise } from "../../middlewares/auth.js";
import { validate } from "../../middlewares/validations.js";
import { generateSlotsSchema, deleteSlotsSchema } from "./slots.schema.js";
import {
  generateSlotsHandler,
  listSlotsHandler,
  deleteSlotsHandler,
} from "./slots.controller.js";

const router = Router();

// All slot management is CENTRE_HEAD only
router.use(authenticate, authorise("CENTRE_HEAD"));

// Generate slots (auto or manual)
router.post("/generate", validate(generateSlotsSchema), generateSlotsHandler);

// List slots for a centre-test  ?date= or ?from=&to=
router.get("/:centreTestId", listSlotsHandler);

// Delete unbooked slots for a date range
router.delete("/", validate(deleteSlotsSchema), deleteSlotsHandler);

export default router;
