import { Router } from "express";
import { authenticate, authorise } from "../../middlewares/auth.js";
import { validate } from "../../middlewares/validations.js";
import { createCentreSchema, updateCentreSchema } from "./centres.schema.js";
import {
  createCentreHandler,
  getMyCentresHandler,
  getCentreHandler,
  updateCentreHandler,
  getAllBookingsHandler,
  getCentreBookingsHandler,
} from "./centres.controller.js";

const router = Router();

// All routes require a logged-in CENTRE_HEAD
router.use(authenticate, authorise("CENTRE_HEAD"));

// ── Centre CRUD ──────────────────────────────────────────────
router.post("/", validate(createCentreSchema), createCentreHandler);
router.get("/my", getMyCentresHandler);
router.get("/:centreId", getCentreHandler);
router.patch("/:centreId", validate(updateCentreSchema), updateCentreHandler);

// ── Bookings view ────────────────────────────────────────────
router.get("/bookings/all", getAllBookingsHandler);
router.get("/:centreId/bookings", getCentreBookingsHandler);

export default router;
