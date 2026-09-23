-- Recent-activity trending (Home feed, feed_type=trending).
--
-- Trends should rank by RECENT activity, not by a big accumulated like count
-- that keeps a dead post at the top forever. last_activity_at records the last
-- moment something actually happened to a ranking: creation, a like transition,
-- or a comment/reply (see functions/api/rankings.js trendingOrder, votes.js and
-- comments.js). The trending ORDER BY uses
--
--   COALESCE(r.last_activity_at, r.created_at)
--
-- so late-computed freshness falls back to creation time for pre-existing rows
-- and for any ranking written before this column existed.
--
-- No DEFAULT CURRENT_TIMESTAMP on purpose: SQLite rejects a non-constant
-- default in ADD COLUMN once the table already has rows, and keeping the
-- migrated schema byte-identical to schema.sql matters (schema.sql declares the
-- same plain column; the ranking INSERT sets the value explicitly).
--
-- Backfill: pre-existing rows get created_at, which reproduces the old
-- trending key exactly — a newly-migrated feed ranks the same as before until
-- real activity lands.
ALTER TABLE rankings ADD COLUMN last_activity_at DATETIME;

UPDATE rankings SET last_activity_at = created_at WHERE last_activity_at IS NULL;