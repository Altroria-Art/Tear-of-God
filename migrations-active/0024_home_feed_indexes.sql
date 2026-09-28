-- Additive only. Apply explicitly after reviewing the Home quota report.
-- 0019 supplies last_activity_at; 0012 already serves Following; retain
-- 0013's tier index for full detail and aggregate queries.
CREATE INDEX IF NOT EXISTS idx_rankings_feed_activity
  ON rankings(COALESCE(last_activity_at, created_at) DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_ranking_items_preview
  ON ranking_items(ranking_id, position, id);
