import { Router } from "express";
import { authenticate, authorise } from "../../middlewares/auth.js";
import { validate } from "../../middlewares/validations.js";
import { createTestSchema, addTestToCentreSchema, updateCentreTestSchema } from "./tests.schema.js";
import {
  createTestHandler,
  listTestsHandler,
  addTestToCentreHandler,
  listCentreTestsHandler,
  updateCentreTestHandler,
  removeTestFromCentreHandler,
} from "./tests.controller.js";

const router = Router();

// All routes require CENTRE_HEAD
router.use(authenticate, authorise("CENTRE_HEAD"));

// ── Global test catalogue ─────────────────────────────────────
// POST  /api/v1/tests          — create a master test
// GET   /api/v1/tests          — list all master tests
router.post("/", validate(createTestSchema), createTestHandler);
router.get("/", listTestsHandler);

// ── Per-centre test listings ──────────────────────────────────
// These are mounted at /api/v1/tests but address a specific centre.
// Full paths:
//   POST   /api/v1/tests/centre/:centreId       — add test to centre
//   GET    /api/v1/tests/centre/:centreId       — list tests for centre
//   PATCH  /api/v1/tests/centre/:centreId/:id   — update price/active
//   DELETE /api/v1/tests/centre/:centreId/:id   — deactivate listing
router.post("/centre/:centreId",          validate(addTestToCentreSchema), addTestToCentreHandler);
router.get("/centre/:centreId",           listCentreTestsHandler);
router.patch("/centre/:centreId/:centreTestId",  validate(updateCentreTestSchema), updateCentreTestHandler);
router.delete("/centre/:centreId/:centreTestId", removeTestFromCentreHandler);

export default router;
