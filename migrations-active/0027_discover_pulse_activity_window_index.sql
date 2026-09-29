-- Discover Pulse uses last_activity_at to find touched rankings in a window.
-- Keep the candidate scan bounded when deploying before the broader Home feed
-- index migration (0024) has been applied.
CREATE INDEX IF NOT EXISTS idx_rankings_feed_activity
  ON rankings(COALESCE(last_activity_at, created_at) DESC, id DESC);
