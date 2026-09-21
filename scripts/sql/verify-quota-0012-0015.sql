-- Read-only. Expect analytics_without_rowid=1, unread_triggers=4,
-- score_lookup_retained=1, unread_mismatches=0 and orphan_analytics=0.
SELECT wr AS analytics_without_rowid FROM pragma_table_list WHERE name = 'analytics_events';
SELECT COUNT(*) AS unread_triggers FROM sqlite_schema WHERE type = 'trigger'
  AND tbl_name = 'notifications' AND name IN ('notification_unread_insert',
    'notification_unread_delete','notification_unread_update_old','notification_unread_update_new');
SELECT COUNT(*) AS score_lookup_retained FROM sqlite_schema WHERE name = 'idx_ris_ranking';
WITH expected AS (
  SELECT user_id, COUNT(*) AS n FROM notifications WHERE is_read = 0 GROUP BY user_id
), mismatches AS (
  SELECT e.user_id FROM expected e LEFT JOIN notification_unread_counts c ON c.user_id = e.user_id
  WHERE c.user_id IS NULL OR c.unread_count <> e.n
  UNION ALL
  SELECT c.user_id FROM notification_unread_counts c LEFT JOIN expected e ON c.user_id = e.user_id
  WHERE e.user_id IS NULL AND c.unread_count <> 0
)
SELECT COUNT(*) AS unread_mismatches FROM mismatches;
SELECT COUNT(*) AS orphan_analytics FROM analytics_events e LEFT JOIN profiles p ON p.id = e.user_id
WHERE e.user_id IS NOT NULL AND p.id IS NULL;
SELECT name FROM d1_migrations WHERE name GLOB '001[2-5]_*.sql' ORDER BY name;
