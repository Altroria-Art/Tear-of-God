-- Additive only: no counters, content, or existing indexes are changed.
-- Latest previews seek one ranking per template instead of sorting its history.
CREATE INDEX IF NOT EXISTS idx_rankings_template_created
  ON rankings(template_id, created_at DESC, id DESC);

-- Activity keeps the existing datetime() ordering, including legacy ISO dates.
-- Each followed person's candidates are bounded before the combined feed sort.
CREATE INDEX IF NOT EXISTS idx_rankings_activity_user_time
  ON rankings(user_id, datetime(created_at) DESC, id DESC, created_at);
CREATE INDEX IF NOT EXISTS idx_votes_activity_user_time
  ON votes(user_id, datetime(created_at) DESC, ranking_id DESC)
  WHERE vote_type = 'like';
