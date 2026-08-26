-- Additive only (no DROP) — safe to run against production.
-- Fixes the dominant row-read problem found in docs/row-read-optimization-plan.md: the feed list
-- query (functions/api/rankings.js) had no index to back any of its ORDER BY paths, so every list
-- request did a full table scan + temp-sort before LIMIT was applied. Measured via the D1
-- observability trace at ~2,718 rows read to return 5 posts; confirmed via EXPLAIN QUERY PLAN that
-- these indexes turn every non-personalized branch into a pure index-order scan/seek with no
-- temp-sort step at all.
--
-- Column order in each index matches the exact WHERE + ORDER BY combination used by
-- functions/api/rankings.js and functions/api/templates.js — verified against the real query text,
-- not guessed.
CREATE INDEX IF NOT EXISTS idx_rankings_created_at   ON rankings(created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_rankings_cat_created  ON rankings(category, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_rankings_tpl_likes    ON rankings(template_id, likes_count DESC, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_rankings_user_created ON rankings(user_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_templates_use_count   ON templates(use_count DESC, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_templates_view_count  ON templates(view_count DESC, use_count DESC, id DESC);

-- Backs the templates-list preview query in functions/api/templates.js
-- (`WHERE template_id IN (...) AND position < 4`). Without `position` in the index, D1 must visit
-- every template_items row for each matched template_id before filtering — measured 716 rows read
-- for 50 templates (vs. 933 uncapped) despite only ~200 rows actually being needed. With this
-- composite index, the scan seeks directly to position 0-3 per template_id and stops.
CREATE INDEX IF NOT EXISTS idx_template_items_tpl_position ON template_items(template_id, position);

-- Superseded by the two indexes above for the queries that matter (rankings.js's category/author_id
-- filters now use idx_rankings_cat_created / idx_rankings_user_created because they also cover the
-- created_at ORDER BY) but intentionally NOT dropped here — dropping an index that other, unaudited
-- query shapes might still rely on is a separate, riskier change than this migration's scope.
