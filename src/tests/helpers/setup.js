  /**
 * Test helpers — shared across all test suites
 *
 * Exports:
 *   getApp()        — returns the Express app (lazily initialised once)
 *   api             — supertest agent bound to the app
 *   registerUser()  — register + return { token, refreshToken, user }
 *   loginUser()     — login + return { token, refreshToken, user }
 *   authHeader()    — { Authorization: 'Bearer <token>' }
 *   cleanDb()       — delete all test data in safe order
 *   uid()           — unique string suffix for names/emails
 */

import "dotenv/config";
import { readFileSync } from "fs";
import { resolve } from "path";
import request from "supertest";

// Load .env manually so tests pick up DATABASE_URL etc.
try {
  const envPath = resolve(process.cwd(), "src/config/.env");
  const lines = readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  // .env not found — rely on environment being pre-set (CI)
}

// ─────────────────────────────────────────
// App singleton
// ─────────────────────────────────────────
let _app = null;

export async function getApp() {
  if (!_app) {
    const mod = await import("../../app.js");
    _app = mod.default;
  }
  return _app;
}

// Supertest request helper — use as: api.post('/api/v1/auth/login')
export const api = {
  async post(url) {
    const app = await getApp();
    return request(app).post(url);
  },
  async get(url) {
    const app = await getApp();
    return request(app).get(url);
  },
  async patch(url) {
    const app = await getApp();
    return request(app).patch(url);
  },
  async delete(url) {
    const app = await getApp();
    return request(app).delete(url);
  },
};

// ─────────────────────────────────────────
// Unique ID helper — avoids collisions on re-runs
// ─────────────────────────────────────────
let _counter = 0;
export function uid() {
  return `${Date.now()}_${++_counter}`;
}

// ─────────────────────────────────────────
// Auth helpers
// ─────────────────────────────────────────
export async function registerUser(role = "PATIENT") {
  const ts = uid();
  const email    = `test_${ts}@eve.test`;
  const password = "Test@1234";
  const name     = `Test User ${ts}`;

  const app = await getApp();
  const res = await request(app)
    .post("/api/v1/auth/register")
    .send({ name, email, password, role });

  if (res.status !== 201) {
    throw new Error(`registerUser failed: ${JSON.stringify(res.body)}`);
  }

  return {
    token:        res.body.accessToken,
    refreshToken: res.body.refreshToken,
    user:         res.body.user,
    email,
    password,
  };
}

export async function loginUser(email, password) {
  const app = await getApp();
  const res = await request(app)
    .post("/api/v1/auth/login")
    .send({ email, password });

  if (res.status !== 200) {
    throw new Error(`loginUser failed: ${JSON.stringify(res.body)}`);
  }

  return {
    token:        res.body.accessToken,
    refreshToken: res.body.refreshToken,
    user:         res.body.user,
  };
}

export function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

// ─────────────────────────────────────────
// DB cleanup — called in afterAll blocks
// ─────────────────────────────────────────
export async function cleanDb() {
  const { prisma } = await import("../../prisma/client.js");

  // Delete in FK-safe order
  await prisma.webhookEvent.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.booking.deleteMany({});
  await prisma.timeSlot.deleteMany({});
  await prisma.centreTest.deleteMany({});
  await prisma.test.deleteMany({});
  await prisma.diagnosticCentre.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.user.deleteMany({});
}

// ─────────────────────────────────────────
// Shared fixture builders
// ─────────────────────────────────────────

/** Register a CENTRE_HEAD, create a centre, a test, add it to centre, generate slots */
export async function buildCentreFixture() {
  const app = await getApp();
  const ch  = await registerUser("CENTRE_HEAD");

  // Create centre
  const cRes = await request(app)
    .post("/api/v1/centres")
    .set(authHeader(ch.token))
    .send({ name: `Centre ${uid()}`, location: "Test City" });
  const centre = cRes.body.centre;

  // Create master test
  const tRes = await request(app)
    .post("/api/v1/tests")
    .set(authHeader(ch.token))
    .send({ name: `Test ${uid()}`, description: "Test desc" });
  const test = tRes.body.test;

  // Add test to centre
  const ctRes = await request(app)
    .post(`/api/v1/tests/centre/${centre.id}`)
    .set(authHeader(ch.token))
    .send({ testId: test.id, price: 99.99 });
  const centreTest = ctRes.body.listing;

  // Generate slots 30 days from now
  const startDate = futureDate(30);
  const endDate   = futureDate(32);
  await request(app)
    .post("/api/v1/slots/generate")
    .set(authHeader(ch.token))
    .send({ centreTestId: centreTest.id, startDate, endDate, capacity: 5 });

  return { ch, centre, test, centreTest, startDate, endDate };
}

/** Get the first available slot for a centreTestId */
export async function getFirstSlot(centreTestId, patientToken) {
  const app = await getApp();
  const res = await request(app)
    .get(`/api/v1/discover/slots/${centreTestId}`)
    .set(authHeader(patientToken));
  return res.body.slots?.[0] ?? null;
}

/** Build a PENDING booking */
export async function buildBookingFixture() {
  const fixture = await buildCentreFixture();
  const patient = await registerUser("PATIENT");
  const slot    = await getFirstSlot(fixture.centreTest.id, patient.token);

  const app = await getApp();
  const res = await request(app)
    .post("/api/v1/bookings")
    .set(authHeader(patient.token))
    .send({ slotId: slot.id });

  return { ...fixture, patient, slot, booking: res.body.booking };
}

// ─────────────────────────────────────────
// Date helpers
// ─────────────────────────────────────────
export function futureDate(daysAhead = 30) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().split("T")[0];
}
