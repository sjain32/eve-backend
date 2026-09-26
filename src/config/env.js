/**
 * Centralised, validated environment config.
 * Import this instead of accessing process.env directly — it throws at
 * startup if any required variable is missing, catching misconfiguration
 * before the server ever accepts traffic.
 */

function requireEnv(key) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optionalEnv(key, fallback) {
  return process.env[key] ?? fallback;
}

export const env = {
  NODE_ENV: optionalEnv("NODE_ENV", "development"),
  PORT: parseInt(optionalEnv("PORT", "3000"), 10),

  DATABASE_URL: requireEnv("DATABASE_URL"),

  JWT_ACCESS_SECRET: requireEnv("JWT_ACCESS_SECRET"),
  JWT_REFRESH_SECRET: requireEnv("JWT_REFRESH_SECRET"),
  JWT_ACCESS_EXPIRES_IN: optionalEnv("JWT_ACCESS_EXPIRES_IN", "15m"),
  JWT_REFRESH_EXPIRES_IN: optionalEnv("JWT_REFRESH_EXPIRES_IN", "7d"),

  ALLOWED_ORIGINS: optionalEnv("ALLOWED_ORIGINS", "http://localhost:5173")
    .split(",")
    .map((o) => o.trim()),

  BCRYPT_ROUNDS: parseInt(optionalEnv("BCRYPT_ROUNDS", "12"), 10),
};
