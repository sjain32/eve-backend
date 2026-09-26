-- AlterTable
ALTER TABLE "webhook_events" ADD COLUMN     "last_error" TEXT,
ADD COLUMN     "next_retry_at" TIMESTAMPTZ,
ADD COLUMN     "retry_count" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "webhook_events_next_retry_at_idx" ON "webhook_events"("next_retry_at");
