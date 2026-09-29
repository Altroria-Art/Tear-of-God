-- Discover Pulse counts real comments and retained votes inside a selected
-- window for at most 80 candidate rankings. These indexes let SQLite seek
-- directly to the time range instead of reading each ranking's full history.
CREATE INDEX IF NOT EXISTS idx_votes_ranking_created
  ON votes(ranking_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_ranking_created
  ON comments(ranking_id, created_at DESC);
-- The composite comments index also covers ranking_id-only lookups.
DROP INDEX IF EXISTS idx_comments_ranking_id;
