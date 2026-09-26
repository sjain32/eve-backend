/**
 * Webhook Retry Worker
 *
 * Polls the webhook_events table every POLL_INTERVAL_MS for events that:
 *   - Have NOT been processed (processedAt IS NULL)
 *   - Are due for retry (nextRetryAt <= now OR nextRetryAt IS NULL and retryCount > 0)
 *   - Have not exceeded MAX_RETRIES
 *
 * Retry schedule — exponential back-off with jitter:
 *   Attempt 1 →  30 s
 *   Attempt 2 →  2 min
 *   Attempt 3 →  10 min
 *   Attempt 4 →  1 h
 *   Attempt 5 →  6 h   (final)
 *
 * After MAX_RETRIES failures the event is left with processedAt = null
 * and lastError set — it will no longer be picked up by the worker and
 * requires manual intervention.
 *
 * Usage — called once from server.js:
 *   import { startWebhookRetryWorker } from './workers/webhookRetryWorker.js';
 *   startWebhookRetryWorker();
 */

import { prisma } from "../prisma/client.js";
import { logger } from "../config/logger.js";
import { handleWebhook } from "../modules/payments/payments.service.js";

const POLL_INTERVAL_MS = 30_000; // poll every 30 s
const MAX_RETRIES      = 5;
const BATCH_SIZE       = 10;     // process up to 10 at once per tick

// Back-off delays in milliseconds for each attempt index (0-based)
const BACKOFF_MS = [
  30_000,        //  30 s  — attempt 1
  120_000,       //   2 min — attempt 2
  600_000,       //  10 min — attempt 3
  3_600_000,     //   1 h   — attempt 4
  21_600_000,    //   6 h   — attempt 5
];

function nextRetryDelay(retryCount) {
  const base  = BACKOFF_MS[retryCount] ?? BACKOFF_MS[BACKOFF_MS.length - 1];
  // Add up to 10 % jitter so simultaneous events don't all retry at once
  const jitter = Math.floor(Math.random() * base * 0.1);
  return base + jitter;
}

async function processPendingWebhooks() {
  const now = new Date();

  // Find events that need processing or retrying
  const events = await prisma.webhookEvent.findMany({
    where: {
      processedAt: null,
      retryCount: { lt: MAX_RETRIES },
      OR: [
        { nextRetryAt: null,          retryCount: { gt: 0 } },
        { nextRetryAt: { lte: now } },
      ],
    },
    orderBy: { nextRetryAt: "asc" },
    take: BATCH_SIZE,
  });

  if (events.length === 0) return;

  logger.debug({ count: events.length }, "Webhook retry worker: processing events");

  for (const event of events) {
    try {
      // Re-run the webhook handler with the stored payload
      const payload = event.payload;
      await handleWebhook(payload);

      // Mark as processed
      await prisma.webhookEvent.update({
        where: { id: event.id },
        data:  { processedAt: new Date(), lastError: null },
      });

      logger.info(
        { eventId: event.eventId, retryCount: event.retryCount },
        "Webhook retry succeeded"
      );
    } catch (err) {
      const newRetryCount = event.retryCount + 1;
      const errorMessage  = err instanceof Error ? err.message : String(err);

      if (newRetryCount >= MAX_RETRIES) {
        // Give up — log and leave for manual inspection
        await prisma.webhookEvent.update({
          where: { id: event.id },
          data: {
            retryCount:  newRetryCount,
            lastError:   `MAX RETRIES EXCEEDED. Last error: ${errorMessage}`,
            nextRetryAt: null,
          },
        });

        logger.error(
          { eventId: event.eventId, retryCount: newRetryCount, err },
          "Webhook retry exhausted — manual intervention required"
        );
      } else {
        // Schedule next retry with back-off
        const delay = nextRetryDelay(newRetryCount);
        const nextRetryAt = new Date(Date.now() + delay);

        await prisma.webhookEvent.update({
          where: { id: event.id },
          data: {
            retryCount: newRetryCount,
            lastError:  errorMessage,
            nextRetryAt,
          },
        });

        logger.warn(
          { eventId: event.eventId, retryCount: newRetryCount, nextRetryAt },
          "Webhook retry failed — rescheduled"
        );
      }
    }
  }
}

export function startWebhookRetryWorker() {
  logger.info("Webhook retry worker started");

  // Run immediately on start, then on interval
  processPendingWebhooks().catch((err) =>
    logger.error({ err }, "Webhook retry worker error on first run")
  );

  const timer = setInterval(() => {
    processPendingWebhooks().catch((err) =>
      logger.error({ err }, "Webhook retry worker interval error")
    );
  }, POLL_INTERVAL_MS);

  // Return a stop function for graceful shutdown
  return function stopWebhookRetryWorker() {
    clearInterval(timer);
    logger.info("Webhook retry worker stopped");
  };
}
