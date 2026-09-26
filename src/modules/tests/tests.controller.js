import * as testsService from "./tests.service.js";
import { parsePagination } from "../../utils/paginate.js";

// POST /api/v1/tests
export async function createTestHandler(req, res) {
  const test = await testsService.createTest(req.body);
  res.status(201).json({ message: "Test added to catalogue", test });
}

// GET /api/v1/tests?page=&limit=
export async function listTestsHandler(req, res) {
  const pagination = parsePagination(req.query);
  const result = await testsService.listAllTests(pagination);
  res.status(200).json(result);
}

// POST /api/v1/tests/centre/:centreId
export async function addTestToCentreHandler(req, res) {
  const listing = await testsService.addTestToCentre(
    req.params.centreId,
    req.user.id,
    req.body
  );
  res.status(201).json({ message: "Test added to centre", listing });
}

// GET /api/v1/tests/centre/:centreId
export async function listCentreTestsHandler(req, res) {
  const tests = await testsService.listTestsForCentre(
    req.params.centreId,
    req.user.id
  );
  res.status(200).json({ tests });
}

// PATCH /api/v1/tests/centre/:centreId/:centreTestId
export async function updateCentreTestHandler(req, res) {
  const listing = await testsService.updateCentreTest(
    req.params.centreTestId,
    req.user.id,
    req.body
  );
  res.status(200).json({ message: "Listing updated", listing });
}

// DELETE /api/v1/tests/centre/:centreId/:centreTestId
export async function removeTestFromCentreHandler(req, res) {
  const listing = await testsService.removeTestFromCentre(
    req.params.centreTestId,
    req.user.id
  );
  res.status(200).json({ message: "Test removed from centre", listing });
}
