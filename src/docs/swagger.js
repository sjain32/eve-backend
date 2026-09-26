/**
 * OpenAPI 3.0 specification for the Eve Diagnostic Booking Platform.
 * Mounted at /api-docs via swagger-ui-express in app.js.
 */

export const swaggerSpec = {
  openapi: "3.0.0",
  info: {
    title: "Eve Diagnostic Booking Platform",
    version: "1.0.0",
    description:
      "REST API for booking diagnostic tests at diagnostic centres. " +
      "Two user roles: **PATIENT** (browse & book) and **CENTRE_HEAD** (manage centres, tests, slots).",
    contact: { name: "Eve Platform" },
  },
  servers: [
    { url: "http://localhost:3000/api/v1", description: "Local development" },
  ],

  // ─────────────────────────────────────────
  // Security
  // ─────────────────────────────────────────
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Access token obtained from /auth/login or /auth/register",
      },
    },

    // ── Reusable schemas ────────────────────
    schemas: {
      // ── Auth ────────────────────────────
      RegisterRequest: {
        type: "object",
        required: ["name", "email", "password"],
        properties: {
          name:     { type: "string", example: "Dr. Ahmed Hassan" },
          email:    { type: "string", format: "email", example: "ahmed@healthfirst.com" },
          password: { type: "string", example: "CentreHead@1", description: "Min 8 chars, upper+lower+digit+special" },
          role:     { type: "string", enum: ["PATIENT", "CENTRE_HEAD"], default: "PATIENT" },
        },
      },
      LoginRequest: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email:    { type: "string", format: "email", example: "ahmed@healthfirst.com" },
          password: { type: "string", example: "CentreHead@1" },
        },
      },
      AuthResponse: {
        type: "object",
        properties: {
          message:      { type: "string" },
          user:         { $ref: "#/components/schemas/UserProfile" },
          sessionId:    { type: "string", format: "uuid" },
          accessToken:  { type: "string" },
          refreshToken: { type: "string" },
        },
      },
      UserProfile: {
        type: "object",
        properties: {
          id:    { type: "string", format: "uuid" },
          name:  { type: "string" },
          email: { type: "string" },
          role:  { type: "string", enum: ["PATIENT", "CENTRE_HEAD"] },
        },
      },

      // ── Centres ──────────────────────────
      CreateCentreRequest: {
        type: "object",
        required: ["name", "location"],
        properties: {
          name:     { type: "string", example: "HealthFirst Diagnostics" },
          location: { type: "string", example: "123 Sheikh Zayed Road, Dubai" },
        },
      },
      Centre: {
        type: "object",
        properties: {
          id:        { type: "string", format: "uuid" },
          name:      { type: "string" },
          location:  { type: "string" },
          ownerId:   { type: "string", format: "uuid" },
          createdAt: { type: "string", format: "date-time" },
        },
      },

      // ── Tests ────────────────────────────
      CreateTestRequest: {
        type: "object",
        required: ["name"],
        properties: {
          name:        { type: "string", example: "Complete Blood Count" },
          description: { type: "string", example: "Measures red/white cells and platelets" },
        },
      },
      AddTestToCentreRequest: {
        type: "object",
        required: ["testId", "price"],
        properties: {
          testId: { type: "string", format: "uuid" },
          price:  { type: "number", example: 149.99 },
        },
      },

      // ── Slots ────────────────────────────
      GenerateSlotsRequest: {
        type: "object",
        required: ["centreTestId", "startDate"],
        properties: {
          centreTestId: { type: "string", format: "uuid" },
          startDate:    { type: "string", format: "date", example: "2027-06-01" },
          endDate:      { type: "string", format: "date", example: "2027-06-07" },
          capacity:     { type: "integer", default: 1, example: 3 },
          slots: {
            type: "array",
            items: { type: "string", pattern: "^([01]\\d|2[0-3]):[0-5]\\d$" },
            description: "Manual mode: explicit HH:MM times. Omit for auto 09:00–18:30 every 30 min.",
            example: ["08:00", "10:00", "14:00"],
          },
        },
      },
      Slot: {
        type: "object",
        properties: {
          id:          { type: "string", format: "uuid" },
          slotDate:    { type: "string", format: "date" },
          startTime:   { type: "string" },
          capacity:    { type: "integer" },
          bookedCount: { type: "integer" },
          spotsLeft:   { type: "integer" },
          isFull:      { type: "boolean" },
        },
      },

      // ── Bookings ─────────────────────────
      CreateBookingRequest: {
        type: "object",
        required: ["slotId"],
        properties: {
          slotId: { type: "string", format: "uuid" },
        },
      },
      Booking: {
        type: "object",
        properties: {
          id:        { type: "string", format: "uuid" },
          amount:    { type: "number" },
          status:    { type: "string", enum: ["PENDING", "CONFIRMED", "FAILED", "CANCELLED"] },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
          timeSlot:  { type: "object" },
        },
      },

      // ── Payments ─────────────────────────
      InitiatePaymentRequest: {
        type: "object",
        required: ["bookingId"],
        properties: {
          bookingId: { type: "string", format: "uuid" },
        },
      },
      WebhookRequest: {
        type: "object",
        required: ["eventId", "providerRefId", "status", "bookingId", "amount"],
        properties: {
          eventId:       { type: "string", example: "evt_001" },
          providerRefId: { type: "string", example: "PAY-ABC123" },
          status:        { type: "string", enum: ["SUCCESS", "FAILED"] },
          bookingId:     { type: "string", format: "uuid" },
          amount:        { type: "number", example: 149.99 },
        },
      },

      // ── Pagination envelope ───────────────
      Pagination: {
        type: "object",
        properties: {
          total:      { type: "integer" },
          page:       { type: "integer" },
          limit:      { type: "integer" },
          totalPages: { type: "integer" },
          hasNext:    { type: "boolean" },
          hasPrev:    { type: "boolean" },
        },
      },

      // ── Error ────────────────────────────
      ErrorResponse: {
        type: "object",
        properties: {
          status:  { type: "string", example: "error" },
          message: { type: "string" },
        },
      },
      ValidationErrorResponse: {
        type: "object",
        properties: {
          status:  { type: "string", example: "error" },
          message: { type: "string", example: "Validation failed" },
          errors:  {
            type: "array",
            items: {
              type: "object",
              properties: {
                field:   { type: "string" },
                message: { type: "string" },
              },
            },
          },
        },
      },
    },

    // ── Reusable responses ──────────────────
    responses: {
      Unauthorized: {
        description: "Missing or invalid access token",
        content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
      },
      Forbidden: {
        description: "Insufficient role",
        content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
      },
      NotFound: {
        description: "Resource not found",
        content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
      },
      Conflict: {
        description: "Duplicate resource",
        content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
      },
      BadRequest: {
        description: "Validation failed",
        content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationErrorResponse" } } },
      },
    },

    // ── Reusable parameters ─────────────────
    parameters: {
      page:  { name: "page",  in: "query", schema: { type: "integer", default: 1 },  description: "Page number (1-based)" },
      limit: { name: "limit", in: "query", schema: { type: "integer", default: 20 }, description: "Items per page (max 100)" },
    },
  },

  // ─────────────────────────────────────────
  // Paths
  // ─────────────────────────────────────────
  paths: {

    // ══════════════════════════════════════
    // AUTH
    // ══════════════════════════════════════
    "/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Register a new account",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/RegisterRequest" } } } },
        responses: {
          201: { description: "Account created", content: { "application/json": { schema: { $ref: "#/components/schemas/AuthResponse" } } } },
          400: { $ref: "#/components/responses/BadRequest" },
          409: { $ref: "#/components/responses/Conflict" },
        },
      },
    },
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Log in with email + password",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/LoginRequest" } } } },
        responses: {
          200: { description: "Login successful", content: { "application/json": { schema: { $ref: "#/components/schemas/AuthResponse" } } } },
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/auth/refresh": {
      post: {
        tags: ["Auth"],
        summary: "Exchange refresh token for a new token pair",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", required: ["refreshToken"], properties: { refreshToken: { type: "string" } } },
            },
          },
        },
        responses: {
          200: { description: "New tokens issued" },
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Log out (revokes current session)",
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: "Logged out" },
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Get current user profile",
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: "User profile", content: { "application/json": { schema: { $ref: "#/components/schemas/UserProfile" } } } },
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },

    // ══════════════════════════════════════
    // CENTRES  (CENTRE_HEAD)
    // ══════════════════════════════════════
    "/centres": {
      post: {
        tags: ["Centres"],
        summary: "Create a diagnostic centre",
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/CreateCentreRequest" } } } },
        responses: {
          201: { description: "Centre created", content: { "application/json": { schema: { $ref: "#/components/schemas/Centre" } } } },
          400: { $ref: "#/components/responses/BadRequest" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
    },
    "/centres/my": {
      get: {
        tags: ["Centres"],
        summary: "List my centres (paginated)",
        security: [{ bearerAuth: [] }],
        parameters: [
          { $ref: "#/components/parameters/page" },
          { $ref: "#/components/parameters/limit" },
        ],
        responses: {
          200: {
            description: "Paginated list of centres",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data:       { type: "array", items: { $ref: "#/components/schemas/Centre" } },
                    pagination: { $ref: "#/components/schemas/Pagination" },
                  },
                },
              },
            },
          },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
    },
    "/centres/bookings/all": {
      get: {
        tags: ["Centres"],
        summary: "View all bookings across all my centres (paginated)",
        security: [{ bearerAuth: [] }],
        parameters: [
          { $ref: "#/components/parameters/page" },
          { $ref: "#/components/parameters/limit" },
        ],
        responses: {
          200: { description: "Paginated bookings" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
    },
    "/centres/{centreId}": {
      get: {
        tags: ["Centres"],
        summary: "Get a single centre with its active tests",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "centreId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          200: { description: "Centre detail" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
      patch: {
        tags: ["Centres"],
        summary: "Update centre name or location",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "centreId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name:     { type: "string" },
                  location: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Centre updated" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/centres/{centreId}/bookings": {
      get: {
        tags: ["Centres"],
        summary: "View bookings for a specific centre (paginated)",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "centreId", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          { $ref: "#/components/parameters/page" },
          { $ref: "#/components/parameters/limit" },
        ],
        responses: {
          200: { description: "Paginated bookings for centre" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    // ══════════════════════════════════════
    // TESTS  (CENTRE_HEAD)
    // ══════════════════════════════════════
    "/tests": {
      post: {
        tags: ["Tests"],
        summary: "Create a master test in the catalogue",
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/CreateTestRequest" } } } },
        responses: {
          201: { description: "Test created" },
          400: { $ref: "#/components/responses/BadRequest" },
          409: { $ref: "#/components/responses/Conflict" },
        },
      },
      get: {
        tags: ["Tests"],
        summary: "List all master tests (paginated)",
        security: [{ bearerAuth: [] }],
        parameters: [
          { $ref: "#/components/parameters/page" },
          { $ref: "#/components/parameters/limit" },
        ],
        responses: {
          200: { description: "Paginated test catalogue" },
        },
      },
    },
    "/tests/centre/{centreId}": {
      post: {
        tags: ["Tests"],
        summary: "Add a test to a centre with price",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "centreId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/AddTestToCentreRequest" } } } },
        responses: {
          201: { description: "Test added to centre" },
          400: { $ref: "#/components/responses/BadRequest" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
      get: {
        tags: ["Tests"],
        summary: "List all tests offered by a centre",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "centreId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { 200: { description: "Centre test listings" } },
      },
    },
    "/tests/centre/{centreId}/{centreTestId}": {
      patch: {
        tags: ["Tests"],
        summary: "Update price or active status of a centre-test listing",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "centreId",     in: "path", required: true, schema: { type: "string", format: "uuid" } },
          { name: "centreTestId", in: "path", required: true, schema: { type: "string", format: "uuid" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  price:    { type: "number" },
                  isActive: { type: "boolean" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Listing updated" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
      delete: {
        tags: ["Tests"],
        summary: "Remove (deactivate) a test from a centre",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "centreId",     in: "path", required: true, schema: { type: "string", format: "uuid" } },
          { name: "centreTestId", in: "path", required: true, schema: { type: "string", format: "uuid" } },
        ],
        responses: {
          200: { description: "Test removed from centre" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    // ══════════════════════════════════════
    // SLOTS  (CENTRE_HEAD)
    // ══════════════════════════════════════
    "/slots/generate": {
      post: {
        tags: ["Slots"],
        summary: "Generate time slots (auto 09:00–18:30 or manual list)",
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/GenerateSlotsRequest" } } } },
        responses: {
          201: { description: "Slots generated", content: { "application/json": { schema: { type: "object", properties: { created: { type: "integer" }, mode: { type: "string" } } } } } },
          400: { $ref: "#/components/responses/BadRequest" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
    },
    "/slots/{centreTestId}": {
      get: {
        tags: ["Slots"],
        summary: "List slots for a centre-test  (?date= or ?from=&to=)",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "centreTestId", in: "path",  required: true, schema: { type: "string", format: "uuid" } },
          { name: "date",         in: "query", schema: { type: "string", format: "date" }, description: "Single day filter" },
          { name: "from",         in: "query", schema: { type: "string", format: "date" }, description: "Range start" },
          { name: "to",           in: "query", schema: { type: "string", format: "date" }, description: "Range end" },
        ],
        responses: {
          200: { description: "Slots list", content: { "application/json": { schema: { type: "object", properties: { slots: { type: "array", items: { $ref: "#/components/schemas/Slot" } } } } } } },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
    },
    "/slots": {
      delete: {
        tags: ["Slots"],
        summary: "Delete unbooked slots for a date range",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["centreTestId", "startDate"],
                properties: {
                  centreTestId: { type: "string", format: "uuid" },
                  startDate:    { type: "string", format: "date" },
                  endDate:      { type: "string", format: "date" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Slots deleted" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
    },

    // ══════════════════════════════════════
    // DISCOVERY  (ALL authenticated)
    // ══════════════════════════════════════
    "/discover/centres": {
      get: {
        tags: ["Discovery"],
        summary: "Browse all diagnostic centres (paginated)",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "name",     in: "query", schema: { type: "string" }, description: "Search by name" },
          { name: "location", in: "query", schema: { type: "string" }, description: "Search by location" },
          { $ref: "#/components/parameters/page" },
          { $ref: "#/components/parameters/limit" },
        ],
        responses: {
          200: {
            description: "Paginated centres",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data:       { type: "array", items: { $ref: "#/components/schemas/Centre" } },
                    pagination: { $ref: "#/components/schemas/Pagination" },
                  },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/discover/centres/{centreId}": {
      get: {
        tags: ["Discovery"],
        summary: "Get a centre with all its active tests and prices",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "centreId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          200: { description: "Centre with tests" },
          401: { $ref: "#/components/responses/Unauthorized" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/discover/slots/{centreTestId}": {
      get: {
        tags: ["Discovery"],
        summary: "Get available (not full) slots for a centre-test",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "centreTestId", in: "path",  required: true, schema: { type: "string", format: "uuid" } },
          { name: "date",         in: "query", schema: { type: "string", format: "date" } },
          { name: "from",         in: "query", schema: { type: "string", format: "date" } },
          { name: "to",           in: "query", schema: { type: "string", format: "date" } },
        ],
        responses: {
          200: { description: "Available slots with centre and test info" },
          400: { $ref: "#/components/responses/BadRequest" },
          401: { $ref: "#/components/responses/Unauthorized" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    // ══════════════════════════════════════
    // BOOKINGS  (PATIENT)
    // ══════════════════════════════════════
    "/bookings": {
      post: {
        tags: ["Bookings"],
        summary: "Book a slot",
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/CreateBookingRequest" } } } },
        responses: {
          201: { description: "Booking created with status PENDING", content: { "application/json": { schema: { $ref: "#/components/schemas/Booking" } } } },
          400: { $ref: "#/components/responses/BadRequest" },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
          409: { description: "Slot fully booked or duplicate booking" },
        },
      },
      get: {
        tags: ["Bookings"],
        summary: "List my bookings (paginated)",
        security: [{ bearerAuth: [] }],
        parameters: [
          { $ref: "#/components/parameters/page" },
          { $ref: "#/components/parameters/limit" },
        ],
        responses: {
          200: {
            description: "Paginated bookings",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data:       { type: "array", items: { $ref: "#/components/schemas/Booking" } },
                    pagination: { $ref: "#/components/schemas/Pagination" },
                  },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/bookings/{bookingId}": {
      get: {
        tags: ["Bookings"],
        summary: "Get a single booking",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "bookingId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          200: { description: "Booking detail" },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/bookings/{bookingId}/cancel": {
      patch: {
        tags: ["Bookings"],
        summary: "Cancel a booking (not allowed within 2 hours of appointment)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "bookingId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          200: { description: "Booking cancelled" },
          400: { description: "Already cancelled, failed, or within 2-hour window" },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    // ══════════════════════════════════════
    // PAYMENTS  (PATIENT + webhook)
    // ══════════════════════════════════════
    "/payments": {
      post: {
        tags: ["Payments"],
        summary: "Initiate payment for a PENDING booking (simulated 80% SUCCESS / 20% FAILED)",
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/InitiatePaymentRequest" } } } },
        responses: {
          200: { description: "Payment SUCCESS — booking CONFIRMED" },
          400: { description: "Booking not in PENDING state" },
          401: { $ref: "#/components/responses/Unauthorized" },
          402: { description: "Payment FAILED — booking marked FAILED" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
          409: { description: "Payment already exists for this booking" },
        },
      },
    },
    "/payments/{bookingId}": {
      get: {
        tags: ["Payments"],
        summary: "Get payment status for a booking",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "bookingId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          200: { description: "Payment record" },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/payments/webhook": {
      post: {
        tags: ["Payments"],
        summary: "Receive payment status update from provider (idempotent)",
        description:
          "No authentication required. Idempotent — duplicate `eventId` values are silently ignored. " +
          "Failed webhooks are automatically retried with exponential back-off.",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/WebhookRequest" } } } },
        responses: {
          200: { description: "Processed, already processed, or terminal state — always 200" },
          400: { $ref: "#/components/responses/BadRequest" },
        },
      },
    },
  },

  // ── Tag descriptions ──────────────────────
  tags: [
    { name: "Auth",      description: "Register, login, logout, token refresh" },
    { name: "Centres",   description: "CENTRE_HEAD: manage diagnostic centres and view bookings" },
    { name: "Tests",     description: "CENTRE_HEAD: master test catalogue and per-centre listings" },
    { name: "Slots",     description: "CENTRE_HEAD: generate and manage appointment time slots" },
    { name: "Discovery", description: "Any authenticated user: browse centres, tests, and available slots" },
    { name: "Bookings",  description: "PATIENT: create, view and cancel bookings" },
    { name: "Payments",  description: "PATIENT: initiate payments; webhook endpoint for provider callbacks" },
  ],
};
