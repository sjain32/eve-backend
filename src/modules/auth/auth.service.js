/**
 * Auth Service
 *
 * Security model:
 *  - Passwords hashed with bcrypt (configurable cost factor)
 *  - Short-lived access JWT (default 15 min) signed with ACCESS_SECRET
 *  - Long-lived refresh JWT (default 7 days) signed with REFRESH_SECRET
 *  - Each login creates a Session row; the refresh token is stored as a
 *    bcrypt hash so a compromised DB cannot be replayed
 *  - Logout deletes the session (hard revocation)
 *  - Refresh rotates the token: old session deleted, new one created
 *  - Expired / revoked sessions are rejected at both the session layer
 *    and the JWT layer (dual validation)
 */

import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../../prisma/client.js";
import { env } from "../../config/env.js";
import { AppError } from "../../middlewares/errorhandler.js";

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

/** Convert a JWT duration string like "7d" into a JS Date */
function expiresAtFromDuration(duration) {
  const units = {
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) {
    throw new Error(`Invalid JWT duration format: ${duration}`);
  }
  const amount = parseInt(match[1], 10);
  const multiplier = units[match[2]] ?? 0;
  return new Date(Date.now() + amount * multiplier);
}

function signAccessToken(userId, sessionId) {
  return jwt.sign(
    { sub: userId, sessionId },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN, algorithm: "HS256" }
  );
}

function signRefreshToken(userId, sessionId) {
  return jwt.sign(
    { sub: userId, sessionId },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN, algorithm: "HS256" }
  );
}

export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ["HS256"] });
  } catch {
    throw new AppError("Invalid or expired access token", 401);
  }
}

export function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, env.JWT_REFRESH_SECRET, { algorithms: ["HS256"] });
  } catch {
    throw new AppError("Invalid or expired refresh token", 401);
  }
}

// ─────────────────────────────────────────
// Register
// ─────────────────────────────────────────

export async function register(input, meta) {
  // 1. Check for duplicate email
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });
  if (existing) {
    throw new AppError("An account with this email already exists", 409);
  }

  // 2. Hash password
  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);

  // 3. Create user — role comes from validated input (defaults to PATIENT)
  const user = await prisma.user.create({
    data: { name: input.name, email: input.email, passwordHash, role: input.role },
    select: { id: true, name: true, email: true, role: true },
  });

  // 4. Create session + tokens
  return createSession(user, meta);
}

// ─────────────────────────────────────────
// Login
// ─────────────────────────────────────────

export async function login(input, meta) {
  // 1. Look up user — use a constant-time comparison path regardless of
  //    whether the user exists to mitigate user-enumeration timing attacks
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true, name: true, email: true, role: true, passwordHash: true },
  });

  // Always run bcrypt even on a fake hash so timing is consistent
  const dummyHash = "$2b$12$invalidhashpadding000000000000000000000000000000000000000";
  const isValid = await bcrypt.compare(
    input.password,
    user?.passwordHash ?? dummyHash
  );

  if (!user || !isValid) {
    throw new AppError("Invalid email or password", 401);
  }

  // 2. Strip passwordHash before creating session
  const { passwordHash: _omit, ...safeUser } = user;
  return createSession(safeUser, meta);
}
// ─────────────────────────────────────────

export async function logout(sessionId) {
  // Hard-delete the session row — this is the revocation mechanism.
  // If the row is gone, the refresh token is worthless even if not expired.
  await prisma.session.deleteMany({ where: { id: sessionId } });
}

// ─────────────────────────────────────────
// Refresh tokens
// ─────────────────────────────────────────

export async function refreshTokens(rawRefreshToken, meta) {
  // 1. Verify JWT signature + expiry
  const payload = verifyRefreshToken(rawRefreshToken);
  const userId = payload.sub;
  const sessionId = payload.sessionId;

  // 2. Load session from DB
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
  });

  if (
    !session ||
    session.userId !== userId ||
    session.revokedAt !== null ||
    session.expiresAt < new Date()
  ) {
    // Suspicious — potentially replayed token. Nuke all sessions for safety.
    if (session?.userId) {
      await prisma.session.deleteMany({ where: { userId: session.userId } });
    }
    throw new AppError("Refresh token is invalid or expired", 401);
  }

  // 3. Verify the raw token matches the stored hash (defence-in-depth)
  const hashMatch = await bcrypt.compare(rawRefreshToken, session.refreshTokenHash);
  if (!hashMatch) {
    await prisma.session.deleteMany({ where: { userId } });
    throw new AppError("Refresh token is invalid or expired", 401);
  }

  // 4. Rotate: delete old session, mint new token pair + session
  await prisma.session.delete({ where: { id: sessionId } });

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true },
  });

  const result = await createSession(user, meta);
  return {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
  };
}

// ─────────────────────────────────────────
// Internal: create a session row + token pair
// ─────────────────────────────────────────

async function createSession(user, meta) {
  const { randomUUID } = await import("crypto");
  const sessionId = randomUUID();

  const accessToken = signAccessToken(user.id, sessionId);
  const refreshToken = signRefreshToken(user.id, sessionId);

  // Hash the refresh token before storing — bcrypt to make it irreversible
  const refreshTokenHash = await bcrypt.hash(refreshToken, env.BCRYPT_ROUNDS);
  const expiresAt = expiresAtFromDuration(env.JWT_REFRESH_EXPIRES_IN);

  await prisma.session.create({
    data: {
      id: sessionId,
      userId: user.id,
      refreshTokenHash,
      userAgent: meta?.userAgent ?? null,
      ipAddress: meta?.ipAddress ?? null,
      expiresAt,
    },
  });

  return {
    accessToken,
    refreshToken,
    sessionId,
    user,
  };
}
