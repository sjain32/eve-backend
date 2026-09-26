import * as paymentsService from "./payments.service.js";

// ─────────────────────────────────────────
// POST /api/v1/payments
// Authenticated patient initiates payment for a booking
// ─────────────────────────────────────────
export async function initiatePaymentHandler(req, res) {
  const result = await paymentsService.initiatePayment(req.user.id, req.body);

  const statusCode = result.payment.status === "SUCCESS" ? 200 : 402;
  const message =
    result.payment.status === "SUCCESS"
      ? "Payment successful — booking confirmed"
      : "Payment failed — please try again or choose a different slot";

  res.status(statusCode).json({ message, ...result });
}

// ─────────────────────────────────────────
// GET /api/v1/payments/:bookingId
// Patient views payment status for their booking
// ─────────────────────────────────────────
export async function getPaymentHandler(req, res) {
  const payment = await paymentsService.getPaymentForBooking(
    req.params.bookingId,
    req.user.id
  );
  res.status(200).json({ payment });
}

// ─────────────────────────────────────────
// POST /api/v1/payments/webhook
// Simulated provider posts payment status updates.
// No auth required — the real world uses a webhook secret instead.
// Must be idempotent.
// ─────────────────────────────────────────
export async function webhookHandler(req, res) {
  const result = await paymentsService.handleWebhook(req.body);

  if (result.alreadyProcessed) {
    // Return 200 to stop the provider retrying — event was already handled
    return res.status(200).json(result);
  }

  res.status(200).json(result);
}
