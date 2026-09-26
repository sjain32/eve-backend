import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { getApp, registerUser, authHeader, cleanDb, uid } from "./helpers/setup.js";

let app;
beforeAll(async () => { app = await getApp(); });
afterAll(async () => { await cleanDb(); });

async function makeCentreHead() {
  return registerUser("CENTRE_HEAD");
}

async function createCentre(token, overrides = {}) {
  const ts  = uid();
  const res = await request(app)
    .post("/api/v1/centres")
    .set(authHeader(token))
    .send({ name: `Centre ${ts}`, location: `City ${ts}`, ...overrides });
  return res;
}

// ─────────────────────────────────────────
// POST /centres
// ─────────────────────────────────────────
describe("POST /api/v1/centres", () => {
  it("CENTRE_HEAD can create a centre", async () => {
    const ch  = await makeCentreHead();
    const res = await createCentre(ch.token);
    expect(res.status).toBe(201);
    expect(res.body.centre.id).toBeTypeOf("string");
    expect(res.body.centre.ownerId).toBe(ch.user.id);
  });

  it("PATIENT cannot create a centre (403)", async () => {
    const p   = await registerUser("PATIENT");
    const res = await createCentre(p.token);
    expect(res.status).toBe(403);
  });

  it("unauthenticated request returns 401", async () => {
    const res = await request(app).post("/api/v1/centres").send({ name: "X", location: "Y" });
    expect(res.status).toBe(401);
  });

  it("rejects missing name with 400", async () => {
    const ch  = await makeCentreHead();
    const res = await request(app)
      .post("/api/v1/centres")
      .set(authHeader(ch.token))
      .send({ location: "Somewhere" });
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────
// GET /centres/my
// ─────────────────────────────────────────
describe("GET /api/v1/centres/my", () => {
  it("returns only centres owned by the caller", async () => {
    const ch1 = await makeCentreHead();
    const ch2 = await makeCentreHead();
    await createCentre(ch1.token);
    await createCentre(ch1.token);
    await createCentre(ch2.token);

    const res = await request(app).get("/api/v1/centres/my").set(authHeader(ch1.token));
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
    expect(res.body.pagination.total).toBe(2);
  });

  it("supports pagination", async () => {
    const ch = await makeCentreHead();
    for (let i = 0; i < 5; i++) await createCentre(ch.token);

    const res = await request(app)
      .get("/api/v1/centres/my?page=1&limit=2")
      .set(authHeader(ch.token));

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
    expect(res.body.pagination.totalPages).toBeGreaterThanOrEqual(3);
    expect(res.body.pagination.hasNext).toBe(true);
  });
});

// ─────────────────────────────────────────
// GET /centres/:centreId
// ─────────────────────────────────────────
describe("GET /api/v1/centres/:centreId", () => {
  it("owner can get their centre", async () => {
    const ch  = await makeCentreHead();
    const c   = await createCentre(ch.token);
    const res = await request(app)
      .get(`/api/v1/centres/${c.body.centre.id}`)
      .set(authHeader(ch.token));

    expect(res.status).toBe(200);
    expect(res.body.centre.id).toBe(c.body.centre.id);
  });

  it("non-owner gets 403", async () => {
    const ch1 = await makeCentreHead();
    const ch2 = await makeCentreHead();
    const c   = await createCentre(ch1.token);
    const res = await request(app)
      .get(`/api/v1/centres/${c.body.centre.id}`)
      .set(authHeader(ch2.token));
    expect(res.status).toBe(403);
  });

  it("non-existent centre returns 404", async () => {
    const ch  = await makeCentreHead();
    const res = await request(app)
      .get("/api/v1/centres/00000000-0000-0000-0000-000000000000")
      .set(authHeader(ch.token));
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────
// PATCH /centres/:centreId
// ─────────────────────────────────────────
describe("PATCH /api/v1/centres/:centreId", () => {
  it("owner can update location", async () => {
    const ch  = await makeCentreHead();
    const c   = await createCentre(ch.token);
    const res = await request(app)
      .patch(`/api/v1/centres/${c.body.centre.id}`)
      .set(authHeader(ch.token))
      .send({ location: "New Location" });

    expect(res.status).toBe(200);
    expect(res.body.centre.location).toBe("New Location");
  });

  it("non-owner gets 403", async () => {
    const ch1 = await makeCentreHead();
    const ch2 = await makeCentreHead();
    const c   = await createCentre(ch1.token);
    const res = await request(app)
      .patch(`/api/v1/centres/${c.body.centre.id}`)
      .set(authHeader(ch2.token))
      .send({ location: "Hack" });
    expect(res.status).toBe(403);
  });

  it("rejects empty body with 400", async () => {
    const ch  = await makeCentreHead();
    const c   = await createCentre(ch.token);
    const res = await request(app)
      .patch(`/api/v1/centres/${c.body.centre.id}`)
      .set(authHeader(ch.token))
      .send({});
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────
// GET /centres/bookings/all  +  /:centreId/bookings
// ─────────────────────────────────────────
describe("GET /api/v1/centres/bookings/all", () => {
  it("returns paginated bookings for all owned centres", async () => {
    const ch  = await makeCentreHead();
    const res = await request(app)
      .get("/api/v1/centres/bookings/all")
      .set(authHeader(ch.token));
    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.pagination).toBeDefined();
  });

  it("PATIENT cannot access centre bookings (403)", async () => {
    const p   = await registerUser("PATIENT");
    const res = await request(app)
      .get("/api/v1/centres/bookings/all")
      .set(authHeader(p.token));
    expect(res.status).toBe(403);
  });
});
