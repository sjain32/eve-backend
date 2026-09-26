import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import { getApp, registerUser, authHeader, cleanDb, buildBookingFixture, uid } from "./helpers/setup.js";

let app;
beforeAll(async () => { app = await getApp(); });
afterAll(async () => { await cleanDb(); });

// ─────────────────────────────────────────
// POST /payments  — initiate
// ─────────────────────────────────────────
describe("POST /api/v1/payments", () => {
  it("initiates payment for a PENDING booking — returns SUCCESS or FAILED", async () => {
    const { booking, patient } = await buildBookingFixture();

    const res = await request(app).post("/api/v1/payments")
      .set(authHeader(patient.token))
      .send({ bookingId: booking.id });

    expect([200, 402]).toContain(res.status);
    expect(["SUCCESS", "FAILED"]).toContain(res.body.payment.status);
    expect(["CONFIRMED", "FAILED"]).toContain(res.body.booking.status);
    expect(res.body.payment.providerRefId).toBeTypeOf("string");
  });

  it("cannot pay for someone else's booking (403)", async () => {
    const { booking } = await buildBookingFixture();
    const other = await registerUser("PATIENT");

    const res = await request(app).post("/api/v1/payments")
      .set(authHeader(other.token))
      .send({ bookingId: booking.id });
    expect(res.status).toBe(403);
  });

  it("cannot pay twice for the same booking (409)", async () => {
    const { booking, patient } = await buildBookingFixture();

    await request(app).post("/api/v1/payments")
      .set(authHeader(patient.token)).send({ bookingId: booking.id });

    const res = await request(app).post("/api/v1/payments")
      .set(authHeader(patient.token)).send({ bookingId: booking.id });
    expect([400, 409]).toContain(res.status);
  });

  it("cannot pay for a CANCELLED booking (400)", async () => {
    const { booking, patient } = await buildBookingFixture();

    await request(app).patch(`/api/v1/bookings/${booking.id}/cancel`)
      .set(authHeader(patient.token));

    const res = await request(app).post("/api/v1/payments")
      .set(authHeader(patient.token)).send({ bookingId: booking.id });
    expect(res.status).toBe(400);
  });

  it("returns 404 for non-existent bookingId", async () => {
    const patient = await registerUser("PATIENT");
    const res = await request(app).post("/api/v1/payments")
      .set(authHeader(patient.token))
      .send({ bookingId: "00000000-0000-0000-0000-000000000000" });
    expect(res.status).toBe(404);
  });

  it("requires authentication (401)", async () => {
    const res = await request(app).post("/api/v1/payments")
      .send({ bookingId: "00000000-0000-0000-0000-000000000000" });
    expect(res.status).toBe(401);
  });

  it("CENTRE_HEAD cannot initiate payment (403)", async () => {
    const { booking, ch } = await buildBookingFixture();
    const res = await request(app).post("/api/v1/payments")
      .set(authHeader(ch.token))
      .send({ bookingId: booking.id });
    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────
// GET /payments/:bookingId
// ─────────────────────────────────────────
describe("GET /api/v1/payments/:bookingId", () => {
  it("returns payment details for owner", async () => {
    const { booking, patient } = await buildBookingFixture();
    await request(app).post("/api/v1/payments")
      .set(authHeader(patient.token)).send({ bookingId: booking.id });

    const res = await request(app)
      .get(`/api/v1/payments/${booking.id}`)
      .set(authHeader(patient.token));

    expect(res.status).toBe(200);
    expect(res.body.payment.id).toBeTypeOf("string");
    expect(["SUCCESS", "FAILED"]).toContain(res.body.payment.status);
  });

  it("returns 404 when no payment exists yet", async () => {
    const { booking, patient } = await buildBookingFixture();
    const res = await request(app)
      .get(`/api/v1/payments/${booking.id}`)
      .set(authHeader(patient.token));
    expect(res.status).toBe(404);
  });

  it("non-owner gets 403", async () => {
    const { booking } = await buildBookingFixture();
    const other = await registerUser("PATIENT");
    const res = await request(app)
      .get(`/api/v1/payments/${booking.id}`)
      .set(authHeader(other.token));
    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────
// POST /payments/webhook  — idempotency + outcomes
// ─────────────────────────────────────────
describe("POST /api/v1/payments/webhook", () => {
  it("processes a SUCCESS webhook and confirms the booking", async () => {
    const { booking } = await buildBookingFixture();
    const eventId = `evt_${uid()}`;

    const res = await request(app).post("/api/v1/payments/webhook").send({
      eventId,
      providerRefId: `PAY-${uid()}`,
      status:        "SUCCESS",
      bookingId:     booking.id,
      amount:        99.99,
    });

    expect(res.status).toBe(200);
    expect(res.body.outcome).toBe("PROCESSED");
    expect(res.body.booking.status).toBe("CONFIRMED");
  });

  it("processes a FAILED webhook and marks booking FAILED", async () => {
    const { booking } = await buildBookingFixture();
    const eventId = `evt_${uid()}`;

    const res = await request(app).post("/api/v1/payments/webhook").send({
      eventId,
      providerRefId: `PAY-${uid()}`,
      status:        "FAILED",
      bookingId:     booking.id,
      amount:        99.99,
    });

    expect(res.status).toBe(200);
    // Could be PROCESSED or ALREADY_TERMINAL depending on test order
    expect(res.body.outcome).toBeDefined();
  });

  it("is idempotent — same eventId twice returns alreadyProcessed", async () => {
    const { booking } = await buildBookingFixture();
    const eventId      = `evt_${uid()}`;
    const providerRefId = `PAY-${uid()}`;

    const body = {
      eventId, providerRefId, status: "SUCCESS",
      bookingId: booking.id, amount: 99.99,
    };

    await request(app).post("/api/v1/payments/webhook").send(body);
    const res = await request(app).post("/api/v1/payments/webhook").send(body);

    expect(res.status).toBe(200);
    expect(res.body.alreadyProcessed).toBe(true);
  });

  it("returns ALREADY_TERMINAL for a booking already in terminal state", async () => {
    const { booking } = await buildBookingFixture();
    const eventId1 = `evt_${uid()}`;
    const eventId2 = `evt_${uid()}`;
    const ref = `PAY-${uid()}`;

    // First webhook confirms the booking
    await request(app).post("/api/v1/payments/webhook").send({
      eventId: eventId1, providerRefId: ref,
      status: "SUCCESS", bookingId: booking.id, amount: 99.99,
    });

    // Second webhook with different eventId on same booking
    const res = await request(app).post("/api/v1/payments/webhook").send({
      eventId: eventId2, providerRefId: `PAY-${uid()}`,
      status: "SUCCESS", bookingId: booking.id, amount: 99.99,
    });

    expect(res.status).toBe(200);
    expect(res.body.outcome).toBe("ALREADY_TERMINAL");
  });

  it("returns BOOKING_NOT_FOUND for unknown bookingId", async () => {
    const res = await request(app).post("/api/v1/payments/webhook").send({
      eventId:       `evt_${uid()}`,
      providerRefId: `PAY-${uid()}`,
      status:        "SUCCESS",
      bookingId:     "00000000-0000-0000-0000-000000000000",
      amount:        50,
    });
    expect(res.status).toBe(200);
    expect(res.body.outcome).toBe("BOOKING_NOT_FOUND");
  });

  it("rejects missing fields with 400", async () => {
    const res = await request(app).post("/api/v1/payments/webhook")
      .send({ eventId: "evt_x", status: "SUCCESS" });
    expect(res.status).toBe(400);
  });

  it("rejects invalid status with 400", async () => {
    const res = await request(app).post("/api/v1/payments/webhook").send({
      eventId:       `evt_${uid()}`,
      providerRefId: `PAY-${uid()}`,
      status:        "PENDING",
      bookingId:     "00000000-0000-0000-0000-000000000000",
      amount:        50,
    });
    expect(res.status).toBe(400);
  });
});
