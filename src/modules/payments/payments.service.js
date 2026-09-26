/**
 * Payments Service
 *
 * All READ validations happen OUTSIDE transactions.
 * Transactions contain only the minimum writes needed for atomicity.
 * This prevents timeout errors on remote DBs (Neon / PlanetScale etc.)
 * where each round-trip adds 100–300 ms of network latency.
 */

import { prisma } from "../../prisma/client.js";
import { AppError } from "../../middlewares/errorhandler.js";
import { randomUUID } from "crypto";

// ─────────────────────────────────────────
// Simulate the external payment provider
// 80 % SUCCESS, 20 % FAILED
// ─────────────────────────────────────────
function simulateProviderCall(amount) {
  const providerRefId = `PAY-${randomUUID().toUpperCase().slice(0, 12)}`;
  const status = Math.random() < 0.8 ? "SUCCESS" : "FAILED";
  return { providerRefId, status, amount };
}

// ─────────────────────────────────────────
// Initiate payment
// ─────────────────────────────────────────
export async function initiatePayment(userId, input) {
  // ── 1. Read + validate OUTSIDE transaction ────────────────
  const booking = await prisma.booking.findUnique({
    where: { id: input.bookingId },
    select: {
      id:          true,
      userId:      true,
      status:      true,
      amount:      true,
      timeSlotId:  true,
      payment:     { select: { id: true, status: true, providerRefId: true } },
      timeSlot: {
        select: {
          slotDate:  true,
          startTime: true,
          centreTest: {
            select: {
              centre: { select: { id: true, name: true } },
              test:   { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });

  if (!booking) throw new AppError("Booking not found", 404);
  if (booking.userId !== userId) throw new AppError("You do not own this booking", 403);

  if (booking.status !== "PENDING") {
    throw new AppError(
      `Payment cannot be initiated for a booking with status ${booking.status}`,
      400
    );
  }

  if (booking.payment) {
    throw new AppError(
      "A payment already exists for this booking — check its status",
      409
    );
  }

  // ── 2. Simulate provider (network call stays outside tx) ──
  const providerResult = simulateProviderCall(Number(booking.amount));
  const newBookingStatus = providerResult.status === "SUCCESS" ? "CONFIRMED" : "FAILED";

  // ── 3. Only writes inside the transaction ─────────────────
  const result = await prisma.$transaction(
    async (tx) => {
      const payment = await tx.payment.create({
        data: {
          bookingId:     booking.id,
          providerRefId: providerResult.providerRefId,
          amount:        booking.amount,
          status:        providerResult.status,
        },
        select: {
          id:            true,
          providerRefId: true,
          amount:        true,
          status:        true,
          createdAt:     true,
        },
      });

      // Release slot capacity on payment failure
      if (newBookingStatus === "FAILED") {
        await tx.timeSlot.update({
          where: { id: booking.timeSlotId },
          data:  { bookedCount: { decrement: 1 } },
        });
      }

      const updatedBooking = await tx.booking.update({
        where: { id: booking.id },
        data:  { status: newBookingStatus },
        select: {
          id:        true,
          status:    true,
          amount:    true,
          createdAt: true,
          updatedAt: true,
          timeSlot: {
            select: {
              slotDate:  true,
              startTime: true,
              centreTest: {
                select: {
                  centre: { select: { id: true, name: true, location: true } },
                  test:   { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      });

      return { payment, booking: updatedBooking };
    },
    { timeout: 10000 }
  );

  return result;
}

// ─────────────────────────────────────────
// Handle webhook (idempotent)
// ─────────────────────────────────────────
export async function handleWebhook(payload) {
  const { eventId, providerRefId, status, bookingId, amount } = payload;

  // ── 1. Idempotency check OUTSIDE transaction ──────────────
  const existing = await prisma.webhookEvent.findUnique({
    where:  { eventId },
    select: { id: true, processedAt: true },
  });

  if (existing) {
    return {
      alreadyProcessed: true,
      message: "Webhook event already processed — no action taken",
      eventId,
    };
  }

  // ── 2. Read booking OUTSIDE transaction ───────────────────
  const booking = await prisma.booking.findUnique({
    where:  { id: bookingId },
    select: {
      id:         true,
      status:     true,
      amount:     true,
      timeSlotId: true,
      payment:    { select: { id: true, status: true, providerRefId: true } },
    },
  });

  // ── 3. Only writes inside the transaction ─────────────────
  const result = await prisma.$transaction(
    async (tx) => {
      // Claim the eventId slot first — unique constraint prevents duplicates
      await tx.webhookEvent.create({
        data: {
          eventId,
          payload:     payload,
          processedAt: new Date(),
        },
      });

      if (!booking) {
        return { eventId, outcome: "BOOKING_NOT_FOUND", bookingId };
      }

      const amountMismatch =
        Math.abs(Number(booking.amount) - Number(amount)) > 0.001;

      // Already in terminal state — record event but do nothing
      if (["CONFIRMED", "FAILED", "CANCELLED"].includes(booking.status)) {
        return {
          eventId,
          outcome:       "ALREADY_TERMINAL",
          bookingStatus: booking.status,
          amountMismatch,
        };
      }

      // Upsert payment row
      let payment;
      if (booking.payment) {
        if (booking.payment.providerRefId !== providerRefId) {
          return {
            eventId,
            outcome: "PROVIDER_REF_MISMATCH",
            message: "providerRefId does not match existing payment record",
          };
        }
        payment = await tx.payment.update({
          where:  { id: booking.payment.id },
          data:   { status },
          select: { id: true, status: true, providerRefId: true, amount: true },
        });
      } else {
        payment = await tx.payment.create({
          data: {
            bookingId,
            providerRefId,
            amount: booking.amount,
            status,
          },
          select: { id: true, status: true, providerRefId: true, amount: true },
        });
      }

      const newBookingStatus = status === "SUCCESS" ? "CONFIRMED" : "FAILED";

      if (newBookingStatus === "FAILED") {
        await tx.timeSlot.update({
          where: { id: booking.timeSlotId },
          data:  { bookedCount: { decrement: 1 } },
        });
      }

      const updatedBooking = await tx.booking.update({
        where:  { id: bookingId },
        data:   { status: newBookingStatus },
        select: { id: true, status: true, amount: true },
      });

      return {
        eventId,
        outcome: "PROCESSED",
        payment,
        booking: updatedBooking,
        amountMismatch,
      };
    },
    { timeout: 10000 }
  );

  return result;
}

// ─────────────────────────────────────────
// Get payment details for a booking
// ─────────────────────────────────────────
export async function getPaymentForBooking(bookingId, userId) {
  const booking = await prisma.booking.findUnique({
    where:  { id: bookingId },
    select: {
      userId: true,
      status: true,
      amount: true,
      payment: {
        select: {
          id:            true,
          providerRefId: true,
          amount:        true,
          status:        true,
          createdAt:     true,
          updatedAt:     true,
        },
      },
    },
  });

  if (!booking)         throw new AppError("Booking not found", 404);
  if (booking.userId !== userId) throw new AppError("You do not own this booking", 403);
  if (!booking.payment) throw new AppError("No payment found for this booking", 404);

  return booking.payment;
}
