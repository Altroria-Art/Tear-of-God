-- Profile Taste Identity: user-selected pinned lists shown on public profiles.
CREATE TABLE IF NOT EXISTS profile_pins (
  user_id TEXT NOT NULL,
  ranking_id TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0 CHECK(position BETWEEN 0 AND 2),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, ranking_id),
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (ranking_id) REFERENCES rankings(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_profile_pins_user_position
  ON profile_pins(user_id, position ASC, created_at DESC);
