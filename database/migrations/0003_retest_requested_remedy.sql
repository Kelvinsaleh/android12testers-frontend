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
