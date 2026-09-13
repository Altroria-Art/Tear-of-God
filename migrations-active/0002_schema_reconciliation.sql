-- Reconcile the production D1 schema with schema.sql without changing row data.
--
-- IMPORTANT:
-- - Run the documented read-only preflight before applying this migration.
-- - D1 keeps foreign-key actions active while checks are deferred. The temporary
--   ID prefix prevents DROP TABLE from matching and cascading into child rows.
-- - This file intentionally does not read from or write to d1_migrations.

PRAGMA defer_foreign_keys = ON;

-- Fail closed. Any failed CHECK aborts the migration before a source table is
-- modified. The guard is removed on success and rolls back on batch failure.
CREATE TABLE __phase3c_preflight_guard (
  check_name TEXT PRIMARY KEY,
  passed INTEGER NOT NULL CHECK (passed = 1)
);

INSERT INTO __phase3c_preflight_guard (check_name, passed)
SELECT 'foreign_key_violations',
       CASE WHEN EXISTS (SELECT 1 FROM pragma_foreign_key_check) THEN 0 ELSE 1 END;

INSERT INTO __phase3c_preflight_guard (check_name, passed)
SELECT 'orphan_ranking_templates',
       CASE WHEN EXISTS (
         SELECT 1
         FROM rankings r
         LEFT JOIN templates t ON t.id = r.template_id
         WHERE r.template_id IS NOT NULL AND t.id IS NULL
       ) THEN 0 ELSE 1 END;

INSERT INTO __phase3c_preflight_guard (check_name, passed)
SELECT 'duplicate_ranking_item_scores',
       CASE WHEN EXISTS (
         SELECT 1
         FROM ranking_item_scores
         GROUP BY ranking_id, item_id
         HAVING COUNT(*) > 1
       ) THEN 0 ELSE 1 END;

INSERT INTO __phase3c_preflight_guard (check_name, passed)
SELECT 'ranking_id_shield_is_safe',
       CASE WHEN EXISTS (SELECT 1 FROM rankings WHERE id IS NULL)
         OR EXISTS (
           SELECT 1
           FROM rankings source
           JOIN rankings target
             ON target.id = '__phase3c_20260913_old__' || source.id
         ) THEN 0 ELSE 1 END;

INSERT INTO __phase3c_preflight_guard (check_name, passed)
SELECT 'template_id_shield_is_safe',
       CASE WHEN EXISTS (SELECT 1 FROM templates WHERE id IS NULL)
         OR EXISTS (
           SELECT 1
           FROM templates source
           JOIN templates target
             ON target.id = '__phase3c_20260913_old__' || source.id
         ) THEN 0 ELSE 1 END;

DROP TABLE __phase3c_preflight_guard;

-- Rebuild rankings in its existing production column order. template_id stays
-- nullable; the only schema change is the additional template foreign key.
CREATE TABLE rankings__phase3c_new (
  id TEXT PRIMARY KEY,
  title TEXT,
  description TEXT,
  category TEXT,
  hashtags TEXT,
  user_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  template_id TEXT,
  likes_count INTEGER DEFAULT 0,
  dislikes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE
);

INSERT INTO rankings__phase3c_new (
  id, title, description, category, hashtags, user_id, created_at,
  template_id, likes_count, dislikes_count, comments_count
)
SELECT
  id, title, description, category, hashtags, user_id, created_at,
  template_id, likes_count, dislikes_count, comments_count
FROM rankings;

-- Shield child references from DROP TABLE's still-active cascade actions.
UPDATE rankings SET id = '__phase3c_20260913_old__' || id;
DROP TABLE rankings;
ALTER TABLE rankings__phase3c_new RENAME TO rankings;

CREATE INDEX idx_rankings_user_id ON rankings(user_id);
CREATE INDEX idx_rankings_category ON rankings(category);
CREATE INDEX idx_rankings_template_id ON rankings(template_id);
CREATE INDEX idx_rankings_created_at ON rankings(created_at DESC, id DESC);
CREATE INDEX idx_rankings_cat_created ON rankings(category, created_at DESC, id DESC);
CREATE INDEX idx_rankings_tpl_likes ON rankings(template_id, likes_count DESC, created_at DESC, id DESC);
CREATE INDEX idx_rankings_user_created ON rankings(user_id, created_at DESC, id DESC);

-- Rebuild templates in its existing production column order. The creator
-- relationship now preserves community content by setting creator_id to NULL.
CREATE TABLE templates__phase3c_new (
  id TEXT PRIMARY KEY,
  creator_id TEXT,
  title TEXT,
  description TEXT,
  category TEXT,
  hashtags TEXT,
  tiers TEXT,
  use_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  view_count INTEGER DEFAULT 0,
  FOREIGN KEY (creator_id) REFERENCES profiles(id) ON DELETE SET NULL
);

INSERT INTO templates__phase3c_new (
  id, creator_id, title, description, category, hashtags, tiers,
  use_count, created_at, view_count
)
SELECT
  id, creator_id, title, description, category, hashtags, tiers,
  use_count, created_at, view_count
FROM templates;

-- The same shielding protects template children, including the newly linked
-- rankings table, while the old parent table is dropped.
UPDATE templates SET id = '__phase3c_20260913_old__' || id;
DROP TABLE templates;
ALTER TABLE templates__phase3c_new RENAME TO templates;

CREATE INDEX idx_templates_creator_id ON templates(creator_id);
CREATE INDEX idx_templates_category ON templates(category);
CREATE INDEX idx_templates_use_count ON templates(use_count DESC, created_at DESC, id DESC);
CREATE INDEX idx_templates_view_count ON templates(view_count DESC, use_count DESC, id DESC);

-- A named unique index provides the same enforcement without rebuilding the
-- score table or changing its physical column order.
CREATE UNIQUE INDEX idx_ranking_item_scores_ranking_item_unique
  ON ranking_item_scores(ranking_id, item_id);

-- This validates all temporarily deferred relationships before commit.
PRAGMA defer_foreign_keys = OFF;
