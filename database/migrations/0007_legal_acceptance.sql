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
