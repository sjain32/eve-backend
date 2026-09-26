import { prisma } from "../../prisma/client.js";
import { AppError } from "../../middlewares/errorhandler.js";
import { paginateQuery } from "../../utils/paginate.js";

// ─────────────────────────────────────────
// List all centres — paginated
// Optional query filters: ?name=&location=&page=&limit=
// ─────────────────────────────────────────
export async function listCentres(filters = {}) {
  const where = {};

  if (filters.name) {
    where.name = { contains: filters.name, mode: "insensitive" };
  }
  if (filters.location) {
    where.location = { contains: filters.location, mode: "insensitive" };
  }

  const result = await paginateQuery(prisma.diagnosticCentre, {
    where,
    select: {
      id: true,
      name: true,
      location: true,
      createdAt: true,
      _count: {
        select: { centreTests: { where: { isActive: true } } },
      },
    },
    orderBy: { name: "asc" },
    page:  filters.page,
    limit: filters.limit,
  });

  return result;
}

// ─────────────────────────────────────────
// Get one centre — with all its active tests + prices
// ─────────────────────────────────────────
export async function getCentreWithTests(centreId) {
  const centre = await prisma.diagnosticCentre.findUnique({
    where: { id: centreId },
    select: {
      id: true,
      name: true,
      location: true,
      createdAt: true,
      centreTests: {
        where: { isActive: true },
        select: {
          id: true,           // centreTestId — needed to fetch slots
          price: true,
          test: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
        },
        orderBy: { test: { name: "asc" } },
      },
    },
  });

  if (!centre) throw new AppError("Centre not found", 404);
  return centre;
}

// ─────────────────────────────────────────
// Get available slots for a specific centre-test
// Filters: ?date=YYYY-MM-DD  OR  ?from=YYYY-MM-DD&to=YYYY-MM-DD
// Only returns slots that still have capacity left
// ─────────────────────────────────────────
export async function getAvailableSlots(centreTestId, filters = {}) {
  // Verify the listing exists and is active
  const listing = await prisma.centreTest.findUnique({
    where: { id: centreTestId },
    select: {
      id: true,
      price: true,
      isActive: true,
      centre: { select: { id: true, name: true, location: true } },
      test: { select: { id: true, name: true, description: true } },
    },
  });

  if (!listing) throw new AppError("Test listing not found", 404);
  if (!listing.isActive) throw new AppError("This test is not currently available at this centre", 400);

  // Build date filter
  const dateFilter = buildDateFilter(filters);

  const slots = await prisma.timeSlot.findMany({
    where: {
      centreTestId,
      // Only show future or today's slots
      slotDate: {
        gte: new Date(new Date().toISOString().split("T")[0] + "T00:00:00Z"),
        ...dateFilter,
      },
    },
    select: {
      id: true,
      slotDate: true,
      startTime: true,
      capacity: true,
      bookedCount: true,
    },
    orderBy: [{ slotDate: "asc" }, { startTime: "asc" }],
  });

  const available = slots
    .filter((s) => s.bookedCount < s.capacity)
    .map((s) => ({
      id: s.id,
      slotDate: s.slotDate,
      startTime: s.startTime,
      capacity: s.capacity,
      bookedCount: s.bookedCount,
      spotsLeft: s.capacity - s.bookedCount,
    }));

  return {
    centre: listing.centre,
    test: listing.test,
    price: listing.price,
    centreTestId: listing.id,
    slots: available,
  };
}

// ─────────────────────────────────────────
// Helper — build Prisma date range from query filters
// ─────────────────────────────────────────
function buildDateFilter(filters) {
  if (filters.date) {
    const d = new Date(filters.date + "T00:00:00Z");
    return { gte: d, lte: d };
  }
  const extra = {};
  if (filters.from) extra.gte = new Date(filters.from + "T00:00:00Z");
  if (filters.to)   extra.lte = new Date(filters.to   + "T00:00:00Z");
  return extra;
}
