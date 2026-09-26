import { Router } from "express";
import { authenticate, authorise } from "../../middlewares/auth.js";
import { validate } from "../../middlewares/validations.js";
import { createBookingSchema } from "./bookings.schema.js";
import {
  createBookingHandler,
  getMyBookingsHandler,
  getBookingHandler,
  cancelBookingHandler,
} from "./bookings.controller.js";

const router = Router();

// All booking actions are PATIENT only
router.use(authenticate, authorise("PATIENT"));

// Create a booking — POST body: { slotId }
router.post("/", validate(createBookingSchema), createBookingHandler);

// List all my bookings
router.get("/", getMyBookingsHandler);

// Get one booking by ID
router.get("/:bookingId", getBookingHandler);

// Cancel a booking
router.patch("/:bookingId/cancel", cancelBookingHandler);

export default router;
