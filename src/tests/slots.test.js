import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { getApp, registerUser, authHeader, cleanDb, uid, futureDate } from "./helpers/setup.js";

let app;
beforeAll(async () => { app = await getApp(); });
afterAll(async () => { await cleanDb(); });

// ── Fixture helpers ───────────────────────────────────────────
async function buildFixture() {
  const ch = await registerUser("CENTRE_HEAD");

  const centre = (await request(app).post("/api/v1/centres")
    .set(authHeader(ch.token))
    .send({ name: `C ${uid()}`, location: "Loc" })).body.centre;

  const test = (await request(app).post("/api/v1/tests")
    .set(authHeader(ch.token))
    .send({ name: `T ${uid()}` })).body.test;

  const listing = (await request(app).post(`/api/v1/tests/centre/${centre.id}`)
    .set(authHeader(ch.token))
    .send({ testId: test.id, price: 50 })).body.listing;

  return { ch, centre, test, centreTestId: listing.id };
}

// ─────────────────────────────────────────
// POST /slots/generate — AUTO mode
// ─────────────────────────────────────────
describe("POST /api/v1/slots/generate — AUTO", () => {
  it("generates 20 slots per day (09:00–18:30 half-hour)", async () => {
    const { ch, centreTestId } = await buildFixture();
    const startDate = futureDate(10);

    const res = await request(app).post("/api/v1/slots/generate")
      .set(authHeader(ch.token))
      .send({ centreTestId, startDate, capacity: 2 });

    expect(res.status).toBe(201);
    expect(res.body.mode).toBe("auto");
    expect(res.body.created).toBe(20);      // single day, 20 slots
    expect(res.body.timesPerDay).toBe(20);
  });

  it("generates slots for a range of days", async () => {
    const { ch, centreTestId } = await buildFixture();
    const startDate = futureDate(20);
    const endDate   = futureDate(22);         // 3 days

    const res = await request(app).post("/api/v1/slots/generate")
      .set(authHeader(ch.token))
      .send({ centreTestId, startDate, endDate, capacity: 1 });

    expect(res.status).toBe(201);
    expect(res.body.created).toBe(60);       // 3 days × 20 slots
  });

  it("skipDuplicates — re-running same range doesn't double-create", async () => {
    const { ch, centreTestId } = await buildFixture();
    const startDate = futureDate(40);

    await request(app).post("/api/v1/slots/generate")
      .set(authHeader(ch.token)).send({ centreTestId, startDate });

    const res = await request(app).post("/api/v1/slots/generate")
      .set(authHeader(ch.token)).send({ centreTestId, startDate });

    expect(res.status).toBe(201);
    expect(res.body.created).toBe(0);
    expect(res.body.skipped).toBe(20);
  });

  it("PATIENT cannot generate slots (403)", async () => {
    const { centreTestId } = await buildFixture();
    const p   = await registerUser("PATIENT");
    const res = await request(app).post("/api/v1/slots/generate")
      .set(authHeader(p.token))
      .send({ centreTestId, startDate: futureDate(50) });
    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────
// POST /slots/generate — MANUAL mode
// ─────────────────────────────────────────
describe("POST /api/v1/slots/generate — MANUAL", () => {
  it("creates exactly the specified time slots", async () => {
    const { ch, centreTestId } = await buildFixture();
    const startDate = futureDate(60);
    const slots     = ["08:00", "12:00", "16:00"];

    const res = await request(app).post("/api/v1/slots/generate")
      .set(authHeader(ch.token))
      .send({ centreTestId, startDate, slots, capacity: 3 });

    expect(res.status).toBe(201);
    expect(res.body.mode).toBe("manual");
    expect(res.body.created).toBe(3);
    expect(res.body.timesPerDay).toBe(3);
  });

  it("rejects endDate before startDate with 400", async () => {
    const { ch, centreTestId } = await buildFixture();
    const res = await request(app).post("/api/v1/slots/generate")
      .set(authHeader(ch.token))
      .send({ centreTestId, startDate: futureDate(70), endDate: futureDate(69) });
    expect(res.status).toBe(400);
  });

  it("rejects invalid time format with 400", async () => {
    const { ch, centreTestId } = await buildFixture();
    const res = await request(app).post("/api/v1/slots/generate")
      .set(authHeader(ch.token))
      .send({ centreTestId, startDate: futureDate(80), slots: ["25:00"] });
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────
// GET /slots/:centreTestId
// ─────────────────────────────────────────
describe("GET /api/v1/slots/:centreTestId", () => {
  it("lists slots with availability annotation", async () => {
    const { ch, centreTestId } = await buildFixture();
    const startDate = futureDate(90);
    await request(app).post("/api/v1/slots/generate")
      .set(authHeader(ch.token)).send({ centreTestId, startDate });

    const res = await request(app)
      .get(`/api/v1/slots/${centreTestId}?date=${startDate}`)
      .set(authHeader(ch.token));

    expect(res.status).toBe(200);
    expect(res.body.slots.length).toBe(20);
    expect(res.body.slots[0]).toHaveProperty("available");
    expect(res.body.slots[0]).toHaveProperty("isFull");
  });
});

// ─────────────────────────────────────────
// DELETE /slots
// ─────────────────────────────────────────
describe("DELETE /api/v1/slots", () => {
  it("deletes unbooked slots for a date range", async () => {
    const { ch, centreTestId } = await buildFixture();
    const startDate = futureDate(100);
    await request(app).post("/api/v1/slots/generate")
      .set(authHeader(ch.token)).send({ centreTestId, startDate });

    const res = await request(app).delete("/api/v1/slots")
      .set(authHeader(ch.token))
      .send({ centreTestId, startDate, endDate: startDate });

    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(20);
  });
});
