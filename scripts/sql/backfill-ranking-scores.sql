-- Backfill ranking_item_scores for historical rankings with template_id
-- Formula: tierIndex = index of tier in template.tiers (0-based)
--          score = tierCount - tierIndex
-- Null tiers are omitted. Idempotent via INSERT OR IGNORE and NOT EXISTS.
INSERT OR IGNORE INTO ranking_item_scores (id, ranking_id, template_id, item_id, tier_index, score, created_at)
SELECT
  lower(hex(randomblob(16))) AS id,
  r.id AS ranking_id,
  r.template_id,
  ri.item_id,
  CAST(j.key AS INTEGER) AS tier_index,
  (json_array_length(t.tiers) - CAST(j.key AS INTEGER)) AS score,
  COALESCE(r.created_at, CURRENT_TIMESTAMP) AS created_at
FROM rankings r
JOIN templates t ON r.template_id = t.id
JOIN ranking_items ri ON ri.ranking_id = r.id
JOIN json_each(t.tiers) j ON json_extract(j.value, '$.label') = ri.tier
WHERE r.template_id IS NOT NULL
  AND ri.tier IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM ranking_item_scores ris
    WHERE ris.ranking_id = r.id AND ris.item_id = ri.item_id
  );
