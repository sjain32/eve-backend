import { prisma } from "../../prisma/client.js";
import { AppError } from "../../middlewares/errorhandler.js";
import { paginateQuery } from "../../utils/paginate.js";

// ─────────────────────────────────────────
// Create a new diagnostic centre
// ─────────────────────────────────────────
export async function createCentre(ownerId, input) {
  return prisma.diagnosticCentre.create({
    data: { name: input.name, location: input.location, ownerId },
    select: { id: true, name: true, location: true, ownerId: true, createdAt: true },
  });
}

// ─────────────────────────────────────────
// List all centres owned by this centre head — paginated
// ─────────────────────────────────────────
export async function getMyCentres(ownerId, { page, limit }) {
  return paginateQuery(prisma.diagnosticCentre, {
    where:   { ownerId },
    select:  { id: true, name: true, location: true, createdAt: true, _count: { select: { centreTests: true } } },
    orderBy: { createdAt: "desc" },
    page,
    limit,
  });
}

// ─────────────────────────────────────────
// Get a single centre (must be owned by caller)
// ─────────────────────────────────────────
export async function getCentreById(centreId, ownerId) {
  const centre = await prisma.diagnosticCentre.findUnique({
    where: { id: centreId },
    select: {
      id: true, name: true, location: true, ownerId: true, createdAt: true,
      centreTests: {
        where:  { isActive: true },
        select: { id: true, price: true, isActive: true, test: { select: { id: true, name: true, description: true } } },
      },
    },
  });

  if (!centre) throw new AppError("Centre not found", 404);
  if (centre.ownerId !== ownerId) throw new AppError("You do not own this centre", 403);
  return centre;
}

// ─────────────────────────────────────────
// Update centre details (owner only)
// ─────────────────────────────────────────
export async function updateCentre(centreId, ownerId, input) {
  const centre = await prisma.diagnosticCentre.findUnique({
    where:  { id: centreId },
    select: { ownerId: true },
  });

  if (!centre) throw new AppError("Centre not found", 404);
  if (centre.ownerId !== ownerId) throw new AppError("You do not own this centre", 403);

  return prisma.diagnosticCentre.update({
    where:  { id: centreId },
    data:   input,
    select: { id: true, name: true, location: true, ownerId: true, createdAt: true },
  });
}

// ─────────────────────────────────────────
// View all bookings across all owned centres — paginated
// ─────────────────────────────────────────
export async function getBookingsForMyCentres(ownerId, { page, limit }) {
  return paginateQuery(prisma.booking, {
    where:   { timeSlot: { centreTest: { centre: { ownerId } } } },
    select: {
      id: true, amount: true, status: true, createdAt: true,
      user:     { select: { id: true, name: true, email: true } },
      timeSlot: {
        select: {
          slotDate: true, startTime: true,
          centreTest: {
            select: {
              price:  true,
              centre: { select: { id: true, name: true, location: true } },
              test:   { select: { id: true, name: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    page,
    limit,
  });
}

// ─────────────────────────────────────────
// View bookings for a specific centre — paginated (owner only)
// ─────────────────────────────────────────
export async function getBookingsForCentre(centreId, ownerId, { page, limit }) {
  const centre = await prisma.diagnosticCentre.findUnique({
    where:  { id: centreId },
    select: { ownerId: true },
  });

  if (!centre) throw new AppError("Centre not found", 404);
  if (centre.ownerId !== ownerId) throw new AppError("You do not own this centre", 403);

  return paginateQuery(prisma.booking, {
    where:   { timeSlot: { centreTest: { centreId } } },
    select: {
      id: true, amount: true, status: true, createdAt: true,
      user:     { select: { id: true, name: true, email: true } },
      timeSlot: {
        select: {
          slotDate: true, startTime: true,
          centreTest: { select: { test: { select: { id: true, name: true } } } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    page,
    limit,
  });
}
