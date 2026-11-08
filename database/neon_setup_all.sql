-- Atomic convenience script: either all six migrations apply or none do.
BEGIN;

-- Android Testers Neon setup bundle. Run this once against the target neondb database.
-- Migrations are kept separately in database/migrations/ for version history.
-- Do not put DATABASE_URL or passwords in this file.

-- BEGIN 0001_initial_schema.sql
-- Android Testers production schema. Apply once to an empty Neon database.
-- All business mutations go through the authenticated Rust/Axum API on Render; Vercel proxies signed user requests. Never expose this DB URL to browsers.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS app_users (
    auth_user_id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    display_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT app_users_email_nonempty CHECK (length(trim(email)) > 3)
);
CREATE INDEX IF NOT EXISTS app_users_email_lower_idx ON app_users (lower(email));

CREATE TABLE IF NOT EXISTS apps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id TEXT NOT NULL REFERENCES app_users(auth_user_id),
    app_name TEXT NOT NULL,
    package_name TEXT NOT NULL,
    opt_in_url TEXT NOT NULL,
    tester_list_configured BOOLEAN NOT NULL DEFAULT FALSE,
    kenya_available BOOLEAN NOT NULL DEFAULT FALSE,
    setup_evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
    setup_status TEXT NOT NULL DEFAULT 'submitted'
        CHECK (setup_status IN ('submitted', 'needs_changes', 'approved')),
    admin_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT apps_name_length CHECK (length(trim(app_name)) BETWEEN 2 AND 100),
    CONSTRAINT apps_package_name_nonempty CHECK (length(trim(package_name)) BETWEEN 3 AND 255),
    CONSTRAINT apps_opt_in_url_https CHECK (opt_in_url LIKE 'https://%')
);
CREATE INDEX IF NOT EXISTS apps_owner_created_idx ON apps (owner_user_id, created_at DESC);
DROP INDEX IF EXISTS apps_owner_package_active_idx;
CREATE INDEX IF NOT EXISTS apps_owner_package_idx ON apps (owner_user_id, lower(package_name));

CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id UUID NOT NULL REFERENCES apps(id),
    customer_user_id TEXT NOT NULL REFERENCES app_users(auth_user_id),
    status TEXT NOT NULL DEFAULT 'awaiting_review'
        CHECK (status IN (
          'awaiting_review', 'needs_changes', 'awaiting_payment', 'payment_pending',
          'paid_queued', 'enrolling', 'running', 'completed', 'refund_pending',
          'refunded', 'cancelled'
        )),
    amount_minor INTEGER NOT NULL DEFAULT 1000 CHECK (amount_minor = 1000),
    currency CHAR(3) NOT NULL DEFAULT 'USD' CHECK (currency = 'USD'),
    required_testers SMALLINT NOT NULL DEFAULT 12 CHECK (required_testers = 12),
    planned_days SMALLINT NOT NULL DEFAULT 15 CHECK (planned_days = 15),
    payment_required BOOLEAN NOT NULL DEFAULT TRUE,
    is_comped_retest BOOLEAN NOT NULL DEFAULT FALSE,
    parent_campaign_id UUID REFERENCES campaigns(id),
    source_retest_request_id UUID UNIQUE,
    scheduled_start_at TIMESTAMPTZ,
    actual_start_at TIMESTAMPTZ,
    actual_end_at TIMESTAMPTZ,
    completion_summary TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT campaigns_end_after_start CHECK (actual_end_at IS NULL OR actual_start_at IS NULL OR actual_end_at > actual_start_at)
);
CREATE INDEX IF NOT EXISTS campaigns_customer_created_idx ON campaigns (customer_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS campaigns_status_schedule_idx ON campaigns (status, scheduled_start_at, created_at);
-- Exactly one shared 12-person pool: only one campaign may be enrolling/running at a time.
CREATE UNIQUE INDEX IF NOT EXISTS campaigns_single_active_pool_idx ON campaigns ((TRUE))
    WHERE status IN ('enrolling', 'running');

CREATE TABLE IF NOT EXISTS uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id TEXT NOT NULL REFERENCES app_users(auth_user_id),
    object_key TEXT NOT NULL UNIQUE,
    file_name TEXT NOT NULL,
    content_type TEXT NOT NULL CHECK (content_type IN ('image/png', 'image/jpeg', 'image/webp')),
    byte_size INTEGER NOT NULL CHECK (byte_size BETWEEN 1 AND 5242880),
    linked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS uploads_owner_created_idx ON uploads(owner_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS testers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tester_pool_state (
    singleton_id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton_id = TRUE),
    locked_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS campaign_testers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    tester_id UUID NOT NULL REFERENCES testers(id),
    status TEXT NOT NULL DEFAULT 'assigned'
        CHECK (status IN ('assigned', 'opted_in', 'opted_out', 'completed')),
    opted_in_at TIMESTAMPTZ,
    last_confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (campaign_id, tester_id)
);
CREATE INDEX IF NOT EXISTS campaign_testers_campaign_status_idx ON campaign_testers (campaign_id, status);

CREATE TABLE IF NOT EXISTS campaign_tester_checkins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_tester_id UUID NOT NULL REFERENCES campaign_testers(id) ON DELETE CASCADE,
    checkin_date DATE NOT NULL DEFAULT ((now() AT TIME ZONE 'Africa/Nairobi')::date),
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (campaign_tester_id, checkin_date)
);

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL UNIQUE REFERENCES campaigns(id),
    provider TEXT NOT NULL DEFAULT 'paystack' CHECK (provider = 'paystack'),
    provider_reference TEXT NOT NULL UNIQUE,
    provider_transaction_id TEXT,
    amount_minor INTEGER NOT NULL CHECK (amount_minor = 1000),
    currency CHAR(3) NOT NULL CHECK (currency = 'USD'),
    status TEXT NOT NULL DEFAULT 'initiated'
        CHECK (status IN ('initiated', 'pending', 'success', 'failed', 'reversed', 'refunded')),
    verified_at TIMESTAMPTZ,
    raw_provider_event JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payments_status_created_idx ON payments(status, created_at DESC);

CREATE TABLE IF NOT EXISTS campaign_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id),
    actor_user_id TEXT REFERENCES app_users(auth_user_id),
    event_type TEXT NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS campaign_events_campaign_created_idx ON campaign_events(campaign_id, created_at);

CREATE TABLE IF NOT EXISTS retest_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id),
    customer_user_id TEXT NOT NULL REFERENCES app_users(auth_user_id),
    customer_reason TEXT NOT NULL,
    evidence_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'approved_retest', 'approved_refund', 'declined')),
    decision_by_user_id TEXT REFERENCES app_users(auth_user_id),
    decision_note TEXT,
    decided_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS retest_requests_status_created_idx ON retest_requests(status, created_at);
CREATE INDEX IF NOT EXISTS retest_requests_customer_created_idx ON retest_requests(customer_user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS one_pending_retest_per_campaign_idx ON retest_requests(campaign_id) WHERE status IN ('pending', 'processing');

ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_source_retest_request_fk;
ALTER TABLE campaigns ADD CONSTRAINT campaigns_source_retest_request_fk
    FOREIGN KEY (source_retest_request_id) REFERENCES retest_requests(id);

CREATE TABLE IF NOT EXISTS refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES payments(id),
    retest_request_id UUID UNIQUE REFERENCES retest_requests(id),
    amount_minor INTEGER NOT NULL CHECK (amount_minor = 1000),
    currency CHAR(3) NOT NULL CHECK (currency = 'USD'),
    provider_reference TEXT NOT NULL UNIQUE,
    provider_refund_id TEXT,
    status TEXT NOT NULL DEFAULT 'initiating'
        CHECK (status IN ('initiating', 'pending', 'processing', 'succeeded', 'failed', 'needs_attention')),
    reason TEXT NOT NULL,
    processed_at TIMESTAMPTZ,
    raw_provider_event JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id TEXT NOT NULL REFERENCES app_users(auth_user_id),
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_audit_logs_created_idx ON admin_audit_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS request_rate_limits (
    rate_key TEXT PRIMARY KEY,
    window_started_at TIMESTAMPTZ NOT NULL,
    hits INTEGER NOT NULL CHECK (hits > 0)
);

CREATE TABLE IF NOT EXISTS paystack_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payload_hash TEXT NOT NULL UNIQUE,
    event_type TEXT NOT NULL,
    provider_reference TEXT,
    processing_status TEXT NOT NULL DEFAULT 'pending' CHECK (processing_status IN ('pending','processing','processed')),
    received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- No tester addresses are seeded here. Admin adds the 12 addresses when ready.
-- Do not enable browser-side SQL access to retest_requests, refunds, testers, or audit logs.
-- END 0001_initial_schema.sql

-- BEGIN 0002_campaign_completed_at.sql
-- Record the actual admin completion-notice time separately from the scheduled
-- 15-day end timestamp. The customer remedy window begins at this timestamp.
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
-- END 0002_campaign_completed_at.sql

-- BEGIN 0003_retest_requested_remedy.sql
-- Preserve the customer's chosen remedy so the operations console cannot
-- silently substitute a refund for a requested retest (or vice versa).
ALTER TABLE retest_requests
  ADD COLUMN IF NOT EXISTS requested_remedy TEXT NOT NULL DEFAULT 'retest';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'retest_requests_requested_remedy_check'
      AND conrelid = 'retest_requests'::regclass
  ) THEN
    ALTER TABLE retest_requests
      ADD CONSTRAINT retest_requests_requested_remedy_check
      CHECK (requested_remedy IN ('retest', 'refund'));
  END IF;
END $$;
-- END 0003_retest_requested_remedy.sql

-- BEGIN 0004_campaign_day_checkins.sql
-- A check-in must belong to one of the 15 fixed 24-hour service days.
-- The unique constraint prevents an administrator from counting multiple
-- notes on the same day as separate days of tester participation.
ALTER TABLE campaign_tester_checkins
  ADD COLUMN IF NOT EXISTS campaign_day SMALLINT NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'campaign_tester_checkins_campaign_day_check'
      AND conrelid = 'campaign_tester_checkins'::regclass
  ) THEN
    ALTER TABLE campaign_tester_checkins
      ADD CONSTRAINT campaign_tester_checkins_campaign_day_check
      CHECK (campaign_day BETWEEN 1 AND 15);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS campaign_tester_checkins_unique_day_idx
  ON campaign_tester_checkins (campaign_tester_id, campaign_day);
-- END 0004_campaign_day_checkins.sql

-- BEGIN 0005_campaign_day_checkin_key.sql
-- Campaign participation is recorded against a rolling 24-hour campaign day,
-- not a calendar date. Remove the older date-based unique constraint so a
-- campaign that starts late in the day can still record one check-in for
-- campaign day 1 and another for campaign day 2 when those windows overlap
-- the same local calendar date.
ALTER TABLE campaign_tester_checkins
  DROP CONSTRAINT IF EXISTS campaign_tester_checkins_campaign_tester_id_checkin_date_key;

-- The authoritative uniqueness rule is the campaign-day index created in 0004.
CREATE UNIQUE INDEX IF NOT EXISTS campaign_tester_checkins_unique_day_idx
  ON campaign_tester_checkins (campaign_tester_id, campaign_day);
-- END 0005_campaign_day_checkin_key.sql

-- BEGIN 0006_durable_paystack_webhook_queue.sql
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
-- END 0006_durable_paystack_webhook_queue.sql

-- BEGIN 0007_legal_acceptance.sql
-- Record the exact service terms and privacy notice versions acknowledged at checkout.
-- No IP address or unnecessary device fingerprint is collected for this purpose.
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS legal_terms_version TEXT,
  ADD COLUMN IF NOT EXISTS legal_privacy_version TEXT,
  ADD COLUMN IF NOT EXISTS legal_accepted_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'campaigns_legal_versions_nonempty'
      AND conrelid = 'campaigns'::regclass
  ) THEN
    ALTER TABLE campaigns
      ADD CONSTRAINT campaigns_legal_versions_nonempty
      CHECK (
        (legal_terms_version IS NULL OR length(trim(legal_terms_version)) BETWEEN 1 AND 80)
        AND (legal_privacy_version IS NULL OR length(trim(legal_privacy_version)) BETWEEN 1 AND 80)
      );
  END IF;
END $$;
-- END 0007_legal_acceptance.sql

COMMIT;
