-- Persist verified Paystack event payloads before acknowledging the webhook.
-- A worker retries transient processing failures without relying on Paystack's
-- delivery timeout. Older processed rows remain valid with a NULL payload.
ALTER TABLE paystack_webhook_events
  ADD COLUMN IF NOT EXISTS payload JSONB,
  ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_error TEXT;

ALTER TABLE paystack_webhook_events
  DROP CONSTRAINT IF EXISTS paystack_webhook_events_processing_status_check;
ALTER TABLE paystack_webhook_events
  ADD CONSTRAINT paystack_webhook_events_processing_status_check
  CHECK (processing_status IN ('pending','processing','processed','failed'));

CREATE INDEX IF NOT EXISTS paystack_webhook_events_queue_idx
  ON paystack_webhook_events (processing_status, next_attempt_at, received_at);
