-- Deletes ONLY seed-owned rows so seed.sql / templates-seed.sql /
-- community-rankings-seed.sql can be re-applied cleanly (INSERT OR IGNORE
-- can't update a row that already exists with different data).
--
-- Safe to run against production: every pattern below matches seed data
-- exclusively, never real user content. See README.md "Deploying" for why.
-- Harmless no-op if none of this data is present yet.
--
-- Order: children before parents (defensive — template_views/rankings.template_id
-- carry no FK, but this keeps the file correct even if that ever changes).
PRAGMA foreign_keys = OFF;

-- votes: seed.sql uses 'vote_%', the community generator uses 'v2_%'.
-- Real votes are bare crypto.randomUUID() (functions/api/votes.js) — never
-- matches either pattern.
DELETE FROM votes WHERE id LIKE 'vote\_%' ESCAPE '\' OR id LIKE 'v2\_%' ESCAPE '\';

-- comments: seed.sql uses 'comm_%', the community generator uses 'cm2_%'.
-- Real comments are bare crypto.randomUUID() (functions/api/comments.js).
DELETE FROM comments WHERE id LIKE 'comm\_%' ESCAPE '\' OR id LIKE 'cm2\_%' ESCAPE '\';

-- ranking_items: seed.sql uses 'ri_%', the community generator uses 'rki_%'.
DELETE FROM ranking_items WHERE id LIKE 'ri\_%' ESCAPE '\' OR id LIKE 'rki\_%' ESCAPE '\';

-- rankings: seed.sql uses 'rank_%', the community generator uses 'rk_%'.
-- Real rankings are bare crypto.randomUUID() (functions/api/rankings.js:150).
DELETE FROM rankings WHERE id LIKE 'rank\_%' ESCAPE '\' OR id LIKE 'rk\_%' ESCAPE '\';

-- template_views: no seed file has ever inserted rows here (view counts only
-- come from the real POST /api/templates endpoint) — nothing to delete, kept
-- here as a marker so the omission reads as deliberate, not forgotten.

-- template_items: only ever written by templates-seed.sql, id prefix 'ti_%'.
DELETE FROM template_items WHERE id LIKE 'ti\_%' ESCAPE '\';

-- templates: no endpoint ever creates one (functions/api/templates.js has no
-- INSERT) — every row with id 'tmpl_%' is seed data by construction.
DELETE FROM templates WHERE id LIKE 'tmpl\_%' ESCAPE '\';

-- items: legacy table, only ever written by seed.sql, id prefix 'item_%'.
-- No API endpoint inserts into this table at all.
DELETE FROM items WHERE id LIKE 'item\_%' ESCAPE '\';

-- profiles: curator_/community_/filler_ prefixes are seed-exclusive (safe to
-- pattern-match). Seed *users* from seed.sql are NOT pattern-matched on
-- purpose — real accounts are 'user_' + crypto.randomUUID() (auth.js:27),
-- which also starts with 'user_', so a LIKE 'user\_%' here would delete real
-- registered accounts. List the 5 seed ids explicitly instead.
DELETE FROM profiles WHERE id LIKE 'curator\_%' ESCAPE '\'
   OR id LIKE 'community\_%' ESCAPE '\'
   OR id LIKE 'filler\_%' ESCAPE '\'
   OR id IN ('user_001', 'user_002', 'user_003', 'user_004', 'user_005');

PRAGMA foreign_keys = ON;
