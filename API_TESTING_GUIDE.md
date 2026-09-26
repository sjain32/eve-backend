# Eve Platform — Full Postman Testing Guide

**Base URL:** `http://localhost:3000/api/v1`  
**All protected routes need:** `Authorization: Bearer <token>` header  
**Content-Type:** `application/json` on all POST / PATCH / DELETE with a body

---

# ══════════════════════════════════════
# PHASE 1 — CENTRE HEAD FLOW
# ══════════════════════════════════════

## Step 1 — Register as Centre Head

```
POST http://localhost:3000/api/v1/auth/register
```
```json
{
  "name": "Dr. Ahmed Khan",
  "email": "ahmed@healthfirst.com",
  "password": "Centre@1234",
  "role": "CENTRE_HEAD"
}
```
**Expected:** `201` — save the `accessToken` as `centreHeadToken`

---

## Step 2 — Login as Centre Head

```
POST http://localhost:3000/api/v1/auth/login
```
```json
{
  "email": "ahmed@healthfirst.com",
  "password": "Centre@1234"
}
```
**Expected:** `200` — save `accessToken` as `centreHeadToken`, save `refreshToken`

---

## Step 3 — Get Current Centre Head Profile

```
GET http://localhost:3000/api/v1/auth/me
Authorization: Bearer {{centreHeadToken}}
```
**Expected:** `200` — user object with `role: "CENTRE_HEAD"`

---

## Step 4 — Create a Diagnostic Centre

```
POST http://localhost:3000/api/v1/centres
Authorization: Bearer {{centreHeadToken}}
```
```json
{
  "name": "HealthFirst Diagnostics",
  "location": "123 Main Street, Dubai, UAE"
}
```
**Expected:** `201` — save the returned `id` as `centreId`

---

## Step 5 — Create a Second Centre (optional, tests multi-centre)

```
POST http://localhost:3000/api/v1/centres
Authorization: Bearer {{centreHeadToken}}
```
```json
{
  "name": "MediScan Labs",
  "location": "456 Sheikh Zayed Road, Abu Dhabi, UAE"
}
```
**Expected:** `201` — save as `centreId2`

---

## Step 6 — List All My Centres

```
GET http://localhost:3000/api/v1/centres/my
Authorization: Bearer {{centreHeadToken}}
```
**Expected:** `200` — array of both centres

---

## Step 7 — Get One Centre (full detail)

```
GET http://localhost:3000/api/v1/centres/{{centreId}}
Authorization: Bearer {{centreHeadToken}}
```
**Expected:** `200` — centre details with empty `centreTests` array for now

---

## Step 8 — Update a Centre

```
PATCH http://localhost:3000/api/v1/centres/{{centreId}}
Authorization: Bearer {{centreHeadToken}}
```
```json
{
  "location": "789 Business Bay, Dubai, UAE"
}
```
**Expected:** `200` — updated location

---

## Step 9 — Create Master Tests (Global Catalogue)

### Test A — Complete Blood Count
```
POST http://localhost:3000/api/v1/tests
Authorization: Bearer {{centreHeadToken}}
```
```json
{
  "name": "Complete Blood Count",
  "description": "Full CBC panel — RBC, WBC, haemoglobin, platelets"
}
```
**Expected:** `201` — save `id` as `testId_CBC`

### Test B — Lipid Profile
```
POST http://localhost:3000/api/v1/tests
Authorization: Bearer {{centreHeadToken}}
```
```json
{
  "name": "Lipid Profile",
  "description": "Cholesterol, HDL, LDL, triglycerides"
}
```
**Expected:** `201` — save `id` as `testId_Lipid`

### Test C — Blood Glucose
```
POST http://localhost:3000/api/v1/tests
Authorization: Bearer {{centreHeadToken}}
```
```json
{
  "name": "Blood Glucose Fasting",
  "description": "Fasting blood sugar level measurement"
}
```
**Expected:** `201` — save `id` as `testId_Glucose`

---

## Step 10 — List All Master Tests

```
GET http://localhost:3000/api/v1/tests
Authorization: Bearer {{centreHeadToken}}
```
**Expected:** `200` — all 3 tests in alphabetical order

---

## Step 11 — Add Tests to Centre (create listings with prices)

### Add CBC to Centre 1
```
POST http://localhost:3000/api/v1/tests/centre/{{centreId}}
Authorization: Bearer {{centreHeadToken}}
```
```json
{
  "testId": "{{testId_CBC}}",
  "price": 149.99
}
```
**Expected:** `201` — save the listing `id` as `centreTestId_CBC`

### Add Lipid Profile to Centre 1
```
POST http://localhost:3000/api/v1/tests/centre/{{centreId}}
Authorization: Bearer {{centreHeadToken}}
```
```json
{
  "testId": "{{testId_Lipid}}",
  "price": 199.00
}
```
**Expected:** `201` — save `id` as `centreTestId_Lipid`

### Add Blood Glucose to Centre 1
```
POST http://localhost:3000/api/v1/tests/centre/{{centreId}}
Authorization: Bearer {{centreHeadToken}}
```
```json
{
  "testId": "{{testId_Glucose}}",
  "price": 89.50
}
```
**Expected:** `201` — save `id` as `centreTestId_Glucose`

---

## Step 12 — List Tests Offered by Centre 1

```
GET http://localhost:3000/api/v1/tests/centre/{{centreId}}
Authorization: Bearer {{centreHeadToken}}
```
**Expected:** `200` — 3 listings each with test info + price + `isActive: true`

---

## Step 13 — Update a Test Listing Price

```
PATCH http://localhost:3000/api/v1/tests/centre/{{centreId}}/{{centreTestId_CBC}}
Authorization: Bearer {{centreHeadToken}}
```
```json
{
  "price": 129.99
}
```
**Expected:** `200` — updated price

---

## Step 14 — Deactivate a Test Listing (soft remove)

```
DELETE http://localhost:3000/api/v1/tests/centre/{{centreId}}/{{centreTestId_Glucose}}
Authorization: Bearer {{centreHeadToken}}
```
**Expected:** `200` — `isActive: false`

> After this, patients will NOT see Blood Glucose when browsing.

---

## Step 15 — Re-add a Deactivated Test (upsert re-activates it)

```
POST http://localhost:3000/api/v1/tests/centre/{{centreId}}
Authorization: Bearer {{centreHeadToken}}
```
```json
{
  "testId": "{{testId_Glucose}}",
  "price": 79.99
}
```
**Expected:** `201` — same listing re-activated with new price

---

## Step 16 — Generate Slots (AUTO mode — 09:00 to 18:30, every 30 min)

```
POST http://localhost:3000/api/v1/slots/generate
Authorization: Bearer {{centreHeadToken}}
```
```json
{
  "centreTestId": "{{centreTestId_CBC}}",
  "startDate": "2026-10-01",
  "endDate": "2026-10-05",
  "capacity": 2
}
```
**Expected:** `201` — `created: 100` (20 slots/day × 5 days)

---

## Step 17 — Generate Slots (MANUAL mode — specific times)

```
POST http://localhost:3000/api/v1/slots/generate
Authorization: Bearer {{centreHeadToken}}
```
```json
{
  "centreTestId": "{{centreTestId_Lipid}}",
  "startDate": "2026-10-01",
  "endDate": "2026-10-05",
  "capacity": 1,
  "slots": ["09:00", "11:00", "14:00", "16:00"]
}
```
**Expected:** `201` — `created: 20` (4 slots/day × 5 days)

---

## Step 18 — List Slots for a Centre-Test (single day)

```
GET http://localhost:3000/api/v1/slots/{{centreTestId_CBC}}?date=2026-10-01
Authorization: Bearer {{centreHeadToken}}
```
**Expected:** `200` — 20 slots for that day with capacity / bookedCount

---

## Step 19 — List Slots for a Centre-Test (date range)

```
GET http://localhost:3000/api/v1/slots/{{centreTestId_CBC}}?from=2026-10-01&to=2026-10-05
Authorization: Bearer {{centreHeadToken}}
```
**Expected:** `200` — 100 slots across 5 days

---

## Step 20 — Delete Unbooked Slots

```
DELETE http://localhost:3000/api/v1/slots
Authorization: Bearer {{centreHeadToken}}
```
```json
{
  "centreTestId": "{{centreTestId_CBC}}",
  "startDate": "2026-10-05",
  "endDate": "2026-10-05"
}
```
**Expected:** `200` — `deleted: 20` (day 5 removed, days 1–4 untouched)

---

## Step 21 — Re-generate the Deleted Day

```
POST http://localhost:3000/api/v1/slots/generate
Authorization: Bearer {{centreHeadToken}}
```
```json
{
  "centreTestId": "{{centreTestId_CBC}}",
  "startDate": "2026-10-05",
  "endDate": "2026-10-05",
  "capacity": 2
}
```
**Expected:** `201` — `created: 20`, `skipped: 0`

---

## Step 22 — Run Same Generate Again (test skipDuplicates)

Send the exact same body as Step 21 again.  
**Expected:** `201` — `created: 0`, `skipped: 20` — no duplicate slots created

---

# ══════════════════════════════════════
# PHASE 2 — PATIENT FLOW
# ══════════════════════════════════════

## Step 23 — Register as Patient

```
POST http://localhost:3000/api/v1/auth/register
```
```json
{
  "name": "Jane Patient",
  "email": "jane@example.com",
  "password": "Patient@1234"
}
```
**Expected:** `201` — save `accessToken` as `patientToken`

---

## Step 24 — Login as Patient

```
POST http://localhost:3000/api/v1/auth/login
```
```json
{
  "email": "jane@example.com",
  "password": "Patient@1234"
}
```
**Expected:** `200` — save `accessToken` as `patientToken`

---

## Step 25 — Get Patient Profile

```
GET http://localhost:3000/api/v1/auth/me
Authorization: Bearer {{patientToken}}
```
**Expected:** `200` — `role: "PATIENT"`

---

## Step 26 — Browse All Centres (no filter)

```
GET http://localhost:3000/api/v1/discover/centres
Authorization: Bearer {{patientToken}}
```
**Expected:** `200` — array of all centres with active test count

---

## Step 27 — Search Centres by Name

```
GET http://localhost:3000/api/v1/discover/centres?name=health
Authorization: Bearer {{patientToken}}
```
**Expected:** `200` — filtered to centres whose name contains "health"

---

## Step 28 — Search Centres by Location

```
GET http://localhost:3000/api/v1/discover/centres?location=dubai
Authorization: Bearer {{patientToken}}
```
**Expected:** `200` — filtered by location

---

## Step 29 — Get Centre Detail with All Tests and Prices

```
GET http://localhost:3000/api/v1/discover/centres/{{centreId}}
Authorization: Bearer {{patientToken}}
```
**Expected:** `200` — centre info + array of `centreTests` each with:
- `id` → this is the `centreTestId` needed for slot lookup
- `price`
- `test.name`, `test.description`

---

## Step 30 — Get Available Slots for a Test (single day)

```
GET http://localhost:3000/api/v1/discover/slots/{{centreTestId_CBC}}?date=2026-10-01
Authorization: Bearer {{patientToken}}
```
**Expected:** `200` — array of available slots with `spotsLeft`  
> Copy a slot `id` — save as `slotId`

---

## Step 31 — Get Available Slots for a Test (date range)

```
GET http://localhost:3000/api/v1/discover/slots/{{centreTestId_Lipid}}?from=2026-10-01&to=2026-10-03
Authorization: Bearer {{patientToken}}
```
**Expected:** `200` — available slots across 3 days

---

## Step 32 — Book a Slot

```
POST http://localhost:3000/api/v1/bookings
Authorization: Bearer {{patientToken}}
```
```json
{
  "slotId": "{{slotId}}"
}
```
**Expected:** `201` — booking with `status: "PENDING"`, save `id` as `bookingId`

---

## Step 33 — Try to Book the Same Slot Again (duplicate guard)

Send the exact same body as Step 32.  
**Expected:** `409` — "You have already booked this slot"

---

## Step 34 — List My Bookings

```
GET http://localhost:3000/api/v1/bookings
Authorization: Bearer {{patientToken}}
```
**Expected:** `200` — array with full booking detail (centre, test, date, time, amount, status)

---

## Step 35 — Get One Booking

```
GET http://localhost:3000/api/v1/bookings/{{bookingId}}
Authorization: Bearer {{patientToken}}
```
**Expected:** `200` — full booking detail

---

## Step 36 — Pay for the Booking

```
POST http://localhost:3000/api/v1/payments
Authorization: Bearer {{patientToken}}
```
```json
{
  "bookingId": "{{bookingId}}"
}
```
**Expected:**
- `200` if SUCCESS → booking `status: "CONFIRMED"` — save `providerRefId`
- `402` if FAILED → booking `status: "FAILED"` — create a new booking and retry

> Payment is simulated: **80% SUCCESS / 20% FAILED**

---

## Step 37 — Check Payment Status

```
GET http://localhost:3000/api/v1/payments/{{bookingId}}
Authorization: Bearer {{patientToken}}
```
**Expected:** `200` — payment record with `providerRefId`, `amount`, `status`

---

## Step 38 — Try to Pay Again on a Confirmed Booking (guard test)

Send the same body as Step 36 again.  
**Expected:** `409` — "A payment already exists for this booking"

---

## Step 39 — Book Another Slot for Cancellation Test

Pick a slot far in the future (> 2 hours away):
```
POST http://localhost:3000/api/v1/bookings
Authorization: Bearer {{patientToken}}
```
```json
{
  "slotId": "<a different slotId from Step 30 or 31>"
}
```
**Expected:** `201` — save `id` as `bookingId2`

---

## Step 40 — Cancel the Booking (should succeed — > 2 hrs away)

```
PATCH http://localhost:3000/api/v1/bookings/{{bookingId2}}/cancel
Authorization: Bearer {{patientToken}}
```
No body.  
**Expected:** `200` — `status: "CANCELLED"`, slot capacity released

---

## Step 41 — Try to Cancel an Already-Cancelled Booking

Send the same request as Step 40 again.  
**Expected:** `400` — "Cannot cancel a booking with status CANCELLED"

---

## Step 42 — Try to Cancel Someone Else's Booking (role guard)

Use `centreHeadToken` to try to cancel a patient's booking:
```
PATCH http://localhost:3000/api/v1/bookings/{{bookingId}}/cancel
Authorization: Bearer {{centreHeadToken}}
```
**Expected:** `403` — "Access denied — requires role: PATIENT"

---

# ══════════════════════════════════════
# PHASE 3 — WEBHOOK TESTS (No Auth)
# ══════════════════════════════════════

## Step 43 — Create a Fresh PENDING Booking to Webhook Against

Repeat Step 32 with a **new slot** — do NOT pay via Step 36.  
Save the `bookingId` as `bookingId3`.

---

## Step 44 — Send a SUCCESS Webhook

```
POST http://localhost:3000/api/v1/payments/webhook
```
```json
{
  "eventId": "evt_test_001",
  "providerRefId": "PAY-WEBHOOK001",
  "status": "SUCCESS",
  "bookingId": "{{bookingId3}}",
  "amount": 129.99
}
```
**Expected:** `200` — `outcome: "PROCESSED"`, booking becomes `CONFIRMED`

---

## Step 45 — Send the SAME Webhook Again (idempotency test)

Send the **exact same body** as Step 44 — identical `eventId`.  
**Expected:** `200` — `alreadyProcessed: true` — booking is NOT touched again

---

## Step 46 — Send a FAILED Webhook

Create another PENDING booking (repeat Step 32 with a new slot), save as `bookingId4`. Then:
```
POST http://localhost:3000/api/v1/payments/webhook
```
```json
{
  "eventId": "evt_test_002",
  "providerRefId": "PAY-WEBHOOK002",
  "status": "FAILED",
  "bookingId": "{{bookingId4}}",
  "amount": 129.99
}
```
**Expected:** `200` — `outcome: "PROCESSED"`, booking becomes `FAILED`, slot capacity released

---

## Step 47 — Webhook with Wrong providerRefId (mismatch guard)

First pay for a new booking (Steps 32 + 36) to create a payment row. Then send a webhook with a **different** `providerRefId`:
```
POST http://localhost:3000/api/v1/payments/webhook
```
```json
{
  "eventId": "evt_test_003",
  "providerRefId": "PAY-DIFFERENT-REF",
  "status": "SUCCESS",
  "bookingId": "{{bookingId}}",
  "amount": 129.99
}
```
**Expected:** `200` — `outcome: "PROVIDER_REF_MISMATCH"`

---

## Step 48 — Webhook for Non-existent Booking

```
POST http://localhost:3000/api/v1/payments/webhook
```
```json
{
  "eventId": "evt_test_004",
  "providerRefId": "PAY-GHOST",
  "status": "SUCCESS",
  "bookingId": "00000000-0000-0000-0000-000000000000",
  "amount": 100.00
}
```
**Expected:** `200` — `outcome: "BOOKING_NOT_FOUND"` — no crash

---

## Step 49 — Webhook on Already Terminal Booking

```
POST http://localhost:3000/api/v1/payments/webhook
```
```json
{
  "eventId": "evt_test_005",
  "providerRefId": "PAY-TERMINAL",
  "status": "SUCCESS",
  "bookingId": "{{bookingId3}}",
  "amount": 129.99
}
```
> `bookingId3` is already `CONFIRMED` from Step 44

**Expected:** `200` — `outcome: "ALREADY_TERMINAL"` — booking NOT modified

---

# ══════════════════════════════════════
# PHASE 4 — CENTRE HEAD VIEWS BOOKINGS
# ══════════════════════════════════════

## Step 50 — View All Bookings Across All My Centres

```
GET http://localhost:3000/api/v1/centres/bookings/all
Authorization: Bearer {{centreHeadToken}}
```
**Expected:** `200` — all bookings made by patients at any of this head's centres

---

## Step 51 — View Bookings for a Specific Centre

```
GET http://localhost:3000/api/v1/centres/{{centreId}}/bookings
Authorization: Bearer {{centreHeadToken}}
```
**Expected:** `200` — bookings for that centre with patient name/email, test, date/time, amount, status

---

# ══════════════════════════════════════
# PHASE 5 — AUTH EDGE CASES
# ══════════════════════════════════════

## Step 52 — Refresh Access Token

```
POST http://localhost:3000/api/v1/auth/refresh
```
```json
{
  "refreshToken": "{{refreshToken}}"
}
```
**Expected:** `200` — new `accessToken` + new `refreshToken`

---

## Step 53 — Use Old Token After Logout (session revocation)

First logout:
```
POST http://localhost:3000/api/v1/auth/logout
Authorization: Bearer {{patientToken}}
```
Then immediately use the same token:
```
GET http://localhost:3000/api/v1/auth/me
Authorization: Bearer {{patientToken}}
```
**Expected:** `401` — "Session is invalid or has been revoked"

---

## Step 54 — Patient Tries to Access Centre Head Route

```
POST http://localhost:3000/api/v1/centres
Authorization: Bearer {{patientToken}}
```
```json
{
  "name": "Fake Centre",
  "location": "Nowhere"
}
```
**Expected:** `403` — "Access denied — requires role: CENTRE_HEAD"

---

## Step 55 — Centre Head Tries to Book a Slot

```
POST http://localhost:3000/api/v1/bookings
Authorization: Bearer {{centreHeadToken}}
```
```json
{
  "slotId": "{{slotId}}"
}
```
**Expected:** `403` — "Access denied — requires role: PATIENT"

---

## Step 56 — Request with No Token

```
GET http://localhost:3000/api/v1/bookings
```
No Authorization header.  
**Expected:** `401` — "Authentication required — no token provided"

---

## Step 57 — Request with Malformed Token

```
GET http://localhost:3000/api/v1/auth/me
Authorization: Bearer thisisnotavalidtoken
```
**Expected:** `401` — "Invalid or expired access token"

---

## Step 58 — Validation Error (missing / invalid fields)

```
POST http://localhost:3000/api/v1/auth/register
```
```json
{
  "email": "nodomain",
  "password": "weak"
}
```
**Expected:** `400` — structured `errors` array with field names and messages

---

## Step 59 — Duplicate Email Registration

```
POST http://localhost:3000/api/v1/auth/register
```
```json
{
  "name": "Jane Again",
  "email": "jane@example.com",
  "password": "Patient@1234"
}
```
**Expected:** `409` — "An account with this email already exists"

---

# ══════════════════════════════════════
# QUICK REFERENCE — ALL 31 ENDPOINTS
# ══════════════════════════════════════

| # | Method | Endpoint | Auth | Role |
|---|--------|----------|------|------|
| 1 | GET | `/health` | None | Any |
| 2 | POST | `/auth/register` | None | — |
| 3 | POST | `/auth/login` | None | — |
| 4 | POST | `/auth/refresh` | None | — |
| 5 | GET | `/auth/me` | ✓ | Any |
| 6 | POST | `/auth/logout` | ✓ | Any |
| 7 | POST | `/centres` | ✓ | CENTRE_HEAD |
| 8 | GET | `/centres/my` | ✓ | CENTRE_HEAD |
| 9 | GET | `/centres/:id` | ✓ | CENTRE_HEAD |
| 10 | PATCH | `/centres/:id` | ✓ | CENTRE_HEAD |
| 11 | GET | `/centres/bookings/all` | ✓ | CENTRE_HEAD |
| 12 | GET | `/centres/:id/bookings` | ✓ | CENTRE_HEAD |
| 13 | POST | `/tests` | ✓ | CENTRE_HEAD |
| 14 | GET | `/tests` | ✓ | CENTRE_HEAD |
| 15 | POST | `/tests/centre/:cId` | ✓ | CENTRE_HEAD |
| 16 | GET | `/tests/centre/:cId` | ✓ | CENTRE_HEAD |
| 17 | PATCH | `/tests/centre/:cId/:ctId` | ✓ | CENTRE_HEAD |
| 18 | DELETE | `/tests/centre/:cId/:ctId` | ✓ | CENTRE_HEAD |
| 19 | POST | `/slots/generate` | ✓ | CENTRE_HEAD |
| 20 | GET | `/slots/:centreTestId` | ✓ | CENTRE_HEAD |
| 21 | DELETE | `/slots` | ✓ | CENTRE_HEAD |
| 22 | GET | `/discover/centres` | ✓ | Any |
| 23 | GET | `/discover/centres/:id` | ✓ | Any |
| 24 | GET | `/discover/slots/:ctId` | ✓ | Any |
| 25 | POST | `/bookings` | ✓ | PATIENT |
| 26 | GET | `/bookings` | ✓ | PATIENT |
| 27 | GET | `/bookings/:id` | ✓ | PATIENT |
| 28 | PATCH | `/bookings/:id/cancel` | ✓ | PATIENT |
| 29 | POST | `/payments` | ✓ | PATIENT |
| 30 | GET | `/payments/:bookingId` | ✓ | PATIENT |
| 31 | POST | `/payments/webhook` | None | — |

---

## Postman Environment Variables to Set

| Variable | Where to get it |
|---|---|
| `baseUrl` | `http://localhost:3000/api/v1` |
| `centreHeadToken` | From Step 2 response `accessToken` |
| `patientToken` | From Step 24 response `accessToken` |
| `refreshToken` | From Step 2 or 24 response `refreshToken` |
| `centreId` | From Step 4 response `centre.id` |
| `testId_CBC` | From Step 9A response `test.id` |
| `testId_Lipid` | From Step 9B response `test.id` |
| `testId_Glucose` | From Step 9C response `test.id` |
| `centreTestId_CBC` | From Step 11A response `listing.id` |
| `centreTestId_Lipid` | From Step 11B response `listing.id` |
| `slotId` | From Step 30 response `slots[0].id` |
| `bookingId` | From Step 32 response `booking.id` |
