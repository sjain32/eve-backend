import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { getApp, registerUser, authHeader, cleanDb, buildCentreFixture } from "./helpers/setup.js";

let app;
beforeAll(async () => { app = await getApp(); });
afterAll(async () => { await cleanDb(); });

// ─────────────────────────────────────────
// GET /discover/centres
// ─────────────────────────────────────────
describe("GET /api/v1/discover/centres", () => {
  it("returns paginated list of centres", async () => {
    await buildCentreFixture();           // seed at least one centre
    const p   = await registerUser("PATIENT");
    const res = await request(app)
      .get("/api/v1/discover/centres?page=1&limit=5")
      .set(authHeader(p.token));

    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination.total).toBeGreaterThanOrEqual(1);
  });

  it("filters centres by name (case insensitive)", async () => {
    const { centre, ch } = await buildCentreFixture();
    const p = await registerUser("PATIENT");

    // Search using first word of generated centre name (all start with "Centre")
    const res = await request(app)
      .get(`/api/v1/discover/centres?name=Centre`)
      .set(authHeader(p.token));

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it("requires authentication (401)", async () => {
    const res = await request(app).get("/api/v1/discover/centres");
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────
// GET /discover/centres/:centreId
// ─────────────────────────────────────────
describe("GET /api/v1/discover/centres/:centreId", () => {
  it("returns centre with active tests and prices", async () => {
    const { centre, centreTest } = await buildCentreFixture();
    const p   = await registerUser("PATIENT");
    const res = await request(app)
      .get(`/api/v1/discover/centres/${centre.id}`)
      .set(authHeader(p.token));

    expect(res.status).toBe(200);
    expect(res.body.centre.id).toBe(centre.id);
    expect(res.body.centre.centreTests.length).toBeGreaterThanOrEqual(1);
    expect(res.body.centre.centreTests[0]).toHaveProperty("price");
    expect(res.body.centre.centreTests[0]).toHaveProperty("id");  // centreTestId
  });

  it("returns 404 for non-existent centre", async () => {
    const p   = await registerUser("PATIENT");
    const res = await request(app)
      .get("/api/v1/discover/centres/00000000-0000-0000-0000-000000000000")
      .set(authHeader(p.token));
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────
// GET /discover/slots/:centreTestId
// ─────────────────────────────────────────
describe("GET /api/v1/discover/slots/:centreTestId", () => {
  it("returns available slots with spotsLeft annotation", async () => {
    const { centreTest, startDate } = await buildCentreFixture();
    const p   = await registerUser("PATIENT");
    const res = await request(app)
      .get(`/api/v1/discover/slots/${centreTest.id}?from=${startDate}&to=${startDate}`)
      .set(authHeader(p.token));

    expect(res.status).toBe(200);
    expect(res.body.slots).toBeInstanceOf(Array);
    expect(res.body.centre).toBeDefined();
    expect(res.body.test).toBeDefined();
    expect(res.body.price).toBeDefined();

    if (res.body.slots.length > 0) {
      expect(res.body.slots[0]).toHaveProperty("spotsLeft");
    }
  });

  it("only returns future slots (not past)", async () => {
    const { centreTest } = await buildCentreFixture();
    const p   = await registerUser("PATIENT");

    // Query well in the past — should return empty
    const res = await request(app)
      .get(`/api/v1/discover/slots/${centreTest.id}?date=2020-01-01`)
      .set(authHeader(p.token));

    expect(res.status).toBe(200);
    expect(res.body.slots).toHaveLength(0);
  });

  it("returns 404 for non-existent centreTestId", async () => {
    const p   = await registerUser("PATIENT");
    const res = await request(app)
      .get("/api/v1/discover/slots/00000000-0000-0000-0000-000000000000")
      .set(authHeader(p.token));
    expect(res.status).toBe(404);
  });

  it("requires authentication (401)", async () => {
    const { centreTest } = await buildCentreFixture();
    const res = await request(app)
      .get(`/api/v1/discover/slots/${centreTest.id}`);
    expect(res.status).toBe(401);
  });
});
