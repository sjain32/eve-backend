# ─────────────────────────────────────────────────────────────
# Stage 1 — deps
# Install production dependencies only (no devDeps)
# ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps

WORKDIR /app

COPY package*.json ./
# Install only production deps — devDeps are not needed at runtime
RUN npm ci --omit=dev

# ─────────────────────────────────────────────────────────────
# Stage 2 — build
# Copy source and generate Prisma client
# ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS build

WORKDIR /app

# Need devDeps here for prisma CLI
COPY package*.json ./
RUN npm ci

COPY src/ ./src/

# Generate Prisma client targeting the correct binary for Alpine/Linux
RUN npx prisma generate --schema=src/prisma/schema.prisma

# ─────────────────────────────────────────────────────────────
# Stage 3 — runner (minimal final image)
# ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

# Security: run as non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Copy production node_modules from deps stage
COPY --from=deps  --chown=appuser:appgroup /app/node_modules  ./node_modules

# Copy generated Prisma client (overwrites the one in node_modules)
COPY --from=build --chown=appuser:appgroup /app/node_modules/.prisma ./node_modules/.prisma

# Copy application source
COPY --chown=appuser:appgroup src/ ./src/
COPY --chown=appuser:appgroup package.json ./

# Expose the application port
EXPOSE 3000

# Health check — Docker will restart the container if this fails
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

# Start the server
CMD ["node", "src/server.js"]
