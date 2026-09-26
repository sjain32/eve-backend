import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { getApp, registerUser, loginUser, authHeader, cleanDb, uid } from "./helpers/setup.js";

let app;
beforeAll(async () => { app = await getApp(); });
afterAll(async () => { await cleanDb(); });

// ─────────────────────────────────────────
// POST /auth/register
// ─────────────────────────────────────────
describe("POST /api/v1/auth/register", () => {
  it("registers a PATIENT and returns tokens", async () => {
    const ts = uid();
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ name: `Patient ${ts}`, email: `p_${ts}@eve.test`, password: "Test@1234" });

    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeTypeOf("string");
    expect(res.body.refreshToken).toBeTypeOf("string");
    expect(res.body.user.role).toBe("PATIENT");
  });

  it("registers a CENTRE_HEAD with explicit role", async () => {
    const ts = uid();
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ name: `CH ${ts}`, email: `ch_${ts}@eve.test`, password: "Test@1234", role: "CENTRE_HEAD" });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe("CENTRE_HEAD");
  });

  it("rejects duplicate email with 409", async () => {
    const ts  = uid();
    const body = { name: "Dup", email: `dup_${ts}@eve.test`, password: "Test@1234" };
    await request(app).post("/api/v1/auth/register").send(body);
    const res = await request(app).post("/api/v1/auth/register").send(body);
    expect(res.status).toBe(409);
  });

  it("rejects weak password with 400", async () => {
    const ts  = uid();
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ name: "Weak", email: `w_${ts}@eve.test`, password: "weak" });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation failed");
  });

  it("rejects missing name with 400", async () => {
    const ts  = uid();
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ email: `n_${ts}@eve.test`, password: "Test@1234" });
    expect(res.status).toBe(400);
  });

  it("rejects invalid email with 400", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ name: "Bad", email: "not-an-email", password: "Test@1234" });
    expect(res.status).toBe(400);
  });

  it("rejects invalid role with 400", async () => {
    const ts  = uid();
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ name: "Bad", email: `r_${ts}@eve.test`, password: "Test@1234", role: "ADMIN" });
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────
// POST /auth/login
// ─────────────────────────────────────────
describe("POST /api/v1/auth/login", () => {
  it("logs in with correct credentials", async () => {
    const { email, password } = await registerUser("PATIENT");
    const res = await request(app).post("/api/v1/auth/login").send({ email, password });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTypeOf("string");
    expect(res.body.user.role).toBe("PATIENT");
  });

  it("rejects wrong password with 401", async () => {
    const { email } = await registerUser("PATIENT");
    const res = await request(app).post("/api/v1/auth/login").send({ email, password: "Wrong@9999" });
    expect(res.status).toBe(401);
  });

  it("rejects non-existent email with 401 (timing safe)", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "nobody@eve.test", password: "Test@1234" });
    expect(res.status).toBe(401);
  });

  it("rejects missing fields with 400", async () => {
    const res = await request(app).post("/api/v1/auth/login").send({ email: "a@b.com" });
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────
// GET /auth/me
// ─────────────────────────────────────────
describe("GET /api/v1/auth/me", () => {
  it("returns profile for authenticated user", async () => {
    const { token, user } = await registerUser("PATIENT");
    const res = await request(app).get("/api/v1/auth/me").set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(user.email);
    expect(res.body.user.role).toBe("PATIENT");
  });

  it("returns 401 without token", async () => {
    const res = await request(app).get("/api/v1/auth/me");
    expect(res.status).toBe(401);
  });

  it("returns 401 with malformed token", async () => {
    const res = await request(app).get("/api/v1/auth/me").set({ Authorization: "Bearer bad.token.here" });
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────
// POST /auth/refresh
// ─────────────────────────────────────────
describe("POST /api/v1/auth/refresh", () => {
  it("issues new token pair from valid refresh token", async () => {
    const { refreshToken } = await registerUser("PATIENT");
    const res = await request(app).post("/api/v1/auth/refresh").send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTypeOf("string");
    expect(res.body.refreshToken).toBeTypeOf("string");
    // New tokens should differ from old ones
    expect(res.body.refreshToken).not.toBe(refreshToken);
  });

  it("rejects invalid refresh token with 401", async () => {
    const res = await request(app).post("/api/v1/auth/refresh").send({ refreshToken: "bad.token" });
    expect(res.status).toBe(401);
  });

  it("rejects missing refreshToken with 400", async () => {
    const res = await request(app).post("/api/v1/auth/refresh").send({});
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────
// POST /auth/logout
// ─────────────────────────────────────────
describe("POST /api/v1/auth/logout", () => {
  it("logs out and invalidates the session", async () => {
    const { token } = await registerUser("PATIENT");

    const logout = await request(app).post("/api/v1/auth/logout").set(authHeader(token));
    expect(logout.status).toBe(200);

    // Subsequent request with same token should fail
    const me = await request(app).get("/api/v1/auth/me").set(authHeader(token));
    expect(me.status).toBe(401);
  });

  it("requires authentication to logout", async () => {
    const res = await request(app).post("/api/v1/auth/logout");
    expect(res.status).toBe(401);
  });
});
