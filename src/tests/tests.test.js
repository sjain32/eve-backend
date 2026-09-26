import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { getApp, registerUser, authHeader, cleanDb, uid } from "./helpers/setup.js";

let app;
beforeAll(async () => { app = await getApp(); });
afterAll(async () => { await cleanDb(); });

async function makeCH() { return registerUser("CENTRE_HEAD"); }

async function createCentre(token) {
  const ts  = uid();
  const res = await request(app).post("/api/v1/centres").set(authHeader(token))
    .send({ name: `C ${ts}`, location: `Loc ${ts}` });
  return res.body.centre;
}

async function createTest(token, overrides = {}) {
  const ts  = uid();
  const res = await request(app).post("/api/v1/tests").set(authHeader(token))
    .send({ name: `Test ${ts}`, description: "desc", ...overrides });
  return res;
}

// ─────────────────────────────────────────
// POST /tests  — master catalogue
// ─────────────────────────────────────────
describe("POST /api/v1/tests", () => {
  it("CENTRE_HEAD can create a test", async () => {
    const ch  = await makeCH();
    const res = await createTest(ch.token);
    expect(res.status).toBe(201);
    expect(res.body.test.id).toBeTypeOf("string");
  });

  it("PATIENT cannot create a test (403)", async () => {
    const p   = await registerUser("PATIENT");
    const res = await createTest(p.token);
    expect(res.status).toBe(403);
  });

  it("duplicate test name returns 409", async () => {
    const ch   = await makeCH();
    const name = `Unique ${uid()}`;
    await request(app).post("/api/v1/tests").set(authHeader(ch.token)).send({ name });
    const res = await request(app).post("/api/v1/tests").set(authHeader(ch.token)).send({ name });
    expect(res.status).toBe(409);
  });

  it("rejects missing name with 400", async () => {
    const ch  = await makeCH();
    const res = await request(app).post("/api/v1/tests").set(authHeader(ch.token)).send({});
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────
// GET /tests  — list catalogue paginated
// ─────────────────────────────────────────
describe("GET /api/v1/tests", () => {
  it("returns paginated test catalogue", async () => {
    const ch  = await makeCH();
    for (let i = 0; i < 3; i++) await createTest(ch.token);

    const res = await request(app).get("/api/v1/tests?page=1&limit=2").set(authHeader(ch.token));
    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.pagination).toBeDefined();
  });
});

// ─────────────────────────────────────────
// POST /tests/centre/:centreId — add to centre
// ─────────────────────────────────────────
describe("POST /api/v1/tests/centre/:centreId", () => {
  it("adds a test to a centre", async () => {
    const ch     = await makeCH();
    const centre = await createCentre(ch.token);
    const test   = (await createTest(ch.token)).body.test;

    const res = await request(app)
      .post(`/api/v1/tests/centre/${centre.id}`)
      .set(authHeader(ch.token))
      .send({ testId: test.id, price: 99.99 });

    expect(res.status).toBe(201);
    expect(res.body.listing.id).toBeTypeOf("string");
    expect(Number(res.body.listing.price)).toBe(99.99);
  });

  it("non-owner cannot add test (403)", async () => {
    const ch1    = await makeCH();
    const ch2    = await makeCH();
    const centre = await createCentre(ch1.token);
    const test   = (await createTest(ch2.token)).body.test;

    const res = await request(app)
      .post(`/api/v1/tests/centre/${centre.id}`)
      .set(authHeader(ch2.token))
      .send({ testId: test.id, price: 50 });
    expect(res.status).toBe(403);
  });

  it("rejects non-existent testId with 404", async () => {
    const ch     = await makeCH();
    const centre = await createCentre(ch.token);
    const res = await request(app)
      .post(`/api/v1/tests/centre/${centre.id}`)
      .set(authHeader(ch.token))
      .send({ testId: "00000000-0000-0000-0000-000000000000", price: 50 });
    expect(res.status).toBe(404);
  });

  it("rejects negative price with 400", async () => {
    const ch     = await makeCH();
    const centre = await createCentre(ch.token);
    const test   = (await createTest(ch.token)).body.test;
    const res = await request(app)
      .post(`/api/v1/tests/centre/${centre.id}`)
      .set(authHeader(ch.token))
      .send({ testId: test.id, price: -10 });
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────
// GET /tests/centre/:centreId
// ─────────────────────────────────────────
describe("GET /api/v1/tests/centre/:centreId", () => {
  it("lists tests for a centre", async () => {
    const ch     = await makeCH();
    const centre = await createCentre(ch.token);
    const test   = (await createTest(ch.token)).body.test;
    await request(app).post(`/api/v1/tests/centre/${centre.id}`)
      .set(authHeader(ch.token)).send({ testId: test.id, price: 100 });

    const res = await request(app)
      .get(`/api/v1/tests/centre/${centre.id}`)
      .set(authHeader(ch.token));
    expect(res.status).toBe(200);
    expect(res.body.tests.length).toBeGreaterThanOrEqual(1);
  });
});

// ─────────────────────────────────────────
// PATCH /tests/centre/:centreId/:centreTestId
// ─────────────────────────────────────────
describe("PATCH /api/v1/tests/centre/:centreId/:centreTestId", () => {
  it("updates price", async () => {
    const ch     = await makeCH();
    const centre = await createCentre(ch.token);
    const test   = (await createTest(ch.token)).body.test;
    const listing = (await request(app).post(`/api/v1/tests/centre/${centre.id}`)
      .set(authHeader(ch.token)).send({ testId: test.id, price: 100 })).body.listing;

    const res = await request(app)
      .patch(`/api/v1/tests/centre/${centre.id}/${listing.id}`)
      .set(authHeader(ch.token))
      .send({ price: 200 });
    expect(res.status).toBe(200);
    expect(Number(res.body.listing.price)).toBe(200);
  });
});

// ─────────────────────────────────────────
// DELETE /tests/centre/:centreId/:centreTestId
// ─────────────────────────────────────────
describe("DELETE /api/v1/tests/centre/:centreId/:centreTestId", () => {
  it("deactivates a centre-test listing", async () => {
    const ch      = await makeCH();
    const centre  = await createCentre(ch.token);
    const test    = (await createTest(ch.token)).body.test;
    const listing = (await request(app).post(`/api/v1/tests/centre/${centre.id}`)
      .set(authHeader(ch.token)).send({ testId: test.id, price: 100 })).body.listing;

    const res = await request(app)
      .delete(`/api/v1/tests/centre/${centre.id}/${listing.id}`)
      .set(authHeader(ch.token));
    expect(res.status).toBe(200);
    expect(res.body.listing.isActive).toBe(false);
  });
});
