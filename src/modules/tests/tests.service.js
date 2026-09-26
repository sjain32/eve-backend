import { prisma } from "../../prisma/client.js";
import { AppError } from "../../middlewares/errorhandler.js";
import { paginateQuery } from "../../utils/paginate.js";

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

/** Verify a centre exists and is owned by the given user. */
async function assertOwnership(centreId, ownerId) {
  const centre = await prisma.diagnosticCentre.findUnique({
    where: { id: centreId },
    select: { ownerId: true },
  });
  if (!centre) throw new AppError("Centre not found", 404);
  if (centre.ownerId !== ownerId) throw new AppError("You do not own this centre", 403);
}

// ─────────────────────────────────────────
// Master catalogue — create a test
// (any CENTRE_HEAD can add to the global list)
// ─────────────────────────────────────────
export async function createTest(input) {
  // Prevent duplicate test names (case-insensitive)
  const existing = await prisma.test.findFirst({
    where: { name: { equals: input.name, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) throw new AppError("A test with this name already exists", 409);

  return prisma.test.create({
    data: { name: input.name, description: input.description ?? null },
    select: { id: true, name: true, description: true, createdAt: true },
  });
}

// ─────────────────────────────────────────
// Master catalogue — list all tests — paginated
// ─────────────────────────────────────────
export async function listAllTests({ page, limit }) {
  return paginateQuery(prisma.test, {
    select:  { id: true, name: true, description: true, createdAt: true },
    orderBy: { name: "asc" },
    page,
    limit,
  });
}

// ─────────────────────────────────────────
// Add a test to a centre (creates CentreTest row)
// ─────────────────────────────────────────
export async function addTestToCentre(centreId, ownerId, input) {
  await assertOwnership(centreId, ownerId);

  // Make sure the master test exists
  const test = await prisma.test.findUnique({
    where: { id: input.testId },
    select: { id: true },
  });
  if (!test) throw new AppError("Test not found in catalogue", 404);

  // Upsert: if listing already exists (even inactive) re-activate + reprice
  const existing = await prisma.centreTest.findUnique({
    where: { centreId_testId: { centreId, testId: input.testId } },
  });

  if (existing) {
    return prisma.centreTest.update({
      where: { id: existing.id },
      data: { price: input.price, isActive: true },
      select: centreTestSelect(),
    });
  }

  return prisma.centreTest.create({
    data: { centreId, testId: input.testId, price: input.price },
    select: centreTestSelect(),
  });
}

// ─────────────────────────────────────────
// List all tests offered by a centre
// ─────────────────────────────────────────
export async function listTestsForCentre(centreId, ownerId) {
  await assertOwnership(centreId, ownerId);

  return prisma.centreTest.findMany({
    where: { centreId },
    select: centreTestSelect(),
    orderBy: { test: { name: "asc" } },
  });
}

// ─────────────────────────────────────────
// Update a centre-test listing (price / toggle active)
// ─────────────────────────────────────────
export async function updateCentreTest(centreTestId, ownerId, input) {
  const listing = await prisma.centreTest.findUnique({
    where: { id: centreTestId },
    select: { centreId: true, centre: { select: { ownerId: true } } },
  });

  if (!listing) throw new AppError("Centre test listing not found", 404);
  if (listing.centre.ownerId !== ownerId) throw new AppError("You do not own this centre", 403);

  return prisma.centreTest.update({
    where: { id: centreTestId },
    data: input,
    select: centreTestSelect(),
  });
}

// ─────────────────────────────────────────
// Remove a test from a centre (soft-delete via isActive)
// ─────────────────────────────────────────
export async function removeTestFromCentre(centreTestId, ownerId) {
  const listing = await prisma.centreTest.findUnique({
    where: { id: centreTestId },
    select: { centreId: true, centre: { select: { ownerId: true } } },
  });

  if (!listing) throw new AppError("Centre test listing not found", 404);
  if (listing.centre.ownerId !== ownerId) throw new AppError("You do not own this centre", 403);

  return prisma.centreTest.update({
    where: { id: centreTestId },
    data: { isActive: false },
    select: centreTestSelect(),
  });
}

// ─────────────────────────────────────────
// Shared select shape
// ─────────────────────────────────────────
function centreTestSelect() {
  return {
    id: true,
    price: true,
    isActive: true,
    test: { select: { id: true, name: true, description: true } },
    centre: { select: { id: true, name: true } },
  };
}
