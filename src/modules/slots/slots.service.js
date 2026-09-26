import { prisma } from "../../prisma/client.js";
import { AppError } from "../../middlewares/errorhandler.js";

// ─────────────────────────────────────────
// Constants
// ─────────────────────────────────────────
const AUTO_START_HOUR = 9;   // 09:00
const AUTO_END_HOUR   = 19;  // 19:00  (last slot starts at 18:30)
const SLOT_DURATION   = 30;  // minutes

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

/**
 * Build a JS Date that carries only the time portion.
 * Prisma @db.Time stores it as a UTC midnight + offset; we use
 * 1970-01-01 as the fixed date anchor so all time comparisons work.
 */
function buildTimeDate(hours, minutes) {
  return new Date(Date.UTC(1970, 0, 1, hours, minutes, 0, 0));
}

/** Parse "HH:MM" → { hours, minutes } */
function parseTime(timeStr) {
  const [h, m] = timeStr.split(":").map(Number);
  return { hours: h, minutes: m };
}

/**
 * Generate the standard 30-min slots from 09:00 → 18:30 (inclusive).
 * Returns an array of Date objects (time-only, anchored to 1970-01-01).
 */
function buildAutoTimes() {
  const times = [];
  for (let h = AUTO_START_HOUR; h < AUTO_END_HOUR; h++) {
    times.push(buildTimeDate(h, 0));
    times.push(buildTimeDate(h, SLOT_DURATION));
  }
  return times; // 20 slots: 09:00, 09:30 … 18:00, 18:30
}

/**
 * Expand [startDate, endDate] into an array of JS Date objects (date-only).
 */
function buildDateRange(startDate, endDate) {
  const dates = [];
  const cursor = new Date(startDate + "T00:00:00Z");
  const end    = new Date((endDate ?? startDate) + "T00:00:00Z");

  while (cursor <= end) {
    dates.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

/**
 * Guard: verify the centreTest belongs to a centre owned by ownerId.
 * Returns the centreTest record on success.
 */
async function assertCentreTestOwnership(centreTestId, ownerId) {
  const ct = await prisma.centreTest.findUnique({
    where: { id: centreTestId },
    select: {
      id: true,
      isActive: true,
      centre: { select: { id: true, ownerId: true } },
    },
  });

  if (!ct) throw new AppError("Centre test listing not found", 404);
  if (ct.centre.ownerId !== ownerId)
    throw new AppError("You do not own the centre this test belongs to", 403);
  if (!ct.isActive)
    throw new AppError("This test listing is inactive — re-activate it before adding slots", 400);

  return ct;
}

// ─────────────────────────────────────────
// Generate slots
// ─────────────────────────────────────────

export async function generateSlots(ownerId, input) {
  await assertCentreTestOwnership(input.centreTestId, ownerId);

  const dates     = buildDateRange(input.startDate, input.endDate);
  const capacity  = input.capacity ?? 1;

  // Build the time list: manual list or auto 9am-7pm half-hour grid
  const parsedTimes = input.slots
    ? input.slots.map((s) => { const t = parseTime(s); return buildTimeDate(t.hours, t.minutes); })
    : buildAutoTimes();

  // Build all (date × time) combos as upsert candidates
  const slotData = [];
  for (const date of dates) {
    for (const time of parsedTimes) {
      slotData.push({
        centreTestId: input.centreTestId,
        slotDate: date,
        startTime: time,
        capacity,
        bookedCount: 0,
      });
    }
  }

  // Use createMany with skipDuplicates — safe to re-run for the same range
  const result = await prisma.timeSlot.createMany({
    data: slotData,
    skipDuplicates: true,
  });

  return {
    created: result.count,
    total: slotData.length,
    skipped: slotData.length - result.count,
    dateRange: {
      from: input.startDate,
      to: input.endDate ?? input.startDate,
    },
    mode: input.slots ? "manual" : "auto",
    timesPerDay: parsedTimes.length,
  };
}

// ─────────────────────────────────────────
// List slots for a centre-test (with availability)
// ─────────────────────────────────────────

export async function listSlots(centreTestId, ownerId, filters = {}) {
  await assertCentreTestOwnership(centreTestId, ownerId);

  const where = { centreTestId };

  if (filters.date) {
    const d = new Date(filters.date + "T00:00:00Z");
    where.slotDate = d;
  }

  if (filters.from && filters.to) {
    where.slotDate = {
      gte: new Date(filters.from + "T00:00:00Z"),
      lte: new Date(filters.to   + "T00:00:00Z"),
    };
  }

  const slots = await prisma.timeSlot.findMany({
    where,
    select: {
      id: true,
      slotDate: true,
      startTime: true,
      capacity: true,
      bookedCount: true,
    },
    orderBy: [{ slotDate: "asc" }, { startTime: "asc" }],
  });

  // Annotate availability
  return slots.map((s) => ({
    ...s,
    available: s.capacity - s.bookedCount,
    isFull: s.bookedCount >= s.capacity,
  }));
}

// ─────────────────────────────────────────
// Delete slots for a date range (only unbooked ones)
// ─────────────────────────────────────────

export async function deleteSlots(ownerId, input) {
  await assertCentreTestOwnership(input.centreTestId, ownerId);

  const dateFilter = {
    gte: new Date(input.startDate + "T00:00:00Z"),
    lte: new Date((input.endDate ?? input.startDate) + "T00:00:00Z"),
  };

  // Only delete slots that have no bookings yet
  const result = await prisma.timeSlot.deleteMany({
    where: {
      centreTestId: input.centreTestId,
      slotDate: dateFilter,
      bookedCount: 0,
    },
  });

  return {
    deleted: result.count,
    note: "Slots with existing bookings were preserved",
  };
}
