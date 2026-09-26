import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import {
  getApp, registerUser, authHeader, cleanDb,
  buildCentreFixture, getFirstSlot, buildBookingFixture,
} from "./helpers/setup.js";

let app;
beforeAll(async () => { app = await getApp(); });
afterAll(async () => { await cleanDb(); });

// ─────────────────────────────────────────
// POST /bookings
// ─────────────────────────────────────────
describe("POST /api/v1/bookings", () => {
  it("PATIENT can book a slot — returns PENDING", async () => {
    const { centreTest, startDate } = await buildCentreFixture();
    const patient = await registerUser("PATIENT");
    const slot    = await getFirstSlot(centreTest.id, patient.token);

    const res = await request(app).post("/api/v1/bookings")
      .set(authHeader(patient.token))
      .send({ slotId: slot.id });

    expect(res.status).toBe(201);
    expect(res.body.booking.status).toBe("PENDING");
    expect(res.body.booking.id).toBeTypeOf("string");
  });

  it("CENTRE_HEAD cannot book (403)", async () => {
    const { centreTest, ch } = await buildCentreFixture();
    const slot = await getFirstSlot(centreTest.id, ch.token);

    const res = await request(app).post("/api/v1/bookings")
      .set(authHeader(ch.token))
      .send({ slotId: slot.id });
    expect(res.status).toBe(403);
  });

  it("returns 404 for non-existent slotId", async () => {
    const patient = await registerUser("PATIENT");
    const res = await request(app).post("/api/v1/bookings")
      .set(authHeader(patient.token))
      .send({ slotId: "00000000-0000-0000-0000-000000000000" });
    expect(res.status).toBe(404);
  });

  it("prevents duplicate booking of same slot", async () => {
    const { centreTest } = await buildCentreFixture();
    const patient = await registerUser("PATIENT");
    const slot    = await getFirstSlot(centreTest.id, patient.token);

    await request(app).post("/api/v1/bookings")
      .set(authHeader(patient.token)).send({ slotId: slot.id });

    const res = await request(app).post("/api/v1/bookings")
      .set(authHeader(patient.token)).send({ slotId: slot.id });
    expect(res.status).toBe(409);
  });

  it("respects slot capacity — fills up at max", async () => {
    const ch = await registerUser("CENTRE_HEAD");

    // Create a centre/test/listing with capacity 1
    const centre = (await request(app).post("/api/v1/centres")
      .set(authHeader(ch.token)).send({ name: `Cap ${Date.now()}`, location: "X" })).body.centre;

    const test = (await request(app).post("/api/v1/tests")
      .set(authHeader(ch.token)).send({ name: `Cap Test ${Date.now()}` })).body.test;

    const listing = (await request(app).post(`/api/v1/tests/centre/${centre.id}`)
      .set(authHeader(ch.token)).send({ testId: test.id, price: 10 })).body.listing;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 10);
    const sd = startDate.toISOString().split("T")[0];

    await request(app).post("/api/v1/slots/generate")
      .set(authHeader(ch.token))
      .send({ centreTestId: listing.id, startDate: sd, capacity: 1 });

    const p1 = await registerUser("PATIENT");
    const p2 = await registerUser("PATIENT");
    const slot = await getFirstSlot(listing.id, p1.token);

    // First patient books successfully
    const b1 = await request(app).post("/api/v1/bookings")
      .set(authHeader(p1.token)).send({ slotId: slot.id });
    expect(b1.status).toBe(201);

    // Second patient gets 409 — slot full
    const b2 = await request(app).post("/api/v1/bookings")
      .set(authHeader(p2.token)).send({ slotId: slot.id });
    expect(b2.status).toBe(409);
  });

  it("rejects missing slotId with 400", async () => {
    const patient = await registerUser("PATIENT");
    const res = await request(app).post("/api/v1/bookings")
      .set(authHeader(patient.token)).send({});
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────
// GET /bookings
// ─────────────────────────────────────────
describe("GET /api/v1/bookings", () => {
  it("returns paginated bookings for the patient", async () => {
    const { booking, patient } = await buildBookingFixture();
    const res = await request(app).get("/api/v1/bookings")
      .set(authHeader(patient.token));

    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.data.some(b => b.id === booking.id)).toBe(true);
  });

  it("only returns bookings for the authenticated patient", async () => {
    const f1 = await buildBookingFixture();
    const p2 = await registerUser("PATIENT");

    const res = await request(app).get("/api/v1/bookings")
      .set(authHeader(p2.token));

    // p2 has no bookings — f1's booking should not appear
    expect(res.status).toBe(200);
    expect(res.body.data.some(b => b.id === f1.booking.id)).toBe(false);
  });
});

// ─────────────────────────────────────────
// GET /bookings/:bookingId
// ─────────────────────────────────────────
describe("GET /api/v1/bookings/:bookingId", () => {
  it("owner can get their booking", async () => {
    const { booking, patient } = await buildBookingFixture();
    const res = await request(app)
      .get(`/api/v1/bookings/${booking.id}`)
      .set(authHeader(patient.token));

    expect(res.status).toBe(200);
    expect(res.body.booking.id).toBe(booking.id);
  });

  it("non-owner gets 403", async () => {
    const { booking } = await buildBookingFixture();
    const other = await registerUser("PATIENT");
    const res = await request(app)
      .get(`/api/v1/bookings/${booking.id}`)
      .set(authHeader(other.token));
    expect(res.status).toBe(403);
  });

  it("non-existent bookingId returns 404", async () => {
    const p = await registerUser("PATIENT");
    const res = await request(app)
      .get("/api/v1/bookings/00000000-0000-0000-0000-000000000000")
      .set(authHeader(p.token));
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────
// PATCH /bookings/:bookingId/cancel
// ─────────────────────────────────────────
describe("PATCH /api/v1/bookings/:bookingId/cancel", () => {
  it("PENDING booking can be cancelled (slot > 2 hours away)", async () => {
    const { booking, patient } = await buildBookingFixture();
    const res = await request(app)
      .patch(`/api/v1/bookings/${booking.id}/cancel`)
      .set(authHeader(patient.token));

    expect(res.status).toBe(200);
    expect(res.body.booking.status).toBe("CANCELLED");
  });

  it("cannot cancel an already-cancelled booking (400)", async () => {
    const { booking, patient } = await buildBookingFixture();
    await request(app).patch(`/api/v1/bookings/${booking.id}/cancel`)
      .set(authHeader(patient.token));

    const res = await request(app).patch(`/api/v1/bookings/${booking.id}/cancel`)
      .set(authHeader(patient.token));
    expect(res.status).toBe(400);
  });

  it("non-owner cannot cancel (403)", async () => {
    const { booking } = await buildBookingFixture();
    const other = await registerUser("PATIENT");
    const res = await request(app)
      .patch(`/api/v1/bookings/${booking.id}/cancel`)
      .set(authHeader(other.token));
    expect(res.status).toBe(403);
  });

  it("enforces 2-hour cancellation window", async () => {
    // Book a slot that starts in 1 hour (within the 2-hr window)
    const { prisma } = await import("../prisma/client.js");
    const { booking } = await buildBookingFixture();

    // Manipulate slot date/time to be 1 hour from now
    const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);
    const slotDateOnly   = new Date(oneHourFromNow.toISOString().split("T")[0] + "T00:00:00Z");
    const timeOnly       = new Date(Date.UTC(1970, 0, 1,
      oneHourFromNow.getUTCHours(), oneHourFromNow.getUTCMinutes()));

    // Find the timeSlot via the booking
    const b = await prisma.booking.findUnique({
      where: { id: booking.id },
      select: { timeSlotId: true },
    });
    await prisma.timeSlot.update({
      where: { id: b.timeSlotId },
      data:  { slotDate: slotDateOnly, startTime: timeOnly },
    });

    const { booking: b2, patient } = await buildBookingFixture();
    // Use the same patient from the original fixture
    const { booking: realBooking } = await buildBookingFixture();

    // Now try to cancel booking with manipulated slot
    const { booking: nearBooking, patient: nearPatient } = await buildBookingFixture();

    // Manipulate that booking's slot
    const nearB = await prisma.booking.findUnique({
      where: { id: nearBooking.id }, select: { timeSlotId: true },
    });
    await prisma.timeSlot.update({
      where: { id: nearB.timeSlotId },
      data:  { slotDate: slotDateOnly, startTime: timeOnly },
    });

    const res = await request(app)
      .patch(`/api/v1/bookings/${nearBooking.id}/cancel`)
      .set(authHeader(nearPatient.token));
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/2 hours/);
  });
});
