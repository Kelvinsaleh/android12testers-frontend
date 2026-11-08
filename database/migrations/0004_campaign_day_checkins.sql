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
