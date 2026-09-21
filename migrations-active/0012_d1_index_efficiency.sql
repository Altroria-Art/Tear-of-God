-- Requires 0011. Preserve all event rows and uniqueness/FK constraints.
-- Production has not run 0002: retain idx_ris_ranking because its UNIQUE
-- replacement is absent there. Do not force a broader schema reconciliation.
-- Fail before index removal if the other expected uniqueness indexes are missing.
CREATE TABLE __quota_0012_guard (passed INTEGER NOT NULL CHECK (passed = 1));
INSERT INTO __quota_0012_guard
SELECT CASE WHEN EXISTS (
  SELECT 1 FROM pragma_index_list('votes') i
  WHERE i."unique" = 1 AND i.partial = 0
    AND (SELECT COUNT(*) FROM pragma_index_info(i.name)) = 2
    AND (SELECT name FROM pragma_index_info(i.name) WHERE seqno = 0) = 'ranking_id'
    AND (SELECT name FROM pragma_index_info(i.name) WHERE seqno = 1) = 'user_id'
) AND EXISTS (
  SELECT 1 FROM pragma_index_list('template_reactions') i
  WHERE i."unique" = 1 AND i.partial = 0
    AND (SELECT COUNT(*) FROM pragma_index_info(i.name)) = 2
    AND (SELECT name FROM pragma_index_info(i.name) WHERE seqno = 0) = 'template_id'
    AND (SELECT name FROM pragma_index_info(i.name) WHERE seqno = 1) = 'user_id'
) THEN 1 ELSE 0 END;
-- Anonymous analytics events never need a user lookup entry.
CREATE INDEX IF NOT EXISTS idx_analytics_user_created_nonnull
  ON analytics_events(user_id, created_at DESC) WHERE user_id IS NOT NULL;

-- Ensure composite replacements exist before dropping their redundant prefixes.
CREATE INDEX IF NOT EXISTS idx_rankings_user_created ON rankings(user_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_template_items_tpl_position ON template_items(template_id, position);
CREATE INDEX IF NOT EXISTS idx_templates_created ON templates(created_at DESC, id DESC);
-- IF NOT EXISTS must not hide an incompatible index with the same name.
INSERT INTO __quota_0012_guard
WITH expected(name, tbl, cols, partial) AS (VALUES
  ('idx_rankings_user_created','rankings','user_id,created_at,id',0),
  ('idx_template_items_tpl_position','template_items','template_id,position',0),
  ('idx_templates_created','templates','created_at,id',0),
  ('idx_analytics_user_created_nonnull','analytics_events','user_id,created_at',1)
)
SELECT CASE WHEN NOT EXISTS (
  SELECT 1 FROM expected e WHERE NOT EXISTS (
    SELECT 1 FROM pragma_index_list(e.tbl) i
    WHERE i.name = e.name AND i.partial = e.partial AND i."unique" = 0
      AND (SELECT group_concat(name, ',') FROM (SELECT name FROM pragma_index_info(i.name) ORDER BY seqno)) = e.cols
      AND NOT EXISTS (SELECT 1 FROM pragma_index_xinfo(i.name) WHERE key = 1 AND coll <> 'BINARY')
  )
) AND lower((SELECT sql FROM sqlite_schema WHERE name = 'idx_analytics_user_created_nonnull'))
  LIKE '%where user_id is not null' THEN 1 ELSE 0 END;
DROP INDEX IF EXISTS idx_analytics_user_created;
DROP INDEX IF EXISTS idx_rankings_user_id;
DROP INDEX IF EXISTS idx_template_items_template_id;
-- Existing UNIQUE constraints index these leading columns already.
DROP INDEX IF EXISTS idx_votes_ranking_id;
DROP INDEX IF EXISTS idx_template_reactions_template;

-- Lists sort by live aggregates or creation time, never these mirror counters.
DROP INDEX IF EXISTS idx_templates_use_count;
DROP INDEX IF EXISTS idx_templates_view_count;
DROP TABLE __quota_0012_guard;
