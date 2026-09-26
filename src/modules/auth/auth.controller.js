import * as authService from "./auth.service.js";

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

/** Extract the real client IP, honouring reverse-proxy headers */
function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0]?.trim() ?? req.socket.remoteAddress ?? "";
  }
  return req.socket.remoteAddress ?? "";
}

/** Collect userAgent and IP from the request */
function buildMeta(req) {
  const meta = {};
  const ua = req.headers["user-agent"];
  if (ua !== undefined) meta.userAgent = ua;
  const ip = getClientIp(req);
  if (ip) meta.ipAddress = ip;
  return meta;
}

// ─────────────────────────────────────────
// POST /auth/register
// ─────────────────────────────────────────

export async function registerHandler(req, res) {
  const result = await authService.register(req.body, buildMeta(req));

  res.status(201).json({
    message: "Account created successfully",
    user: result.user,         // { id, name, email, role }
    sessionId: result.sessionId,
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
  });
}

// ─────────────────────────────────────────
// POST /auth/login
// ─────────────────────────────────────────

export async function loginHandler(req, res) {
  const result = await authService.login(req.body, buildMeta(req));

  res.status(200).json({
    message: "Login successful",
    user: result.user,         // { id, name, email, role }
    sessionId: result.sessionId,
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
  });
}

// ─────────────────────────────────────────
// POST /auth/logout
// ─────────────────────────────────────────

export async function logoutHandler(req, res) {
  const sessionId = req.user?.sessionId;
  if (sessionId) {
    await authService.logout(sessionId);
  }
  res.status(200).json({ message: "Logged out successfully" });
}

// ─────────────────────────────────────────
// POST /auth/refresh
// ─────────────────────────────────────────

export async function refreshHandler(req, res) {
  const { refreshToken } = req.body;
  const tokens = await authService.refreshTokens(refreshToken, buildMeta(req));

  res.status(200).json({
    message: "Tokens refreshed successfully",
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  });
}

// ─────────────────────────────────────────
// GET /auth/me  (protected)
// ─────────────────────────────────────────

export async function meHandler(req, res) {
  // req.user is set by authenticate middleware: { id, name, email, role, sessionId }
  res.status(200).json({ user: req.user });
}
