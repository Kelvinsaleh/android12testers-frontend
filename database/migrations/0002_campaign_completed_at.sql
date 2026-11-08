-- Record the actual admin completion-notice time separately from the scheduled
-- 15-day end timestamp. The customer remedy window begins at this timestamp.
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
