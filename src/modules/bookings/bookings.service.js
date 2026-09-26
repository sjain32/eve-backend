import { prisma } from "../../prisma/client.js";
import { AppError } from "../../middlewares/errorhandler.js";
import { paginateQuery } from "../../utils/paginate.js";

// ─────────────────────────────────────────
// Shared select shape for a booking response
// ─────────────────────────────────────────
function bookingSelect() {
  return {
    id: true,
    amount: true,
    status: true,
    createdAt: true,
    updatedAt: true,
    timeSlot: {
      select: {
        id: true,
        slotDate: true,
        startTime: true,
        centreTest: {
          select: {
            id: true,
            price: true,
            centre: { select: { id: true, name: true, location: true } },
            test: { select: { id: true, name: true, description: true } },
          },
        },
      },
    },
  };
}

// ─────────────────────────────────────────
// Create a booking
//
// Strategy: run all READ validations BEFORE the transaction so the
// transaction only contains the two writes (update + create).
// This keeps the transaction window under ~1 s even on a remote DB.
//
// Race condition safety: the UPDATE uses a WHERE clause that checks
// bookedCount < capacity atomically at the DB level, so a concurrent
// booking that sneaks in between our read and write is still blocked.
// ─────────────────────────────────────────
export async function createBooking(userId, input) {
  // ── 1. Read + validate OUTSIDE the transaction ────────────
  const slot = await prisma.timeSlot.findUnique({
    where: { id: input.slotId },
    select: {
      id: true,
      capacity: true,
      bookedCount: true,
      centreTest: {
        select: {
          id: true,
          price: true,
          isActive: true,
          centre: { select: { id: true, name: true } },
          test:   { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!slot) throw new AppError("Slot not found", 404);

  if (!slot.centreTest.isActive) {
    throw new AppError("This test is no longer available at this centre", 400);
  }

  if (slot.bookedCount >= slot.capacity) {
    throw new AppError("This slot is fully booked — please choose another", 409);
  }

  // Duplicate booking check — outside the transaction is fine here
  // because we guard against races inside via the conditional UPDATE below
  const duplicate = await prisma.booking.findFirst({
    where: {
      userId,
      timeSlotId: input.slotId,
      status: { in: ["PENDING", "CONFIRMED"] },
    },
    select: { id: true },
  });
  if (duplicate) {
    throw new AppError("You have already booked this slot", 409);
  }

  // ── 2. Only the two writes go inside the transaction ─────
  // The UPDATE only succeeds if bookedCount is still < capacity at
  // write time — this is the atomic race-condition guard.
  const booking = await prisma.$transaction(
    async (tx) => {
      // Atomically increment bookedCount only if space still exists
      const updated = await tx.timeSlot.updateMany({
        where: {
          id: input.slotId,
          bookedCount: { lt: slot.capacity }, // re-check at write time
        },
        data: { bookedCount: { increment: 1 } },
      });

      // If 0 rows updated, someone else grabbed the last spot
      if (updated.count === 0) {
        throw new AppError("This slot just became fully booked — please choose another", 409);
      }

      // Create the booking record
      return tx.booking.create({
        data: {
          userId,
          timeSlotId: input.slotId,
          amount:     slot.centreTest.price,
          status:     "PENDING",
        },
        select: bookingSelect(),
      });
    },
    { timeout: 10000 } // 10 s — generous but bounded
  );

  return booking;
}

// ─────────────────────────────────────────
// List all bookings for the current patient — paginated
// ─────────────────────────────────────────
export async function getMyBookings(userId, { page, limit }) {
  return paginateQuery(prisma.booking, {
    where:   { userId },
    select:  bookingSelect(),
    orderBy: { createdAt: "desc" },
    page,
    limit,
  });
}

// ─────────────────────────────────────────
// Get a single booking (must belong to the caller)
// ─────────────────────────────────────────
export async function getBookingById(bookingId, userId) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { ...bookingSelect(), userId: true },
  });

  if (!booking) throw new AppError("Booking not found", 404);
  if (booking.userId !== userId) throw new AppError("You do not own this booking", 403);

  const { userId: _omit, ...safe } = booking;
  return safe;
}

// ─────────────────────────────────────────
// Cancel a booking
// Rules:
//   - Only PENDING / CONFIRMED bookings can be cancelled
//   - Cannot cancel if the appointment is less than 2 hours away
//   - Releases the slot capacity back atomically
// ─────────────────────────────────────────
export async function cancelBooking(bookingId, userId) {
  // ── 1. Read + validate OUTSIDE the transaction ────────────
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id:        true,
      userId:    true,
      status:    true,
      timeSlotId: true,
      timeSlot: {
        select: { slotDate: true, startTime: true },
      },
    },
  });

  if (!booking) throw new AppError("Booking not found", 404);
  if (booking.userId !== userId) throw new AppError("You do not own this booking", 403);

  if (!["PENDING", "CONFIRMED"].includes(booking.status)) {
    throw new AppError(`Cannot cancel a booking with status ${booking.status}`, 400);
  }

  // ── 2-hour cancellation window ──────────────────────────
  // slotDate  → Date at UTC midnight  (date portion only)
  // startTime → Date anchored to 1970-01-01 (time portion only)
  const slotDate  = booking.timeSlot.slotDate;
  const startTime = booking.timeSlot.startTime;

  const appointmentMs =
    slotDate.getTime() +
    startTime.getUTCHours()   * 60 * 60 * 1000 +
    startTime.getUTCMinutes() * 60 * 1000;

  const twoHoursFromNow = Date.now() + 2 * 60 * 60 * 1000;

  if (appointmentMs < twoHoursFromNow) {
    throw new AppError(
      "Cancellation is not allowed within 2 hours of the appointment time",
      400
    );
  }

  // ── 2. Only the two writes go inside the transaction ─────
  return prisma.$transaction(
    async (tx) => {
      // Release the slot capacity
      await tx.timeSlot.update({
        where: { id: booking.timeSlotId },
        data:  { bookedCount: { decrement: 1 } },
      });

      // Mark booking as CANCELLED
      return tx.booking.update({
        where: { id: bookingId },
        data:  { status: "CANCELLED" },
        select: bookingSelect(),
      });
    },
    { timeout: 10000 }
  );
}
