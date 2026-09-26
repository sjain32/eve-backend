import { Router } from "express";
import { authenticate, authorise } from "../../middlewares/auth.js";
import {
  listCentresHandler,
  getCentreHandler,
  getAvailableSlotsHandler,
} from "./discovery.controller.js";

const router = Router();

// Discovery routes are available to any authenticated user (PATIENT or CENTRE_HEAD)
router.use(authenticate);

// Browse all centres (with optional ?name= / ?location= search)
router.get("/centres", listCentresHandler);

// Get one centre — shows all active tests it offers with prices
router.get("/centres/:centreId", getCentreHandler);

// Get available (not full) slots for a specific centre-test
// ?date=YYYY-MM-DD              — single day
// ?from=YYYY-MM-DD&to=YYYY-MM-DD — date range
router.get("/slots/:centreTestId", getAvailableSlotsHandler);

export default router;
