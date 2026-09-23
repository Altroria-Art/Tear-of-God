# Recent-Activity Trending (Home feed, `feed_type=trending`)

Status: implemented, tested locally, not deployed, not committed.

## Problem

Trending ranked by accumulated `likes_count` alone. A post with a large like
count stays pinned at the top forever (`tests/local/trending-recent-activity.mjs`
case A seeds a 20-day-old, 100-like post that should decay). Trending should
favor *recent* activity — creation, likes, comments — so a dead post falls even
if its totals are big, while a fresh (or freshly-interacted) post can surface.

Scope constraint (honored): **only** the `feed_type=trending` ordering and its
update points. For You (personalized) and Following keep `created_at DESC`
unchanged (verified in case H). The Trending UI, seed/shuffle behavior, and
cache topology are untouched.

## Migration (0019)

`migrations-active/0019_add_ranking_last_activity.sql`:

```sql
ALTER TABLE rankings ADD COLUMN last_activity_at DATETIME;
UPDATE rankings SET last_activity_at = created_at WHERE last_activity_at IS NULL;
```

- **No `DEFAULT CURRENT_TIMESTAMP` on purpose.** Verified by probe: SQLite
  rejects a non-constant default in `ADD COLUMN` once the table has rows
  (`Cannot add a column with non-constant default`). `schema.sql` declares the
  same plain `last_activity_at DATETIME` column so migrated and fresh DBs are
  byte-identical (kept `schema.sql`/`migration-baseline` reproducibility — a
  staged 0019 → deploy → 0010-style split is not needed here).
- **Backfill = `created_at`.** For pre-migration rows this makes
  `COALESCE(last_activity_at, created_at)` reproduce the *old* trending key
  exactly, so a newly-migrated feed ranks identically until real activity
  lands. The rehearsal step in the test runs 0019 against a populated legacy
  `rankings` table built by `node:sqlite` and asserts the backfill.
- Deployment is a single statement batch on the existing `rankings` table:
  `npx wrangler d1 execute tear-of-god-db --file=./migrations-active/0019_add_ranking_last_activity.sql`
  (per `docs/production-d1-migration-runbook.md`).

## Update points

A ranking's `last_activity_at` is written in exactly three places:

1. **Create** — `functions/api/rankings.js:954`: the existing rankings INSERT
   now includes `last_activity_at` set to `CURRENT_TIMESTAMP`:
   `INSERT INTO rankings (id, template_id, title, description, hashtags, user_id, last_activity_at) VALUES (?1..?6, CURRENT_TIMESTAMP)`.
2. **Like** — `functions/api/votes.js:67` and `:82`: only the *new-like*
   transitions refresh (no-vote → like, and dislike → like). Unlike and
   dislike do **not** touch the column (Q: should a stale dislike decay rank?
   No — dislike already subtracts via the score term and votes are one-way
   transitions per user; refresh-on-like-only keeps the signal "something
   positive happened"). Guarded to a 60s echo-suppression window:
   `UPDATE rankings SET last_activity_at = CURRENT_TIMESTAMP WHERE id = ? AND (last_activity_at IS NULL OR last_activity_at < datetime('now', '-60 seconds'))`.
3. **Comment** — `functions/api/comments.js:57`: every new comment POST (both
   top-level and replies, same batch, `ranking_id` scope) sets
   `last_activity_at = CURRENT_TIMESTAMP`. Comment deletes do not revert it.
   This covers `likedTransition`'s reply path for free.

New rows always have it set, so the original creation boosts a fresh ranking
into the top bucket immediately (case A: fresh 0/0 outranks the 20d/100-like
accumulation).

## Scoring formula (the deviation, justified)

Suggested formula was: bucket freshness (100 scale) **+ likes×2 + comments×3**,
caps optional. The buckets alone *fail* the core requirement though: a
20-day-old 100-like post scores `0 + 200 = 200` and still tops a fresh 0/0 post
(`100 + 0 = 100`). Anyone can game "trending" by inflating likes once and
pinning it forever — that is the exact failure being fixed, just relocated from
likes_count to a weighted likes term.

The implemented formula keeps the same freshness buckets (the horizontal shape
the task asked for) but makes engagement strictly secondary:

```
freshness(COALESCE(last_activity_at, created_at))   -- 100 / 75 / 50 / 30 / 15 / 5 / 0
+ min(likes_count,   50)
+ min(comments_count,25) * 2
- dislikes_count
ORDER BY score DESC, COALESCE(last_activity_at, created_at) DESC, created_at DESC, id DESC
```

- `min()` is 2-arg scalar `min(a,b)` — `LEAST()` is **not available** in this
  SQLite build (probe: `no such function: LEAST`).
- Caps mean accumulated engagement past the cap adds *nothing* — a 20d/500-like
  post is still scored as `0 + 50`, well below any fresh `100 + anything`.
  Small engagement still lifts recent ties, which is the intent.
- Dislike adds a mild negative so heavy-dislike posts recede; the top
  freshness bucket (15 min) always beats any engagement sum because the max
  engagement addend is `50 + 50 = 100` versus freshness `100`… but a fresh post
  still wins any engagement tie and freshness strictly dominates when all else
  is equal, so a brand-new 0/0 sits above even the most-liked 7-day-old post.

Score margins verified in `tests/local/trending-recent-activity.mjs` cases
A–D: fresh 0/0 (100) > 20d/100-like (50); recently-liked 10d post (100 + 5 =
105) > 20d/60-like (50); recently-commented 20d post (100 + 6 = 106) > 30d/80
-like (50); fresh (75) > 2h/8-like (58) > 30d/60-like (50).

## Index / execution plan

No new index. `function liveSearch` — more precisely the pool ORDER BY — is a
pure computed expression over `CASE` + `min()` + arithmetic, so SQLite has no
usable index for the sort. The test probes `EXPLAIN QUERY PLAN` against Miniflare D1:

```
SCAN rankings
USE TEMP B-TREE FOR ORDER BY
```

An index on `last_activity_at` is useless for this sort *and* adds a write per
like/comment — rejected. The scan cost is unchanged from the pre-change
behavior (the old trending ORDER BY was also computed) and the pool query is
already LIMIT-bounded and cached.

## Cache interaction (~1 min reflection)

`functions/lib/pool-cache.js`:

- `TRENDING_POOL_CACHE_TTL_SECONDS` 180 → **60** so a like/comment lands in
  the trending pool within ~1 minute (`test/trending-pool-cache.mjs` asserts its
  60..600 window, 60 is the floor, still tight enough for infinite scroll).
- `TRENDING_POOL_CACHE_VERSION` `'v2'` → `'v3'`, `SHARED_HOME_TRENDING_VERSION`
  `'v3'` → `'v4'` — hard-invalidates any pool previously ordered by the old
  formula on deploy.
- L2 (shared) TTL stays 5s; the memory bridge stays ≤ L2; for_you/following
  still bypass both.

## Quota impact

- One extra statement per like batch (`+1`), one per comment batch (`+1`).
  `verified-session-mutations.mjs` (maxStatements budget 8) still passes at
  exactly 8.
- `trending-pool-cache.mjs` still proves ≥1 pool query for the first page of a
  cold seed (`Cold new cache: 1 D1 query`); the 60s TTL only lowers the cache
  hit duration, per-scan row reads are unchanged (same WHERE + ORDER BY form).
- No new tables/indexes → no migration-fanout.

## Tests

`tests/local/trending-recent-activity.mjs` (run with `node`, Miniflare D1 built
from `schema.sql` + the four fixtures; this file is not covered by `npm test`
— there is no test runner):

- **A** — fresh 0/0 ranks above 20d/100-like (the core regression).
- **B** — a like via the real votes handler lifts an old 5-like post above a
  stale 60-like one (order flips after `sleep(5500)` + fresh cache to drain the
  TTL).
- **C** — a comment lifts an old post above a stale high-like one (same flip).
- **D** — inactive 30d/60-like post falls below active low-engagement posts.
- **E** — unlike does NOT refresh `last_activity_at`.
- **F** — dislike does NOT refresh; a dislike→like transition DOES.
- **G** — both a top-level comment and a reply refresh.
- **H** — trending by activity while for_you and following stay by `created_at`.
- **I** — `NULL` `last_activity_at` (pre-migration rows) falls back to
  `COALESCE(…, created_at)`; 0019 is asserted to be plain ALTER + backfill with
  **no** `DEFAULT CURRENT_TIMESTAMP`.
- Migration rehearsal on a populated legacy table (ADD COLUMN + backfill).
- `EXPLAIN QUERY PLAN` assertion (`SCAN` + `USE TEMP B-TREE`).

Regression suite re-run green after the change:
`trending-pool-cache.mjs`, `ranking-atomicity.mjs`, `cold-feed-reads.mjs`,
`verified-session-mutations.mjs`, `comment-self-delete.mjs`.
`oxlint` clean (0 errors / 4 pre-existing warnings), `vite build` clean.
`_addcol_probe_tmp.mjs` (throwaway probe) deleted.

## Deployment steps

1. Apply 0019 to prod D1 (single ALTER + UPDATE):
   `npx wrangler d1 execute tear-of-god-db --file=./migrations-active/0019_add_ranking_last_activity.sql`.
2. Deploy functions (brings the new version keys + TTL + formula).
3. (Optional, observed) verify the cache versions flipped by watching the cache
   header the pool emits on a trending request.

Order matters only in that the ALTER must land before the new code reads the
column — the version-bump run rebuilds pools afterward anyway.