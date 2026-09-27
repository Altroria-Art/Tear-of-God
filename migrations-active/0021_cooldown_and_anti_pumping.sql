-- 0021_cooldown_and_anti_pumping.sql
-- 1. Create template_user_contributions table for 7-day template cooldown
--    and community average anti-pumping (1 user = 1 effective vote per template).
-- 2. Create triggers to prevent concurrent race condition bypass.
-- 3. Deterministically backfill existing latest valid rankings per (template_id, user_id).

CREATE TABLE IF NOT EXISTS template_user_contributions (
  template_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  current_ranking_id TEXT,
  cooldown_until DATETIME NOT NULL,
  last_contributed_at DATETIME NOT NULL,
  PRIMARY KEY (template_id, user_id),
  FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (current_ranking_id) REFERENCES rankings(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_tuc_template_current
  ON template_user_contributions(template_id, current_ranking_id);
CREATE INDEX IF NOT EXISTS idx_tuc_user_cooldown
  ON template_user_contributions(user_id, cooldown_until);

-- Trigger to prevent race conditions: abort if updating cooldown while active
CREATE TRIGGER IF NOT EXISTS trg_template_user_contributions_cooldown_update
BEFORE UPDATE OF cooldown_until, last_contributed_at ON template_user_contributions
FOR EACH ROW
WHEN OLD.cooldown_until > CURRENT_TIMESTAMP
BEGIN
  SELECT RAISE(ABORT, 'TEMPLATE_COOLDOWN_ACTIVE');
END;

-- Deterministic backfill:
-- For each (template_id, user_id) pair, pick the newest valid ranking using created_at DESC, id DESC.
-- Cooldown is computed as datetime(created_at, '+7 days') so recent submissions (<7 days old)
-- still have their remaining cooldown, and older submissions (>7 days old) are immediately available.
INSERT OR IGNORE INTO template_user_contributions (
  template_id,
  user_id,
  current_ranking_id,
  last_contributed_at,
  cooldown_until
)
SELECT
  template_id,
  user_id,
  id AS current_ranking_id,
  created_at AS last_contributed_at,
  datetime(created_at, '+7 days') AS cooldown_until
FROM (
  SELECT
    id,
    template_id,
    user_id,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY template_id, user_id
      ORDER BY created_at DESC, id DESC
    ) as rn
  FROM rankings
  WHERE template_id IS NOT NULL AND user_id IS NOT NULL
)
WHERE rn = 1;
