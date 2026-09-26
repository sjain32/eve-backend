# Eve — Diagnostic Booking Platform

A production-ready REST API for booking diagnostic tests at diagnostic centres.  
Built with **Node.js (ESM)**, **Express v5**, **Prisma ORM**, and **PostgreSQL**.

---

## Table of Contents

1. [Tech Stack](#tech-stack)  
2. [Architecture Overview](#architecture-overview)  
3. [Database Schema Design](#database-schema-design)  
4. [How to Run Locally](#how-to-run-locally)  
   - [Option A — Local PostgreSQL via Docker Compose](#option-a--local-postgresql-via-docker-compose)  
   - [Option B — External DB (Neon / Supabase)](#option-b--external-db-neon--supabase)  
5. [Environment Variables](#environment-variables)  
6. [API Endpoints](#api-endpoints)  
   - [Auth](#auth)  
   - [Centres (CENTRE_HEAD)](#centres-centre_head)  
   - [Tests (CENTRE_HEAD)](#tests-centre_head)  
   - [Slots (CENTRE_HEAD)](#slots-centre_head)  
   - [Discovery (All users)](#discovery-all-users)  
   - [Bookings (PATIENT)](#bookings-patient)  
   - [Payments (PATIENT + Webhook)](#payments-patient--webhook)  
7. [Authentication Flow](#authentication-flow)  
8. [Running Tests](#running-tests)  
9. [Docker](#docker)  
10. [Important Assumptions](#important-assumptions)  
11. [What I Would Improve](#what-i-would-improve)  

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Runtime | Node.js 22 (ESM) | Native ESM, `--watch` flag, no compile step |
| Framework | Express v5 | Async error propagation built-in |
| ORM | Prisma v5 | Type-safe queries, migrations, studio |
| Database | PostgreSQL 16 | ACID, UUID PKs, JSONB for webhook payloads |
| Auth | JWT + server-side sessions | Short-lived access tokens + revocable sessions |
| Password hashing | bcrypt | Industry standard, configurable cost factor |
| Validation | Zod v4 | Schema-first validation with good error messages |
| Logging | pino + pino-http | Structured JSON logs, low overhead |
| Rate limiting | express-rate-limit | IP-based global + per-route limits |
| API Docs | swagger-ui-express | Interactive docs at `/api-docs` |
| Tests | vitest + supertest | Fast, ESM-native, real DB integration tests |
| Containerisation | Docker + Compose | Multi-stage build, non-root user |

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────┐
│                     Express App                        │
│                                                        │
│  helmet → CORS → pino-http → rate-limit → routes       │
│                                                        │
│  /api/v1/auth      → auth module                       │
│  /api/v1/centres   → centres module  (CENTRE_HEAD)     │
│  /api/v1/tests     → tests module    (CENTRE_HEAD)     │
│  /api/v1/slots     → slots module    (CENTRE_HEAD)     │
│  /api/v1/discover  → discovery module (ALL)            │
│  /api/v1/bookings  → bookings module  (PATIENT)        │
│  /api/v1/payments  → payments module  (PATIENT+hook)   │
│  /api-docs         → Swagger UI                        │
│  /health           → health check                      │
└────────────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────┐
│                  Prisma ORM                            │
│         (connection pooling, migrations)               │
└────────────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────┐
│              PostgreSQL 16                             │
└────────────────────────────────────────────────────────┘

Background:
  webhookRetryWorker — polls every 30 s for failed webhooks,
  retries with exponential back-off (30s → 2m → 10m → 1h → 6h)
```

---

## Database Schema Design

### Entity Relationship

```
User (1) ──────────────── (N) Session
User (1) ──────────────── (N) Booking
User (1) ──────────────── (N) DiagnosticCentre  [ownerId]

DiagnosticCentre (1) ──── (N) CentreTest
Test             (1) ──── (N) CentreTest
CentreTest       (1) ──── (N) TimeSlot
TimeSlot         (1) ──── (N) Booking
Booking          (1) ──── (1) Payment

WebhookEvent — standalone idempotency ledger
```

### Tables

| Table | Purpose |
|---|---|
| `users` | Accounts with `role` = `PATIENT` or `CENTRE_HEAD` |
| `sessions` | One row per active login; stores hashed refresh token; deleted on logout |
| `diagnostic_centres` | Owned by a `CENTRE_HEAD`; has name + location |
| `tests` | Global test catalogue (e.g. "CBC", "Lipid Panel") |
| `centre_tests` | Links a centre to a test with a price; can be deactivated |
| `time_slots` | Bookable slots per `centre_test` per date/time; tracks `bookedCount` vs `capacity` |
| `bookings` | Patient appointment; snaps price at booking time; statuses: `PENDING → CONFIRMED / FAILED / CANCELLED` |
| `payments` | One per booking; `providerRefId` unique for dedup; statuses: `PENDING / SUCCESS / FAILED` |
| `webhook_events` | Idempotency ledger; stores `eventId` (unique), raw payload, retry tracking fields |

### Key Design Decisions

- **UUID primary keys** everywhere — safe for distributed inserts, no enumeration
- **Soft-delete via `isActive`** on `CentreTest` — preserves history for existing bookings
- **`bookedCount` counter** on `TimeSlot` — avoids full `COUNT(*)` on every booking check
- **Refresh token stored as bcrypt hash** — a leaked DB row cannot be replayed
- **`webhookEvent.eventId` unique index** — database-enforced idempotency, not application-level
- **Booking amount snapshot** — price stored at booking time, immune to future price changes

---

## How to Run Locally

### Prerequisites

- Node.js 20+ (recommend 22)
- npm 10+
- PostgreSQL 14+ **OR** Docker Desktop

---

### Option A — Local PostgreSQL via Docker Compose

The fastest path — PostgreSQL runs in Docker, your code runs on the host.

**1. Clone and install:**
```bash
git clone <repo-url>
cd backend
npm install
```

**2. Create your environment file:**
```bash
cp .env.example src/config/.env
```

Edit `src/config/.env` — set:
```
DATABASE_URL="postgresql://eve:eve_secret@localhost:5432/eve_db?schema=public"
```

Generate JWT secrets:
```bash
node -e "require('crypto').randomBytes(64).toString('hex')"
# Run twice — one for JWT_ACCESS_SECRET, one for JWT_REFRESH_SECRET
```

**3. Start PostgreSQL:**
```bash
docker compose up postgres -d
```

**4. Run migrations:**
```bash
npm run db:migrate
```

**5. Start the API:**
```bash
npm run dev
```

Server is live at **http://localhost:3000**  
Swagger UI at **http://localhost:3000/api-docs**

---

### Option B — External DB (Neon / Supabase)

**1. Clone and install:**
```bash
git clone <repo-url>
cd backend
npm install
```

**2. Create your environment file:**
```bash
cp .env.example src/config/.env
```

Edit `src/config/.env` with your hosted DB connection string and JWT secrets.

**3. Run migrations:**
```bash
npm run db:migrate
```

**4. Start the API:**
```bash
npm run dev
```

---

### Option C — Full Docker Compose (API + PostgreSQL)

Runs everything in containers.

**1. Create a `.env` file at the project root:**
```bash
cp .env.example .env
# Edit .env — set JWT_ACCESS_SECRET and JWT_REFRESH_SECRET
```

**2. Build and start:**
```bash
docker compose up --build
```

The API is available at **http://localhost:3000**

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `3000` | HTTP server port |
| `NODE_ENV` | No | `development` | `development` or `production` |
| `DATABASE_URL` | **Yes** | — | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | **Yes** | — | 64-byte hex secret for access tokens |
| `JWT_REFRESH_SECRET` | **Yes** | — | 64-byte hex secret for refresh tokens |
| `JWT_ACCESS_EXPIRES_IN` | No | `15m` | Access token lifetime |
| `JWT_REFRESH_EXPIRES_IN` | No | `7d` | Refresh token lifetime |
| `ALLOWED_ORIGINS` | No | `http://localhost:5173` | Comma-separated CORS whitelist |
| `BCRYPT_ROUNDS` | No | `12` | bcrypt cost factor |
| `LOG_LEVEL` | No | `debug` (dev) / `info` (prod) | pino log level |

---

## API Endpoints

All endpoints are prefixed with `/api/v1`.  
Protected routes require: `Authorization: Bearer <accessToken>`

### Auth

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | None | Register new account (`role`: `PATIENT` or `CENTRE_HEAD`) |
| `POST` | `/auth/login` | None | Login, receive access + refresh tokens |
| `POST` | `/auth/refresh` | None | Exchange refresh token for new token pair |
| `POST` | `/auth/logout` | ✅ | Revoke current session |
| `GET` | `/auth/me` | ✅ | Get current user profile |

**Register example:**
```json
POST /api/v1/auth/register
{
  "name": "Dr. Ahmed Hassan",
  "email": "ahmed@healthfirst.com",
  "password": "CentreHead@1",
  "role": "CENTRE_HEAD"
}
```

**Password rules:** min 8 chars, must contain uppercase, lowercase, digit, and special character (`@$!%*?&^#`).

---

### Centres (CENTRE_HEAD)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/centres` | Create a diagnostic centre |
| `GET` | `/centres/my` | List my centres (paginated `?page=&limit=`) |
| `GET` | `/centres/:id` | Get centre detail with active tests |
| `PATCH` | `/centres/:id` | Update name or location |
| `GET` | `/centres/bookings/all` | View all bookings across all my centres (paginated) |
| `GET` | `/centres/:id/bookings` | View bookings for a specific centre (paginated) |

---

### Tests (CENTRE_HEAD)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/tests` | Create a test in the global catalogue |
| `GET` | `/tests` | List all tests (paginated) |
| `POST` | `/tests/centre/:centreId` | Add a test to a centre with a price |
| `GET` | `/tests/centre/:centreId` | List all tests offered by a centre |
| `PATCH` | `/tests/centre/:centreId/:centreTestId` | Update price or active status |
| `DELETE` | `/tests/centre/:centreId/:centreTestId` | Deactivate a test from a centre |

**Add test to centre example:**
```json
POST /api/v1/tests/centre/{centreId}
{
  "testId": "uuid-of-master-test",
  "price": 149.99
}
```

---

### Slots (CENTRE_HEAD)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/slots/generate` | Generate slots — AUTO (09:00–18:30, 30-min intervals) or MANUAL |
| `GET` | `/slots/:centreTestId` | List slots (`?date=` or `?from=&to=`) |
| `DELETE` | `/slots` | Delete unbooked slots for a date range |

**Auto-generate slots (20 per day — 09:00, 09:30 … 18:00, 18:30):**
```json
POST /api/v1/slots/generate
{
  "centreTestId": "uuid",
  "startDate": "2027-06-01",
  "endDate": "2027-06-07",
  "capacity": 3
}
```

**Manual slots on specific times:**
```json
POST /api/v1/slots/generate
{
  "centreTestId": "uuid",
  "startDate": "2027-06-01",
  "slots": ["08:00", "10:00", "14:00", "16:00"],
  "capacity": 2
}
```

---

### Discovery (All users)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/discover/centres` | Browse all centres (`?name=&location=&page=&limit=`) |
| `GET` | `/discover/centres/:id` | Get a centre with all active tests and prices |
| `GET` | `/discover/slots/:centreTestId` | Get available slots (`?date=` or `?from=&to=`) |

---

### Bookings (PATIENT)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/bookings` | Book a slot |
| `GET` | `/bookings` | List my bookings (paginated) |
| `GET` | `/bookings/:id` | Get booking detail |
| `PATCH` | `/bookings/:id/cancel` | Cancel booking (not within 2 hours of appointment) |

**Booking statuses:** `PENDING` → `CONFIRMED` (after payment) / `FAILED` (payment failed) / `CANCELLED` (patient cancelled)

**Book a slot:**
```json
POST /api/v1/bookings
{
  "slotId": "uuid-of-available-slot"
}
```

---

### Payments (PATIENT + Webhook)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/payments` | ✅ PATIENT | Initiate payment for a PENDING booking |
| `GET` | `/payments/:bookingId` | ✅ PATIENT | Get payment status |
| `POST` | `/payments/webhook` | None | Receive payment update from provider (idempotent) |

**Initiate payment:**
```json
POST /api/v1/payments
{
  "bookingId": "uuid"
}
```

Simulated: 80% SUCCESS → booking becomes `CONFIRMED`, 20% FAILED → booking becomes `FAILED`.

**Webhook payload:**
```json
POST /api/v1/payments/webhook
{
  "eventId":       "evt_unique_dedup_key",
  "providerRefId": "PAY-ABC123",
  "status":        "SUCCESS",
  "bookingId":     "uuid",
  "amount":        149.99
}
```

Webhook outcomes: `PROCESSED`, `ALREADY_TERMINAL`, `BOOKING_NOT_FOUND`, `PROVIDER_REF_MISMATCH`, or `alreadyProcessed: true` (duplicate `eventId`).

---

## Authentication Flow

```
1. POST /auth/register  →  { accessToken, refreshToken, sessionId }
2. Use accessToken in Authorization: Bearer <token>
3. Access tokens expire in 15 min
4. POST /auth/refresh with refreshToken  →  new { accessToken, refreshToken }
   (old session deleted, new one created — token rotation)
5. POST /auth/logout  →  session row deleted, all tokens immediately invalid
```

**Dual-layer verification on every protected request:**
1. JWT signature + expiry check (stateless, fast)
2. Session row lookup in DB (stateful, revocable)

Both must pass. Logout is instant because deleting the session row invalidates the token before it naturally expires.

---

## Running Tests

Tests are integration tests — they run against a real PostgreSQL database. Make sure `DATABASE_URL` is set in `src/config/.env` before running.

```bash
# Run all tests once
npm test

# Watch mode (re-runs on file change)
npm run test:watch

# With coverage report
npm run test:coverage
```

**Test suites:**

| Suite | File | Cases | What it covers |
|---|---|---|---|
| Auth | `auth.test.js` | 16 | Register, login, me, logout, refresh, all error paths |
| Centres | `centres.test.js` | 12 | CRUD, ownership, pagination, role guards |
| Tests | `tests.test.js` | 12 | Catalogue CRUD, add/update/remove from centre |
| Slots | `slots.test.js` | 10 | Auto/manual generate, skipDuplicates, list, delete |
| Discovery | `discovery.test.js` | 8 | Search, pagination, centre detail, available slots |
| Bookings | `bookings.test.js` | 13 | Create, list, get, cancel, 2hr window, capacity, duplicate |
| Payments | `payments.test.js` | 12 | Initiate, idempotency, all webhook outcomes |
| Paginate | `paginate.test.js` | 12 | Unit tests — no DB required |
| **Total** | | **95** | |

---

## Docker

### Run with Docker Compose (API + PostgreSQL)

```bash
# 1. Copy and configure environment
cp .env.example .env
# Edit .env — fill in JWT_ACCESS_SECRET and JWT_REFRESH_SECRET

# 2. Build and start
docker compose up --build

# 3. In another terminal — run migrations inside the container
docker compose exec api npx prisma migrate deploy --schema=src/prisma/schema.prisma

# 4. Stop
docker compose down

# 5. Stop and wipe DB volume
docker compose down -v
```

### Build the image standalone

```bash
docker build -t eve-api .
docker run -p 3000:3000 --env-file .env eve-api
```

---

## Important Assumptions

1. **Single currency / no tax** — prices are stored as `DECIMAL(10,2)` in the platform's base currency. No tax or currency conversion logic is applied.

2. **Simulated payment gateway** — `POST /payments` calls `Math.random()` (80% SUCCESS / 20% FAILED) instead of a real provider. The webhook endpoint exists to receive callbacks from a real provider and is fully idempotent.

3. **Diagnostic centre = CENTRE_HEAD** — one user owns one or more centres. There is no concept of staff accounts or multi-admin per centre.

4. **No patient profile** — beyond name and email there is no patient medical record, insurance, or ID number stored. The platform is a scheduling layer only.

5. **Slot times are in UTC** — `slotDate` is a date-only field and `startTime` is anchored to `1970-01-01` (time-only). Consumers are expected to handle timezone display themselves.

6. **2-hour cancellation window is absolute** — based on UTC `now()`. No grace period or exceptions.

7. **No email notifications** — registration, booking confirmation, and cancellation do not send emails. This would be a natural next step.

8. **No refresh token reuse detection beyond session lookup** — if a refresh token is stolen and used before the legitimate user, the attacker gets a new session. The legitimate user's next refresh attempt will detect the missing session and fail.

9. **Rate limits are in-memory** — `express-rate-limit` uses an in-memory store. In a multi-instance deployment this would need Redis as the backing store.

10. **Tests run against the real database** — not a test fixture DB. `cleanDb()` deletes all rows after each test file. Not suitable for running against production.

---

## What I Would Improve

### Short term (next sprint)

| Item | Detail |
|---|---|
| **Email notifications** | Send booking confirmation, cancellation, and payment receipt via SendGrid / Resend |
| **Redis for rate limiting** | Replace in-memory store so limits work correctly across multiple API instances |
| **Webhook signature verification** | Verify HMAC-SHA256 signature from provider on every webhook call |
| **Refresh token reuse detection** | Flag and invalidate all sessions when a consumed refresh token is replayed |
| **Test isolation** | Dedicated test database instead of wiping the shared DB after each suite |

### Medium term

| Item | Detail |
|---|---|
| **Patient profile** | Phone number, date of birth for pre-appointment form |
| **Multi-timezone slots** | Store centre timezone alongside slots; display in patient's local time |
| **Admin role** | Platform-level admin to manage the global test catalogue without being a CENTRE_HEAD |
| **Cancellation policy per centre** | Let centre heads configure their own cancellation window (not just 2 hours) |
| **Overbooking waitlist** | Queue patients when a slot is full; auto-confirm if someone cancels |
| **CI/CD pipeline** | GitHub Actions: lint → test → build Docker image → push to registry → deploy |

### Architecture

| Item | Detail |
|---|---|
| **Message queue for webhooks** | Replace polling worker with a proper queue (BullMQ + Redis) for webhook delivery and retry |
| **Read replicas** | Direct heavy read queries (discovery, bookings list) to a read replica |
| **Observability** | OpenTelemetry traces + Prometheus metrics + Grafana dashboard |
| **Cursor-based pagination** | Replace offset pagination with cursor-based for large result sets |
