-- Requires the current schema through 0008. Apply once through the migration ledger.
-- Preserve every nonempty legacy category as a hashtag before dropping columns.

UPDATE rankings SET hashtags = CASE WHEN trim(COALESCE(hashtags, '')) = ''
  THEN '#' || trim(ltrim(trim(category), '#'))
  ELSE rtrim(hashtags, ', ') || ',#' || trim(ltrim(trim(category), '#')) END
WHERE trim(ltrim(trim(COALESCE(category, '')), '#')) <> ''
AND NOT EXISTS (
  SELECT 1 FROM json_each('[' || replace(json_quote(COALESCE(rankings.hashtags, '')), ',', '","') || ']') tag
  WHERE lower(trim(ltrim(trim(tag.value), '#'))) = lower(trim(ltrim(trim(rankings.category), '#')))
);

UPDATE templates SET hashtags = CASE WHEN trim(COALESCE(hashtags, '')) = ''
  THEN '#' || trim(ltrim(trim(category), '#'))
  ELSE rtrim(hashtags, ', ') || ',#' || trim(ltrim(trim(category), '#')) END
WHERE trim(ltrim(trim(COALESCE(category, '')), '#')) <> ''
AND NOT EXISTS (
  SELECT 1 FROM json_each('[' || replace(json_quote(COALESCE(templates.hashtags, '')), ',', '","') || ']') tag
  WHERE lower(trim(ltrim(trim(tag.value), '#'))) = lower(trim(ltrim(trim(templates.category), '#')))
);

-- New code and old code can both read hashtags during rollout.
INSERT OR IGNORE INTO topic_follows (user_id, topic_type, topic_key, created_at)
SELECT user_id, 'hashtag', lower(trim(ltrim(trim(topic_key), '#'))), MIN(created_at)
FROM topic_follows WHERE topic_type = 'category'
GROUP BY user_id, lower(trim(ltrim(trim(topic_key), '#')));
DELETE FROM topic_follows WHERE topic_type = 'category';

-- Canonical hashtag rows derived from CSV. DISTINCT avoids duplicate tag counts.
CREATE VIEW IF NOT EXISTS ranking_hashtags AS
SELECT DISTINCT r.id AS ranking_id, r.user_id,
  lower(trim(ltrim(trim(tag.value), '#'))) AS hashtag
FROM rankings r, json_each('[' || replace(json_quote(COALESCE(r.hashtags, '')), ',', '","') || ']') tag
WHERE trim(ltrim(trim(tag.value), '#')) <> '';
CREATE VIEW IF NOT EXISTS template_hashtags AS
SELECT DISTINCT t.id AS template_id, t.creator_id,
  lower(trim(ltrim(trim(tag.value), '#'))) AS hashtag
FROM templates t, json_each('[' || replace(json_quote(COALESCE(t.hashtags, '')), ',', '","') || ']') tag
WHERE trim(ltrim(trim(tag.value), '#')) <> '';
