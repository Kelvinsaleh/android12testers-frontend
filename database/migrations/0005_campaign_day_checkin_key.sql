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
