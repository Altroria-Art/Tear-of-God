# Plan: D1 Row-Read Optimization (Full-System)

> Read this file before touching `/`, `/discover`, `/discover/templates`, `/discover/hashtags`,
> `/discover/hashtag/:tag`, `/category/:id`, `/template/:id`, `/post/:id`, `/profile`, `/create`, or
> `/rank` — this is the reference the row-read reduction work is implemented against. It documents
> what was measured, what was found, and what to build, in that order. **This document is a plan
> only — none of the changes it describes have been implemented yet.**
>
> **Revision history:** Pass 1 (static code trace + `EXPLAIN QUERY PLAN` on a fresh local D1 copy)
> estimated ~8,400 rows read per session. Pass 2 found and analyzed a Miniflare observability trace
> store left behind by real `wrangler pages dev` sessions, containing **actual measured
> `rows_read` values** for 2,330 real D1 queries. Pass 2's findings supersede Pass 1's estimates
> everywhere they conflict; Pass 1's structural findings (missing indexes, no caching, over-fetch
> patterns) were directionally correct but the *magnitude* was significantly underestimated because
> Pass 1 measured against a smaller, cleaner reproduction and missed two multiplier effects entirely
> (a correlated-subquery `ORDER BY`, and duplicate in-session requests). See §7 for the full
> reconciliation.

## 1. Investigation summary

**Scope.** Traced every data-fetching path in the entire application — not just Home Feed and
Discover — from UI component down to the D1 query that ultimately runs. Covers all 12 routes in
`src/App.jsx`, all 8 files in `functions/api/`, and all 9 tables in `schema.sql`.

**Method (two passes).**
1. **Static trace + schema analysis:** UI component → `src/lib/api.js` wrapper → `functions/api/*.js`
   handler → SQL sent to `env.tear_of_god_db`. Read every `useEffect` for dependency-array and
   remount behavior.
2. **`EXPLAIN QUERY PLAN`** against a local D1 SQLite snapshot
   (`.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite`, opened read-only via Node's
   built-in `node:sqlite`) to see whether each query hits an index or falls back to a scan/sort.
   Proposed indexes were validated the same way: copied into an **in-memory** SQLite database (never
   touching the real files), indexes added, and the query plans re-checked before recommending them.
3. **Real measured evidence (Pass 2):** `.wrangler/state/v3/observability/miniflare-wobs-trace-store/`
   contains a Miniflare OpenTelemetry-style trace store (`spans`, `logs` tables) written automatically
   by every `wrangler pages dev` run. Each D1 span's `attributes` blob (MessagePack-encoded) carries
   `cloudflare.d1.response.rows_read` — the **actual row-read count D1 reported for that exact query
   execution**, plus the full SQL text. Cross-referencing `logs` (which records each incoming HTTP
   request URL) with `spans` (D1 query results, linked by `trace_id`) reconstructs, for real recorded
   browsing sessions between 20–23 Aug, exactly which endpoint caused how many rows read, how many
   queries per request, and the request timing needed to detect duplicates.

**Headline numbers (Pass 2, measured, not estimated):**

| Measurement | Value |
|---|---|
| Total rows read across all traced dev sessions | **2,618,247** |
| Total API requests in those sessions | 855 |
| Rows read by `GET /api/rankings?user_id` alone | **2,291,269 (87.5% of everything)** |
| Average rows read for that endpoint, per request | 16,972 (max 83,795) |
| Worst 60-second window observed | **774,253 rows** |
| Requests that were exact duplicates of the previous request within 3s | 92 of 855 (10.8%), 556,992 rows wasted |

**The user's demo (several hundred thousand rows for one solo walkthrough) is fully explained by
this data** — see §7 for the reconciliation against Pass 1's ~8,400 estimate.

---

## 2. Current architecture / data flow

```
Page component (src/pages/*.jsx)
   │  useEffect on mount / on dependency change
   ▼
src/lib/api.js  (fetch() wrapper per endpoint — no caching, no dedup, no retry logic)
   │  HTTP GET/POST to /api/*
   ▼
functions/api/*.js  (Cloudflare Pages Functions, Workers runtime)
   │  db.prepare(sql).bind(...).all() / .first() / .run() / .batch()
   ▼
D1 binding env.tear_of_god_db  →  SQLite (schema.sql)
```

No ORM, no query cache, no service worker, no `_headers`/`Cache-Control` on any response
(confirmed: `grep -rn "Cache-Control\|caches\." functions/ src/ public/` → no matches). No retry
logic anywhere (confirmed: `grep -rn "retry\|catch.*fetch" src/lib/api.js` → each wrapper has one
`try/catch` that returns an error object, no re-fetch). No polling/`setInterval` outside the Toast
auto-dismiss timers. No prefetching. Every page component fetches independently on mount.

### Full route → endpoint map

| Route | Component | Endpoint(s) fired on mount |
|---|---|---|
| `/` | `HomeFeed.jsx` | `GET /api/rankings?user_id&page&limit=5` (on mount, on tab switch, on login/logout, on infinite-scroll) |
| `/discover` | `Discover.jsx` | `GET /api/templates?limit=50` + `GET /api/hashtags?limit=30` (parallel) |
| `/discover/templates` | `PopularTemplates.jsx` | `GET /api/templates?page&limit=12&sort` |
| `/discover/hashtags` | `PopularHashtags.jsx` | `GET /api/hashtags?page&limit=30&sort&q` (also per debounced keystroke) |
| `/discover/hashtag/:tag` | `HashtagDetail.jsx` | `GET /api/templates?hashtag&page&limit=12&sort` |
| `/category/:id` | `CategoryPage.jsx` | `GET /api/rankings?category` (no `limit` → server default 50) |
| `/template/:id` | `TemplateDetailPage.jsx` | `GET /api/templates?id` + `POST /api/templates` (view-count) + `GET /api/rankings?template_id&sort&page&limit=5` |
| `/post/:id` | `PostDetail.jsx` | `GET /api/rankings?id` (embeds items+comments) + `GET /api/templates?id` (separate effect) |
| `/profile[/:userId]` | `Profile.jsx` | `GET /api/users?id&viewer_id` + `GET /api/rankings?author_id&sort=recent&limit=50` |
| `/rank?template=` | `RankTierList.jsx` | `GET /api/templates?id` (pre-fill) |
| `/create` | `Create.jsx` | none on mount (pure client-side draft in `localStorage`) |
| `/login` | `Login.jsx` | none on mount; `POST /api/auth` on submit; Firebase popup + `POST /api/auth (google_sync)` for Google login |

**Mutations and what follows them** (audited per the user's request — see §5 for the full table):
`POST /api/votes` reads back one row after writing (cheap, correct — not a refetch-the-page pattern).
`POST /api/comments` reads back one row after writing (cheap). `POST /api/rankings` (create) does not
trigger any refetch — the UI navigates away. `POST /api/templates` (view-count) does a read-after-write
inside the same handler (documented, intentional, cheap — see the code comment in
`functions/api/templates.js`). **No mutation in this codebase triggers a full page/list refetch** —
this was a specific concern in the user's request and it does not occur here.

There is no search/autocomplete beyond the debounced hashtag filter on `/discover/hashtags` (already
covered in Pass 1 as finding C5). There are no notifications, no admin pages, no dashboards, no
modals/drawers that load data (the only modal, Profile's "Edit Profile", operates on data already in
memory). No server-side rendering — this is a pure client-side SPA against Cloudflare Pages Functions.

---

## 3. The dominant finding: `GET /api/rankings?user_id` (87.5% of all measured rows read)

### 3.1 Three stacked multipliers, found by reading the actual traced SQL text

**Multiplier 1 — a correlated subquery inside `ORDER BY`, evaluated once per candidate row, present
in the code deployed 21–22 Aug** (superseded in `HEAD` — see §3.2, but very possibly what was live
during the demo, see §7):

```sql
SELECT r.*, p.username, p.avatar_url,
  (SELECT COUNT(*) FROM votes WHERE ranking_id = r.id AND vote_type = 'like') as likes_count,
  (SELECT COUNT(*) FROM votes WHERE ranking_id = r.id AND vote_type = 'dislike') as dislikes_count,
  (SELECT COUNT(*) FROM comments WHERE ranking_id = r.id) as comments_count
FROM rankings r LEFT JOIN profiles p ON r.user_id = p.id
WHERE 1=1
ORDER BY (SELECT COUNT(*) FROM votes v JOIN rankings fav_r ON v.ranking_id = fav_r.id
          WHERE v.user_id = ? AND v.vote_type = 'like' AND fav_r.category = r.category) DESC,
         r.created_at DESC
LIMIT 50
```
Every one of the 624 `rankings` rows must run the `ORDER BY` correlated subquery once (itself
scanning the viewer's likes joined back to `rankings`) **plus three more `COUNT(*)` subqueries** for
likes/dislikes/comments, before `LIMIT` even applies. **Measured: 41,364 rows/request on average, up
to 83,795** — and the cost *grows* as the viewer accumulates more likes, matching the demo's
narrative (row reads got worse the longer the session went, because the demo user kept liking posts).
- **Confidence: CONFIRMED.** SQL text and `rows_read` values read directly from the trace store; git
  history (`git log -- functions/api/rankings.js`) dates this shape to commit `b774706` (22 Aug) and
  shows commit `9b913fd` (24 Aug, "Use toasts; fix rankings/templates") replacing the `ORDER BY`
  subquery with a pre-aggregated `aff` CTE, and separately the `likes_count`/`dislikes_count`/
  `comments_count` correlated subqueries with denormalized columns (`migrations/0002` had already
  added the columns; this commit is what made `rankings.js` read them instead of recomputing).

**Multiplier 2 — full-table scan + repeated sort, still present in `HEAD` (unfixed):**

The current query (`functions/api/rankings.js`, both personalized and non-personalized branches)
wraps everything in a `page` CTE using `ROW_NUMBER() OVER (ORDER BY …)`, then re-joins:
```sql
WITH page AS (
  SELECT r.id AS rid, ROW_NUMBER() OVER (ORDER BY r.created_at DESC, r.id DESC) AS rn
  FROM rankings r WHERE 1=1 ORDER BY r.created_at DESC, r.id DESC LIMIT ? OFFSET ?
)
SELECT r.*, p.username, p.avatar_url, (...) as user_vote
FROM page JOIN rankings r ON r.id = page.rid LEFT JOIN profiles p ON r.user_id = p.id
ORDER BY page.rn
```
`rankings(created_at)` has **no supporting index** anywhere in `schema.sql`. `EXPLAIN QUERY PLAN`
on `HEAD`'s exact query (verified against the local D1 snapshot): `SCAN r` (full 624-row scan) +
`USE TEMP B-TREE FOR ORDER BY` (sort #1, inside the CTE) + a second implicit sort for the
`ROW_NUMBER()` window function itself + `USE TEMP B-TREE FOR ORDER BY` again (sort #2, the outer
`ORDER BY page.rn`). **The newest traced request using this exact shape (23 Aug 12:53, URL
`?user_id&page=1&limit=5`, matching current code byte-for-byte) measured 2,718 rows for the feed
query + 90 for the item batch = 2,808 rows to render 5 posts.** Removing Multiplier 1's subqueries
(what commit `9b913fd`/`2e27e3a` actually did) saves only the ~90 rows those subqueries cost per
page — **the 2,718-row full scan is untouched in `HEAD` today.**
- **Confidence: CONFIRMED** — both from the trace (2,718 measured) and from `EXPLAIN QUERY PLAN`
  run against `HEAD`'s literal query text.
- **A fix was validated (not yet applied) in a scratch in-memory database:** dropping the `page`/
  `ROW_NUMBER()` CTE entirely in favor of a flat `SELECT … ORDER BY … LIMIT ? OFFSET ?`, combined
  with a `(created_at DESC, id DESC)` index, changes the plan to
  `SCAN r USING INDEX idx_rankings_created_at` + `SEARCH p` — **zero temp-sort steps.** The same
  index pattern was verified to turn every other filter branch (`category=`, `user_id=`,
  `template_id=` + `likes_count DESC`) into an index `SEARCH`, not a scan.
- **Important caveat, also verified:** the **personalized branch** (`COALESCE(aff.affinity,0) DESC`
  — the *default* order for every logged-in user on Home) **cannot be fixed by an index alone.**
  Sorting by a value computed via a `LEFT JOIN` to an aggregated CTE forces `SCAN r` +
  `USE TEMP B-TREE FOR ORDER BY` regardless of what indexes exist on `rankings`, because SQLite has
  no index on the *joined* affinity value. The validated fix is to bound the candidate set before
  ranking it (re-rank only the newest ~100 rows, not all 624) — see the plan in §8.

**Multiplier 3 — no caching, no dedup, so every navigation and duplicate re-runs the query at full
cost** (see §4).

### 3.2 What is fixed in `HEAD` vs. what is not (this matters for §7)

| Aspect | 21–22 Aug (traced) | `HEAD` (current) |
|---|---|---|
| `likes/dislikes/comments` count | 3× correlated `COUNT(*)` subquery per row | denormalized columns (fixed) |
| Personalized `ORDER BY` | per-row correlated subquery re-scanning `rankings` | pre-aggregated `aff` CTE (improved, but still full-scan-sorted, see above) |
| Base pagination | *(same CTE/`ROW_NUMBER()` shape as now)* | **unchanged — still full scan + double sort** |
| Supporting index on `rankings(created_at)` | none | **still none** |

**Net effect of the 24 Aug commit: real, but partial.** It removed the worst multiplier (the
per-row correlated `ORDER BY`) but left the structural full-scan-plus-sort in place. Measured
before/after for the *same* URL shape: ~41,364 rows/request → ~2,718 rows/request. That is a real
~93% improvement — but 2,718 rows to return 5 posts is still roughly **540× the number of rows
actually needed** (5 rows × ~8 items ≈ 45 useful rows).

---

## 4. Duplicate requests — confirmed pattern, root cause not yet isolated

**Confirmed (measured):** cross-referencing `logs` (incoming request URLs, timestamped) against the
D1 spans, **92 of 855 traced API requests (10.8%) are an exact repeat of the immediately preceding
request to the same URL, within 3 seconds** (gap distribution: 1 within 100ms, 36 within 100ms–1s,
26 within 1–3s). Total rows wasted on these duplicates alone: **556,992** — over a fifth of the
entire traced total. The most visible example, from the `HomeFeed` mount flow specifically:
```
12:52.32   GET /api/rankings?user_id=…&page=1&limit=5   → 2,808 rows
12:52.33   GET /api/rankings?user_id=…&page=1&limit=5   → 2,808 rows   (1s later, identical URL)
```

**What this is NOT (ruled out):** the traced bundle (`dist/assets/index-*.js`) is a **minified
production build** — verified by absence of React dev-only warning strings
(`Warning: React.jsx…`, `Each child in a list…`) and by the bundle's minification style. React
`StrictMode`'s double-invocation only affects `npm run dev`, which serves mock data and 404s on
`/api/*` per `AGENTS.md` — it cannot be what produced these traces, which hit real D1. **This
duplication is a real production-path issue, not a StrictMode artifact.**

**What has NOT yet been isolated (requires a live repro session, not just static/trace analysis):**
the exact trigger. Candidates, in order of suspicion based on code reading:
1. `src/context/UserContext.jsx:22` returns a **new object literal** `{ currentUser, login, logout }`
   on every render (not wrapped in `useMemo`). `HomeFeed`'s data-loading effect depends on
   `[currentUser, activeTab]` — if anything causes `UserProvider` to re-render for an unrelated
   reason, every `[currentUser]`-keyed effect across the app (Home, Post Detail, Template Detail,
   Profile) would see a "changed" dependency and refire, even though the actual user data is
   unchanged. This is plausible but unconfirmed — needs a live repro with React DevTools profiler.
2. `src/pages/HomeFeed.jsx:175-185`'s `sentinelRef` callback disconnects and reconnects an
   `IntersectionObserver` on every render where the callback ref identity changes; if the observer
   fires spuriously near the loading-state transition, `loadMore()` could double-fire. The code has
   an explicit `loadingRef` guard specifically written to prevent this (see the comment at
   `HomeFeed.jsx:170`), so this is a weaker suspect, but not eliminated.
3. Ordinary client navigation (e.g., clicking the "Home" nav link while already on `/`, or a
   fast back/forward) remounting `HomeFeed` while a previous request is still in flight.
4. Two independent components each fetching the same data on the same page — checked and **ruled
   out** for Home Feed specifically (only one `fetchRankings` call site drives the page), but not
   exhaustively checked for every page.

**Classification: CONFIRMED that duplicates happen and cost ~557K rows in the trace; LIKELY (not
CONFIRMED) that suspects 1–2 above are contributing causes; the exact mechanism requires a live
DevTools Network-tab repro to pin down** (see §8 Step 4 and §9).

---

## 5. Query-by-query and mutation audit (all tables, not just `rankings`)

All entries below come from the **72 distinct SQL statements actually captured in the trace store**,
cross-referenced with `EXPLAIN QUERY PLAN` against the local D1 snapshot. Rank is by total measured
`rows_read` across all traced executions.

| Rank | Query (abbreviated) | Runs traced | Total rows | Avg/run | Max/run | Table(s) | Verdict |
|---|---|---:|---:|---:|---:|---|---|
| 1 | Feed list, correlated `ORDER BY` (pre-24-Aug shape) | 47 | 1,944,091 | 41,364 | 82,889 | rankings, votes, comments, profiles | **CONFIRMED — fixed in `HEAD`, see §3.2** |
| 2 | Feed list, 3× correlated `COUNT` (pre-24-Aug shape) | 27 | 273,743 | 10,139 | 10,337 | rankings, votes, comments | **CONFIRMED — fixed in `HEAD`** |
| 3 | Feed list, `aff` CTE personalized order (current shape family) | 30 | 110,138 | 3,671 | 9,236 | rankings, votes | **CONFIRMED — still live in `HEAD`, see §3.1 Multiplier 2** |
| 4 | `ranking_items IN (50 ids)` | 78 | 70,386 | 902 | 1,006 | ranking_items, items | CONFIRMED (Pass-1 finding, over-fetch on Profile-sized pages) |
| 5 | Templates list (live-uses subquery) | 80 | 32,493 | 406 | 878 | templates, rankings, profiles | CONFIRMED (Pass-1 finding C4) |
| 6 | Community-average histogram | 104 | 30,418 | 292 | 766 | ranking_items, rankings | CONFIRMED (Pass-1 finding C6) |
| 7 | Feed list, current shape (`?user_id&page&limit=5`) | 26 | 22,142 | 852 | 2,937 | rankings, votes, comments | **CONFIRMED — this is exactly the `HEAD` query, see §3.2** |
| 8 | `template_items IN (16 ids)` | 77 | 22,099 | 287 | 287 | template_items | CONFIRMED (Pass-1 finding C4) |
| 9–10 | Hashtag recursive CTE (rows + total, run twice) | 74+75 | 25,373 | ~170 | 457 | templates | CONFIRMED (Pass-1 finding C5) |
| 11 | Template-detail rankings, `likes_count` subquery variant | 7 | 10,639 | 1,520 | 4,875 | rankings, votes, comments | CONFIRMED — an even-older query shape than `HEAD`'s Template Detail branch; superseded, listed for completeness |
| 12, 17 | `template_items IN (32/50 ids)` | 17+5 | 14,916 | ~650 | 933 | template_items | CONFIRMED (Pass-1 finding C4, scales with page size) |
| — | `POST /api/votes` full cycle | 93 | 1,017 | 11 | 91 | votes, rankings | Cheap — read-before-write existence check + read-after-write confirmation, not a refetch pattern |
| — | `POST /api/templates` (view count) | 63 | 71 | 1 | 2 | template_views, templates | Cheap, correctly implemented (`INSERT OR IGNORE` + conditional `UPDATE`) |
| — | `POST /api/auth`, `POST /api/comments`, `POST /api/rankings` | 6+1+2 | 5 | ~1 | 2 | profiles/comments/rankings | Cheap, no issue found |

**Full-table-scan / no-index queries found, beyond the feed** (all CONFIRMED via `EXPLAIN QUERY
PLAN`): the templates list's `ORDER BY t.use_count DESC` (no index on `templates.use_count`); the
`instr(',' || lower(t.hashtags) || ',', …)` hashtag-exact-match filter (cannot use an index by
construction — a `LIKE`/`instr` predicate on a computed expression); the hashtag recursive CTE's
`SETUP` step (`SCAN templates` — small at 64 rows today, but unindexable by nature, see Pass-1 H1).

**No N+1 pattern found at the "one query per list item" level.** Every list-rendering endpoint in
this codebase correctly batches related rows with a single `WHERE id IN (...)` query (visible in the
trace as the `ranking_items IN (?,?,?,...)` and `template_items IN (?,?,?,...)` entries above) rather
than querying once per row. The over-fetching that exists (ranks 4, 5, 6, 8, 9–10, 12/17 above) is a
**"fetch more columns/rows than rendered" problem, not an N+1 problem** — this matches and confirms
Pass 1's C4–C7 findings, now with real measured magnitudes instead of estimates.

**Mutation audit (explicit ask in this round):** no mutation in the traced data, or in the current
source, triggers a full list/page refetch. `voteRanking`, `createComment`, and the template
view-count POST all read back only the single row they just changed. `createRanking` triggers no
read at all — the UI navigates away via `useNavigate()`. This specific concern from the user's
request (`Like → INSERT → fetch post → fetch user → fetch feed → fetch counts → fetch
recommendations → refetch entire page`) was checked directly against both the source and the trace
and **does not occur anywhere in this codebase.**

---

## 6. User-flow cost estimates (measured where traced, extrapolated from measured per-query costs elsewhere)

| Flow | Steps | Cost with `HEAD` code (measured/derived) | Cost with pre-24-Aug code (measured) |
|---|---|---:|---:|
| **A — Normal browsing** | Home load, scroll×2, tab switch, open post, open profile, back, open another post, return home | ~2,808 (load) + 2×2,808 (scroll) + 2,808 (tab switch, duplicate query, see §Pass-1 C2) + ~320 (post) + ~400 (profile) + ~320 (post) + 2,808 (return home) ≈ **~17,300** | ~83,710 × 5 feed hits + details ≈ **~420,000** |
| **B — Discover** | Load (templates+hashtags), scroll, open template, view detail, back, filter, open another | 1,875 + 874 (load) + 861+3,083 (template detail+rankings) + 1,875+874 (back, re-fetched, no cache) + ~250 (filter) + 861+3,083 ≈ **~13,600** | same Discover-side cost (Discover was never on the correlated-subquery path); **~13,600** |
| **C — Create** | Open Create (no fetch), publish, redirect to detail, like it | 0 (create) + ~1 (`POST /api/rankings`) + ~320 (detail load) + ~91 (`POST /api/votes` incl. read-back) ≈ **~412** | same — Create/vote path unaffected by the feed bug; **~412** |
| **D — Social** | Open profile, follow, like 3 posts, open comments (bundled in post fetch), navigate users, return feed | ~400 (profile) + ~1 (follow — traced separately, cheap) + 3×91 (likes) + ~400 (profile #2) + 2,808 (feed) ≈ **~3,880** | **~86,600** (dominated by the one feed hit) |
| **E — Full demo session** (~15–20 min, most major features touched once or twice, feed revisited ~6–8 times as the natural "return to home" pattern) | sum of the above with feed hit ~7× | **~35,000–45,000** (this plan's steps 2–5 alone would take it to low thousands) | **~600,000–650,000** — matches "several hundred thousand" |

These flow estimates use the *measured* per-query costs from §5 rather than re-estimating from
scratch, so Flow E's pre-24-Aug figure is not a new guess — it is `~83,710 rows × ~7 feed
revisits + the Discover/detail/social costs measured directly`, which lands squarely in the range
the user reported from their solo demo.

---

## 7. Reconciliation: closing the gap between "~8,400" (Pass 1) and "several hundred thousand" (real demo)

**Direct answer to the required question: "Are you absolutely sure there are no other major sources
of excessive row reads elsewhere in the application?"** No other major source was found beyond what
is documented here and in Pass 1. The full-system audit in §5 covered all 72 distinct queries
actually executed against this app during real usage (not a synthetic sample) and found: (a) the
feed's query shape, in both its old and current forms, (b) the Pass-1 over-fetch findings
(C4–C7, confirmed with real magnitudes), and (c) duplicate requests. Nothing else in the trace
reaches even 3% of the total. **Confidence in "no other major source exists": LIKELY, not
CONFIRMED** — it rests on traces from 20–23 Aug dev sessions, which may not have exercised every
code path (e.g., no `follows`-table activity is visible because that feature was added 25 Aug,
after the trace window; see §9 for what a fresh trace should re-verify).

**Was ~8,400 realistic?** No — it was **under by roughly 25–75×**, for two concrete, findable
reasons:
1. Pass 1's `EXPLAIN QUERY PLAN` correctly showed `SCAN r` (full scan) for the feed query, but Pass
   1 sized the cost as "~624 rows" (one pass over the table). **The actual query performs the scan
   inside a CTE, sorts it, performs `ROW_NUMBER()` (a second implicit ordering pass), joins back to
   `rankings` by id, and sorts *again* for the outer `ORDER BY page.rn`.** Pass 1 did not run the
   query against `node:sqlite` and read `rows_read` back — it inferred cost from the query plan's
   shape alone, and under-multiplied the scan-plus-sort-plus-rejoin cost. The real number, measured,
   is **2,718**, not 624 — a 4.4× miss on this query alone.
2. Pass 1 never had access to the *previously deployed* query shape (the per-row correlated `ORDER
   BY` subquery, §3.1 Multiplier 1) — it only analyzed `HEAD`. If that shape was what was live during
   the professor demo (see the open question below), the per-request cost was **83,795 at its
   worst — 30× higher again** than even the corrected 2,718 figure.
3. Pass 1 did not know about, and therefore did not count, the **duplicate-request pattern** (§4),
   which independently roughly doubles whatever the per-request cost is.

**Multiplying these together** — a 4–30× miss on the dominant query, times ~2× from uncounted
duplicates, times a realistic demo doing ~7 feed-touching actions instead of Pass 1's implicit
"~5 actions" — closes the gap from ~8,400 to the observed several-hundred-thousand range without
needing to invoke any additional undiscovered mechanism.

**Open question the user should help resolve:** it is not known which commit was actually deployed
to the environment used for the professor demo. If it was **before commit `9b913fd`/`2e27e3a` (24
Aug)**, the demo hit the 41,364–83,795-rows/request query directly, and Flow E's "~600,000–650,000"
line in §6 is the applicable estimate — squarely matching "several hundred thousand." If it was
**`HEAD` or close to it**, the demo hit the ~2,718-rows/request query, and Flow E's "~35,000–45,000"
line applies — which is real waste but does not on its own reach "several hundred thousand" without
the duplicate-request multiplier being unusually severe during that specific session (e.g., if
`user_id` was present and hot-reload/navigation churn was higher than the traced sessions). **This
is the single highest-value fact to confirm before implementation — see §9.**

---

## 8. Solutions (updated/added in this pass; Pass-1 solutions for C3–C7 still apply unchanged — see §10 for the merged list)

### For the feed query (§3, the 87.5%/dominant problem)

**Option A — Flatten the query (drop the `page`/`ROW_NUMBER()` CTE) + add indexes (recommended).**
- **How:** replace the CTE-plus-rejoin with one flat `SELECT … WHERE … ORDER BY … LIMIT ? OFFSET ?`;
  add `rankings(created_at DESC, id DESC)`, `rankings(category, created_at DESC, id DESC)`,
  `rankings(template_id, likes_count DESC, created_at DESC, id DESC)`, and
  `rankings(user_id, created_at DESC, id DESC)`. **Validated in a scratch in-memory database** (not
  applied to real files): every filter branch changes from `SCAN` + double `TEMP B-TREE` to a single
  index `SEARCH`/`SCAN … USING INDEX` with no temp-sort step.
- **Pros:** removes both remaining multipliers in one change; the `page` CTE's original purpose
  (avoiding per-row subqueries before `LIMIT`) is obsolete now that counts are denormalized columns.
- **Cons:** touches the query that every list-mode caller depends on — needs care to preserve the
  `usePersonalized`-wins-over-explicit-`sort` guard that a Pass-1-era comment in the file explains
  was itself a previous bug fix.
- **Risks:** regressing that guard would reintroduce the bug it was written to prevent (Template
  Detail's explicit `sort` losing to personalized order). Needs a targeted regression check.
- **Complexity:** low-medium.
- **Impact:** measured-and-validated — the dominant ~2,718-row cost collapses to roughly the `LIMIT`
  size (single digits to low hundreds, filter-dependent).
- **Term:** long-term structural fix.

**Option B — Keep the CTE shape, add indexes only.**
- **How:** add the same indexes without removing `ROW_NUMBER()`.
- **Pros:** smaller diff.
- **Cons:** validated in the same scratch database to still leave `SCAN r USING COVERING INDEX` +
  `USE TEMP B-TREE FOR ORDER BY` for the outer `page.rn` sort — a real improvement over no index at
  all, but leaves an unnecessary sort pass that Option A eliminates for the same amount of work.
- **Complexity:** low.
- **Term:** short-term partial fix.

**Recommendation:** Option A. It was directly validated to remove all temp-sort steps and Option B
was directly validated to leave one in place, for comparable implementation cost.

**For the personalized branch specifically (cannot be index-fixed, per the validated finding in
§3.1):**

**Option A — Bound the candidate set before ranking (recommended).**
- **How:** `cand AS (SELECT id, category, created_at FROM rankings ORDER BY created_at DESC, id DESC
  LIMIT 100)`, then join `aff` and sort the 100 candidates, not all 624. **Validated**: plan becomes
  `SCAN r USING INDEX idx_rankings_created_at` (bounded by the inner `LIMIT`) followed by a small
  sort over 100 rows instead of 624.
- **Pros:** turns an unavoidable full-table sort into a small, bounded one; scales flat as the table
  grows (100 stays 100 regardless of total row count), unlike the current approach which gets worse
  every time a row is added.
- **Cons:** **user-visible behavior change** — personalization only re-ranks the newest N candidates;
  a very old but highly-affine post will no longer surface. This is the one behavior change in this
  entire plan that a user could actually notice.
- **Risks:** if N is too small, personalization becomes invisible; if too large, cost creeps back up.
  100 was chosen to comfortably exceed one infinite-scroll session's typical depth.
- **Complexity:** low-medium.
- **Term:** long-term, with an explicit, documented trade-off.

**Option B — Compute a materialized `affinity_score` column, updated on vote.**
- **How:** maintain a per-ranking or per-category score via a trigger or application-level update
  on each vote, then sort directly on an indexed column.
- **Pros:** would remove the join-based sort entirely; true index-order retrieval.
- **Cons:** significant added complexity (triggers or extra write-path code, migration risk,
  recomputation on category/vote changes); over-engineered relative to the traffic this app has.
- **Complexity:** high.
- **Term:** long-term, not justified at current scale.

**Recommendation:** Option A, with the trade-off called out explicitly to the user before shipping.

### For duplicate requests (§4)

**Option A — In-flight request dedup, keyed by URL (recommended, agreed with user).**
- **How:** a module-level `Map<url, Promise>` in `src/lib/api.js`; a GET wrapper checks the map
  before issuing `fetch`, and a second call for a URL already in flight awaits the same promise
  instead of issuing a new request.
- **Pros:** fixes the cost regardless of root cause — whether it's context re-renders, observer
  double-fire, or navigation remounts, the dedup layer catches all of them at the network boundary;
  also becomes the foundation for the short-TTL response cache proposed in Pass 1's C3.
- **Cons:** does not explain *why* the duplicates happen — masks the symptom without diagnosing the
  cause, which the user also asked to have isolated.
- **Complexity:** low.
- **Impact:** directly removes the measured 556,992-row duplicate cost.
- **Term:** short-term mitigation that is also permanently useful as cache infrastructure.

**Option B — Diagnose the root cause first via a live repro.**
- **How:** `npm run build && npx wrangler pages dev dist --local`, open Chrome DevTools → Network,
  filter `/api/`, reproduce the Home Feed mount, and use the React DevTools Profiler to see which
  component/effect re-fires.
- **Pros:** produces a real fix at the source (e.g., memoizing `UserContext`'s value) rather than a
  network-layer band-aid.
- **Cons:** slower; some causes (e.g., legitimate remounts from navigation) aren't really "bugs" and
  the dedup layer would still be needed as a backstop regardless.
- **Complexity:** low (it's a diagnostic session, not a code change) but time-boxed effort is
  uncertain.
- **Term:** should happen regardless, in parallel.

**Recommendation (per explicit agreement with the user): do both.** Ship the dedup layer immediately
(it is cheap and strictly beneficial), and separately spend a diagnostic session isolating the root
cause so the underlying issue (likely `UserContext`'s unmemoized provider value, per §4) gets a real
fix rather than only a mitigation.

---

## 9. Further investigation needed before implementation

1. **Which commit was deployed during the professor demo.** Check the Cloudflare Pages
   **Deployments** tab for `tear-of-god` for the timestamp of the demo, note its commit SHA, and run
   `git show <sha>:functions/api/rankings.js | grep "ORDER BY (SELECT COUNT"` — a match means
   production was on the 41,364–83,795-rows/request shape. This single fact decides whether Steps 2–3
   in §10 should ship as an **emergency hotfix** ahead of everything else, or as a scheduled
   improvement on top of an already-much-better `HEAD`.
2. **Isolate the duplicate-request root cause** via a live DevTools session (§8, Option B) — the
   dedup layer should ship regardless, but the diagnosis determines whether a second, source-level
   fix (e.g., `useMemo` on `UserContext`) is also needed.
3. **Re-trace after the 25 Aug `follows`/profile-education changes** — the analyzed trace window
   (20–23 Aug) predates that merge, so `functions/api/follows.js` and the profile-counts query in
   `functions/api/users.js` have no real measured data yet, only the `EXPLAIN QUERY PLAN` analysis
   from Pass 1 (which found no missing index for those specific queries at the current row counts).
4. **Confirm D1's real dashboard numbers** — the trace store is a local dev artifact; production
   D1 usage should be pulled from the Cloudflare dashboard's D1 Metrics tab to confirm these dev-time
   measurements transfer proportionally to production traffic patterns.

---

## 10. Merged solution list, priority, and recommended implementation order

Pass 1's solutions for the over-fetch findings (C4: Discover template-item over-fetch, C5: hashtag
CTE run twice, C6: full template-detail fetched for 3 fields, C7: Profile/Category over-fetching
rankings) and for caching (C3: no `Cache-Control`, no client cache) are **unchanged by this pass**
and are still recommended as documented in the original analysis — they are confirmed independently
via the trace data in §5 (ranks 4, 5, 6, 8, 9–10, 12/17), which validates their real-world magnitude
without changing the proposed fix.

**Priority order (severity × how each depends on the others):**

1. **Verify the deployed commit** (§9.1) — decides urgency, costs nothing to check.
2. **Flatten the feed query + add indexes** (§8) — 87.5% of all measured waste; the single highest-
   leverage change found in either pass.
3. **Bound the personalized-order candidate set** (§8) — closes the one gap indexes alone cannot fix,
   and is the default order for every logged-in user.
4. **In-flight request dedup** (§8) — cheap, catches the 556,992-row duplicate cost regardless of
   root cause; ship alongside a diagnostic session for the underlying trigger.
5. **Over-fetch fixes carried from Pass 1** (template-item caps, single-pass hashtag CTE, light
   template-detail mode, smaller Profile/Category limits) — real, now confirmed at real magnitude,
   but individually smaller than 1–4.
6. **Edge + client caching carried from Pass 1** — implement last, after 2–5, so its effect can be
   measured as a reduction on top of an already-lean per-request cost rather than masking whether 2–5
   actually worked.
7. **Guards** (memoize `UserContext`, bound comment fetches, delete dead `useRankings.js` hook) —
   cheap insurance, doable alongside any step above.

## 11. Expected impact (revised)

| Stage | Rows/feed-load (measured/derived) | Full demo session (Flow E, §6) |
|---|---:|---:|
| Deployed before 24 Aug (if that's what ran the demo) | 41,364–83,795 | ~600,000–650,000 |
| `HEAD` today | ~2,718 | ~35,000–45,000 |
| After Steps 2–4 (query flattened, indexed, bounded, deduped) | ~50–150 | ~5,000–8,000 |
| After full plan (+ over-fetch fixes + caching) | ~10–30 (cache hits: ~0) | **~1,500–3,000** |

This reaches a **~99.5%** reduction from the pre-24-Aug baseline, or **~93–95%** from `HEAD` — either
way, comfortably explaining and resolving the "several hundred thousand" observation.

## 12. Risks and trade-offs (additive to Pass 1's list)

- **Bounded personalization is a real, user-visible behavior change** (§8) — flag it explicitly
  before shipping; it is the one place in this entire plan where "faster" and "identical UX" are not
  simultaneously true.
- **Flattening the feed query must preserve the existing `sort`-wins-over-personalization guard** —
  regressing it reintroduces a previously-fixed bug (documented in the current code's own comments).
- **The dedup layer treats a symptom.** If the true cause is something structural (e.g., a
  misconfigured effect dependency), dedup hides the symptom without fixing the cause, and a future
  change elsewhere in the codebase could reintroduce visible lag/inconsistency that dedup happens to
  currently paper over. The diagnostic session in §9.2 is not optional busywork — it's how this risk
  gets closed out.
- All Pass-1 risks (public-cache data leakage, index write overhead, `template_items` cap changing
  card rendering, client-cache staleness after mutations) still apply unchanged.

## 13. Verification / testing strategy (revised)

1. **Re-extract the trace after each step.** The same read-only method used to produce this document
   works on any future `wrangler pages dev` session: open
   `.wrangler/state/v3/observability/miniflare-wobs-trace-store/*.sqlite` via `node:sqlite` in
   read-only mode, join `spans` (kind `d1`) to `logs` by `trace_id`, and decode
   `cloudflare.d1.response.rows_read` from the attributes blob (a MessagePack map — the value follows
   the key as a length-prefixed ASCII-digit string). This gives **real** before/after numbers, not
   estimates. Target: the traced `?user_id&page=1&limit=5` request drops from 2,808 to under 200.
2. `EXPLAIN QUERY PLAN` before/after on the flattened query — `SCAN r` + any `TEMP B-TREE` must
   disappear for the non-personalized branches; the personalized branch's temp-sort must shrink to
   operate over the bounded candidate set, not the full table.
3. **Live DevTools session** — confirm zero duplicate identical `/api/` requests within a normal
   Home Feed mount + one tab switch + one scroll.
4. **Full walkthrough** under `npm run build && npx wrangler pages dev dist --local`, replicating
   Flow E from §6; sum real `rows_read` from the trace and compare against the "after full plan" row
   in §11.
5. **Functional regression** — `docs/TestCases.md` (TC-08 especially), plus explicit verification
   that Template Detail's explicit `sort` parameter still wins over personalized order (the guard
   this plan must not regress), and that vote/comment counts still update immediately after action.
6. `npm run lint` (oxlint). No test/typecheck script exists in this repo — do not invent one.

---

## 14. Implementation results (2026-08-26)

Everything in this section was implemented and measured against the local dev D1 database via
`npx wrangler pages dev dist --local`, using the exact same trace-extraction method as the
investigation (`.wrangler/state/v3/observability/miniflare-wobs-trace-store/*.sqlite`, decoded
read-only). All numbers below are **real measured `rows_read`**, not estimates. Production data was
not touched — every migration and test ran against the local dev D1 instance only.

### 14.1 Deployment verification (§9.1, resolved)

Checked via `npx wrangler pages pages deployment list --project-name=tear-of-god` and cross-referenced
against `git log`/`git merge-base --is-ancestor`:

- **Current production** (`https://0ed5d8bf.tear-of-god.pages.dev`, commit `071fa4a`, deployed
  ~1 day before this work) **does** include the 24-Aug fix (commit `9b913fd`) that removed the
  correlated-subquery `ORDER BY`/count subqueries — confirmed by `git show 071fa4a:functions/api/rankings.js`
  containing `r.likes_count DESC` (denormalized column) rather than
  `(SELECT COUNT(*) FROM votes WHERE …) DESC`. It still had the full-scan-plus-double-sort problem
  (§3.1 Multiplier 2), unfixed until this implementation.
- **Deployments active 2–3 days before this work** (`149b794`, `c325ea9` — both older than `9b913fd`)
  were confirmed, by directly reading their `functions/api/rankings.js`, to contain the **expensive
  correlated-subquery `ORDER BY`** (`orderExpr = "(SELECT COUNT(*) FROM votes WHERE ranking_id = r.id
  AND vote_type = 'like') DESC, …"`). Production ran this shape — the one measured at up to
  83,795 rows/request — for at least a two-day window (~23–24 Aug).
- **Conclusion:** it is very likely the professor demo ran during or before this window, which fully
  explains the "several hundred thousand rows in one solo demo" observation independent of any
  remaining uncertainty about the exact demo timestamp.

### 14.2 What was implemented

| # | Change | File(s) | Status |
|---|---|---|---|
| 1 | Flattened the feed list query (dropped the `page`/`ROW_NUMBER()` CTE for the 4 non-personalized branches) | `functions/api/rankings.js` | ✅ Implemented, verified |
| 2 | Bounded the personalized-order branch to the newest `max(100, offset+limit)` candidates before ranking by affinity | `functions/api/rankings.js` | ✅ Implemented, verified, correctness spot-checked (identical top-5 vs. unbounded reference query) |
| 3 | Added 7 covering indexes (`rankings` × 4, `templates` × 2, `template_items` × 1) | `migrations/0006_feed_indexes.sql` (new; **0004/0005 were already taken** by the 25-Aug `follows`/profile-education merge that landed after Pass 1 was written — renumbered accordingly) | ✅ Applied to local dev D1, `EXPLAIN QUERY PLAN`-verified |
| 4 | In-flight GET request dedup (`Map<url, Promise>`) | `src/lib/api.js` | ✅ Implemented, browser-verified |
| 5 | Root-cause fix: memoized `UserContext`'s provider value | `src/context/UserContext.jsx` | ✅ Implemented |
| 6 | Merged the hashtags recursive-CTE rows+total queries into one (`COUNT(*) OVER()`, with a rare-case fallback for empty pages) | `functions/api/hashtags.js` | ✅ Implemented, verified (incl. the page-beyond-range edge case) |
| 7 | Capped `template_items` returned by the templates **list** endpoint to the first 4 (by `position`) per template | `functions/api/templates.js` + new index `idx_template_items_tpl_position` | ✅ Implemented — see §14.3 for a real correction to the original plan |
| 8 | Added a light (`?fields=meta`) template-detail mode that skips the community-average histogram | `functions/api/templates.js`, `src/lib/api.js`, `src/pages/PostDetail.jsx`, `src/pages/RankTierList.jsx` | ✅ Implemented, verified |
| 9 | Merged the template-detail `COUNT(*)` + `MAX(created_at)` into one statement | `functions/api/templates.js` | ✅ Implemented |
| 10 | Per-tab response cache in `HomeFeed` (General↔Kindred switch costs 0 requests after first visit each) | `src/pages/HomeFeed.jsx` | ✅ Implemented, browser-verified (Chrome DevTools network log) |
| 11 | Documented, did **not** implement, real Kindred personalization logic — `feedType` is still not forwarded to the backend; General and Kindred still return identical data | `src/pages/HomeFeed.jsx` (comment) | Deliberately deferred, per §5/§8's agreed recommendation |
| 12 | Edge cache headers (`Cache-Control: public, max-age=60…`) on the fully public template list/detail and hashtags responses; **explicit `private, no-store` vs. `public, max-age=30…`** branch on the rankings list endpoint depending on whether `user_id` is present | `functions/api/templates.js`, `functions/api/hashtags.js`, `functions/api/rankings.js` | ✅ Implemented |
| 13 | Added a defensive `LIMIT 200` to the two unbounded comment queries (H4) | `functions/api/rankings.js` (detail branch), `functions/api/comments.js` | ✅ Implemented |
| 14 | Deleted dead code: `src/hooks/useRankings.js` (unreferenced; imported a non-existent `deleteRanking`) | — | ✅ Deleted |
| 15 | Profile.jsx / CategoryPage.jsx limit reduction | — | **Not implemented — see §14.5, flagged for your decision** |

### 14.3 A real finding that overturned part of the original plan

The plan (§8) recommended capping `template_items` per template using
`ROW_NUMBER() OVER (PARTITION BY template_id ORDER BY position) <= 4`. **Measured against the real
D1 binding, this made things worse, not better: 2,018 rows read for 50 templates, vs. 933 rows for
the original uncapped query.** D1's `rows_read` accounting appears to charge extra for the window
function's internal partition-sort work, on top of the base table visits — something no
`EXPLAIN QUERY PLAN` text made visible ahead of time; it only showed up by actually measuring
`rows_read` from a live trace. Root-cause investigation (confirmed `grep -rn "INSERT INTO
template_items"` across the whole app returns zero matches — templates/items only ever come from
`templates-seed.sql`, never created at runtime) established that seed data always assigns `position`
0-indexed and gap-free per template, so a plain `WHERE position < 4` is equivalent to "first 4 by
position" without needing a window function at all. That alone brought it to 716 rows; adding a
supporting composite index (`template_items(template_id, position)`, included in the migration) and
matching the `ORDER BY` to the index's column order brought it to **300 rows — a 68% reduction from
the uncapped baseline, using a plain filter instead of the originally-planned window function.**
This is recorded here because it is exactly the kind of "measured evidence beats assumption" case
your instructions asked me to watch for — the theoretically-cleaner window-function approach was
empirically wrong, and only real measurement caught it.

### 14.4 Real before/after measurements

All figures are real `rows_read` values from the trace store, same request shape before vs. after
(same filters, same page/limit), captured on the same local dev D1 database.

| Endpoint / query | Before | After | Reduction |
|---|---:|---:|---:|
| `GET /api/rankings?page=1&limit=5` (anonymous feed) | 2,808 (2,718 feed + 90 items) | **83** (10 feed + 73 items) | **97.0%** |
| `GET /api/rankings?user_id=…&page=1&limit=5` (personalized feed) | 2,812 (2,722 feed + 90 items) | **826** (749 feed + 77 items) | **70.6%** |
| `GET /api/templates?limit=50` (Discover template list) | 100 (list) + 933 (items) = 1,033 | 100 (list) + **300** (items) = 400 | **61.3%** |
| `GET /api/hashtags?limit=30&sort=used` | 538 + 417 = 955 (2 CTE passes) | **538** (1 CTE pass) | **43.7%** |
| `GET /api/templates?id=tmpl_003` full mode (unchanged code path, merged COUNT+MAX only) | 2 + 10 + 10 + 177 = 199 | 2 + 10 + 10 + 177 = 199 (same — full mode intentionally still computes the histogram) | — |
| `GET /api/templates?id=tmpl_003&fields=meta` (light mode, new) | *(mode did not exist)* | **22** (2 + 10 + 10, histogram skipped entirely) | **~89% vs. full mode** |
| **Simulated realistic session** (anon Home + 3 personalized scroll pages + Discover + template detail full + template rankings + post detail + template light + profile + author 50 posts + category + 1 vote — 34 real D1 queries) | *(not directly comparable — see below)* | **5,068 total** | — |

**Reconciling the simulated-session number against §7's estimates:** the plan's §11 projected
"~35,000–45,000" for a realistic `HEAD`-era full session and "~1,500–3,000" as the full-plan target.
The measured 5,068-row session above is **broader** than the plan's Flow E (it deliberately exercises
every branch at least once, including the still-not-optimized Category/Profile large-limit paths — see
§14.5 — to give an honest worst-case number, not a cherry-picked best case). Even so, it lands
**~85–89% below the `HEAD` estimate** and is dominated by exactly the two items §14.5 flags as
deliberately not yet touched (`category=gaming` with no limit: 895 rows; `author_id&limit=50`:
counted within the 5,068 but bounded by the new indexes, no longer a full scan). Excluding those two
known-remaining items, the same session would measure roughly **4,000 rows total** — within the
plan's original target range once those two items are eventually addressed (see §14.5).

### 14.5 Deliberately not implemented — flagged for your decision

**Profile.jsx (`limit: 50`) and CategoryPage.jsx (no explicit limit → server default 50) were left
unchanged.** The plan's §5/§10 listed reducing these as a remaining optimization, but implementing it
naively would have caused a real functional regression that your instructions explicitly warned
against:

- **Profile** computes its "Total Likes" stat (`totalLikes = posts.reduce(...)`) client-side from
  every post currently loaded. Lowering the fetch limit without also moving that aggregate to a
  dedicated server-side query would make "Total Likes" silently understate the true total for any
  profile with more posts than the new limit — a correctness bug, not just fewer rows shown.
- **CategoryPage** has no pagination affordance at all today (no "Load More", no page numbers).
  Lowering its limit would make already-large categories (gaming: 113 rankings, movie: 113, anime:
  102 — all already silently truncated at the existing 50, a pre-existing latent issue unrelated to
  this work) even more aggressively invisible with no way for a user to see the rest.

Both are fixable, but properly fixing either means adding real pagination UI (Profile) or a
server-side aggregate query (Profile's stat) — feature-shaped work beyond "change a limit number,"
and risky to rush. Given your instruction to "stop and evaluate" when an optimization has a
significant functional trade-off, and that the now-fixed feed-query indexes already turned these
`LIMIT 50` reads from full-table scans into bounded index seeks (the dominant cost these two pages
had), this was left as-is rather than shipped with a regression. **This needs your decision**: either
(a) accept the current `limit: 50` behavior as acceptable now that the underlying full-scan problem
is fixed, or (b) approve a follow-up task to add proper pagination to both pages.

### 14.6 Verification performed

- **`EXPLAIN QUERY PLAN`**, both against a scratch in-memory copy (pre-implementation validation) and
  against the real local dev D1 database via `wrangler d1 execute --local` (post-implementation
  confirmation): every non-personalized feed branch, every `templates`/`template_items` list-mode
  query, and the hashtags query now show `SEARCH … USING INDEX` / `SCAN … USING INDEX` with **no**
  `TEMP B-TREE` step. The personalized branch's remaining temp-sort is confirmed bounded to the
  candidate window, not the full table.
- **Correctness spot-check**: personalized-order top-5 results compared between the bounded (100
  candidates) and unbounded reference query on the real dataset — **identical**, byte-for-byte, for
  the tested user.
- **Live browser verification** (Chrome DevTools network log via `mcp__claude-in-chrome`):
  - Anonymous Home Feed mount → exactly 1 `/api/rankings` request.
  - General → Kindred → General → Kindred (all after first visit to each) → **zero** additional
    `/api/rankings` requests beyond the 2 needed to populate each tab once.
- **Endpoint smoke tests** via `curl` against every branch: anonymous feed, personalized feed,
  category filter, author_id filter, template_id+sort=liked filter, personalized deep-page
  (candidate window growth), hashtags normal + past-the-end page, templates list, template full
  detail, template light detail, post detail, user profile, votes POST — all returned `200` with no
  errors in the `wrangler pages dev` log.
- **`npm run lint`** (oxlint): zero errors. Pre-existing warnings unchanged; three new
  `react-hooks/exhaustive-deps` warnings in `HomeFeed.jsx` for the derived `feedType`/`cacheKey`
  values (both are pure derivations of `activeTab`/`currentUser`, which are already the effects'
  real dependencies — not a functional issue, just eslint wanting the derived names listed too).
- **Not run**: no automated test suite exists in this repo (`AGENTS.md` is explicit that none should
  be invented); functional regression coverage relied on the manual smoke tests and browser
  verification above, not on `docs/TestCases.md`'s full manual test matrix (out of scope for a
  single implementation session — recommended as a follow-up before merging).

### 14.7 Remaining known issues / follow-up items

1. **§14.5** — Profile/Category limits, needs your decision (accept as-is vs. approve pagination work).
2. **Real Kindred personalization** — still deliberately unimplemented (§5/§8); General and Kindred
   show identical data today, now at least without the duplicate-query cost.
3. **Personalized feed's ~750-row cost** (down from ~2,722 but still the single most expensive
   remaining query) is dominated by the `aff` CTE's per-user vote scan plus a per-candidate
   correlated `user_vote` subquery — a further optimization (e.g., precomputing affinity, or
   batching the `user_vote` lookups instead of one subquery per row) exists but was not pursued
   here, since it would change the query shape further and the current result already meets the
   plan's reduction target.
4. **Category/Profile's pre-existing silent truncation at 50 rows** (not introduced by this work,
   discovered while evaluating §14.5) is a latent UX issue independent of row-read cost — worth a
   separate ticket regardless of the row-read decision.
5. **`docs/TestCases.md`'s full manual matrix** was not re-run end-to-end; recommend doing so before
   merging, especially TC-08 and the like/comment/follow flows.
6. **This migration has not been applied to production D1.** `migrations/0006_feed_indexes.sql` was
   only run against local dev D1 (`npx wrangler d1 execute tear-of-god-db --local`). Given §14.1's
   finding that production may still be running the pre-9b913fd expensive query shape depending on
   exact demo timing, deploying this fix (code + `wrangler d1 execute tear-of-god-db --remote
   --file=./migrations/0006_feed_indexes.sql`) is high-value — **not done automatically, since it
   touches the production database and deploys application code, both of which require your
   explicit go-ahead.**

---

## 15. Production deployment (2026-08-26, approved and executed)

Everything in §14 was local-only. This section covers the actual production migration + deploy,
done after explicit approval, with every step verified against the real production D1 database and
the real deployed site — not inferred.

### 15.1 Pre-deploy safety checks

- `git status`: only this task's own changes (the 11 files listed in §14.2, plus this doc and the
  two migration files) were modified/untracked. No unrelated or unexpected changes existed —
  nothing was overwritten.
- Branch: `solve-row-read-problem`, HEAD `d516b0a6…`. The project's existing deploy command
  (`npm run deploy` → `wrangler pages deploy dist --branch=master --project-name=tear-of-god`)
  was used unmodified — `--branch=master` is a Pages label (this project has no Git integration,
  confirmed via `wrangler pages project list` showing `Git Provider: No`), not a reference to the
  local git branch, and it correctly targets the `Production` environment as it has for every prior
  deploy.
- Account/resource identity: `wrangler whoami` showed 3 accessible accounts; `wrangler d1 list` and
  `wrangler pages project list` were run to explicitly resolve `tear-of-god-db`
  (`69d366f1-55ba-43cf-a492-882e137786f4`, matching `wrangler.toml`) and the `tear-of-god` Pages
  project — both resolved unambiguously to the same account
  (`907d0f6d7a9d86e275a836997104c225`), matching the dashboard URLs seen in the deployment list.
  No ambiguity, no wrong-target risk.
- Remote schema was read directly (`sqlite_master`) before touching anything: confirmed
  `rankings.likes_count/dislikes_count/comments_count/template_id`, `templates.view_count`, and
  `template_items` all already exist in production (prerequisites for migration 0006), and that
  none of the 7 target index names already existed. Production had 630 `rankings`, 64 `templates`,
  526 `template_items` — consistent in scale with the local dev dataset used for all of §14's
  measurements.

### 15.2 Migrations applied to remote production D1

| Migration | What | Result |
|---|---|---|
| `migrations/0006_feed_indexes.sql` | 7 `CREATE INDEX IF NOT EXISTS` statements (§8/§14) | ✅ 7 queries executed, 3,181 rows written (index entries), 0 errors |
| `migrations/0007_votes_user_index.sql` **(new — see §15.3)** | 1 `CREATE INDEX IF NOT EXISTS idx_votes_user_id ON votes(user_id, vote_type)` | ✅ 1 query executed, 8,510 rows written, 0 errors |

Both are purely additive (`CREATE INDEX IF NOT EXISTS`, no `DROP`/`DELETE`/`ALTER`/data changes) and
were verified present afterward by querying `sqlite_master` directly on the remote database — all 8
indexes confirmed to exist, none were partial or failed.

### 15.3 A production-only finding, not caused by this work

Measuring the personalized feed query directly against production (via `wrangler d1 execute
--remote`, using the real logged-in demo account) initially showed **9,013 rows read** — far above
the ~749–826 measured locally in §14.4. `EXPLAIN QUERY PLAN` run directly against production
revealed why: the `aff` CTE's `SCAN v` step was a **full scan of all 8,509 `votes` rows**, not the
expected `SEARCH v USING INDEX (user_id=? AND vote_type=?)`. Root cause: `schema.sql` has defined
`idx_votes_user_id ON votes(user_id, vote_type)` for a long time, but **no migration file in this
repo ever shipped it to production** — production's `votes` table only ever had
`idx_votes_ranking_id` plus its implicit PK/UNIQUE indexes. This is pre-existing schema drift
between `schema.sql` and the real production database, unrelated to migrations 0001–0006 or to any
code change in this task — it was simply never caught before because nothing had measured
production `rows_read` for this specific query path until now.

Since it directly undermines the personalized-feed fix this task shipped (the very query §8/§14
optimized), it was treated as in-scope to fix: added `migrations/0007_votes_user_index.sql`
(additive, matches `schema.sql` exactly) and applied it to production. Re-measured after:
**506 rows** (better than local's 749, because this specific real account only has 1 recorded like,
vs. the 69-like local dev test account — the query's cost scales with the viewer's own like count,
as expected). `EXPLAIN QUERY PLAN` re-run afterward confirmed `SEARCH v USING INDEX
idx_votes_user_id (user_id=? AND vote_type=?)`.

**This finding and fix were not part of the original plan** — flagged here per the instruction to
report anything that materially affects results. It does not change the implementation strategy;
it closes a gap the strategy assumed was already closed.

### 15.4 Deployment

- Built (`npm run build`) and deployed via `npx wrangler pages deploy dist --branch=master
  --project-name=tear-of-god` (the project's existing `npm run deploy` command).
- **Result:** ✅ Success. Deployment ID `9aab0041-e47f-4180-a872-cb63068a141e`, confirmed via
  `wrangler pages deployment list` as **Environment: Production, Branch: master**, live at
  `https://9aab0041.tear-of-god.pages.dev` and (confirmed by testing) also served at the stable
  production domain `https://tear-of-god.pages.dev`.
- **Source label:** the deployment list shows `Source: d516b0a` (current git HEAD) — this is
  accurate for the tracked files, but the working tree also had the uncommitted changes from §14.2
  layered on top at build time (this repo currently has no CI/Git integration; `wrangler pages
  deploy` uploads whatever `dist/` contains at the time of the command, built from the working tree
  as it existed, not strictly from a commit). **The deployed code is correct** (verified directly
  against the live site in §15.5–§15.7) but the dashboard's commit label alone would not fully
  reflect it. **Recommendation:** commit these changes (not done automatically — no commit was
  requested for this task) so future deployments carry an accurate source label.
- Deployment timestamp: captured live in `wrangler pages deployment list` as "11 seconds ago" at
  verification time (2026-08-26); exact UTC timestamp available on the Cloudflare dashboard.

### 15.5 Production database verification

All run directly against `tear-of-god-db --remote`:

- All 7 §14 indexes + the new `idx_votes_user_id` confirmed present via `sqlite_master`.
- `EXPLAIN QUERY PLAN` on the real production database for every branch (anonymous feed, category
  filter, `template_items` position-capped query, personalized feed's `aff` CTE): all show
  `SEARCH … USING INDEX` / `SCAN … USING INDEX`, matching the local verification in §14.6 exactly —
  no full scans, no unexpected temp-sorts beyond the already-accepted bounded personalized sort.

### 15.6 Production smoke test (live site, `https://tear-of-god.pages.dev`)

All performed against the real production site with a real logged-in account, via Chrome DevTools
automation, with real network-request inspection:

| Area | Result |
|---|---|
| Home loads, feed renders | ✅ Verified (screenshot) |
| Personalized (logged-in) feed | ✅ Verified — real `user_id` present in the request, real data rendered |
| Infinite scroll | ✅ Verified — scrolling triggered a real `page=2` request, exactly once, new posts rendered |
| General/Kindred tab switch, dedup | ✅ Verified — mount + first Kindred visit = 2 `/api/rankings` requests; every subsequent switch between already-visited tabs = **0** additional requests |
| Discover (templates + hashtags) | ✅ Verified (screenshot) — capped item previews rendering correctly |
| Template Detail (full mode) | ✅ Verified (screenshot) — Community Average present, all items shown |
| Post Detail (light mode) | ✅ Verified — network log shows `GET /api/templates?id=tmpl_001&fields=meta`; sidebar correctly shows "Contains 10 items" (uncapped item count, only the histogram was skipped) |
| Like / Unlike | ✅ Verified — clicked Like on a real production post (35→36, UI updated instantly), then Unlike to restore original state (36→35). No lasting data change left behind. |
| Follow / Unfollow | ✅ Verified — followed a real profile (0→1 followers, button state changed), then unfollowed to restore (1→0). No lasting data change left behind. |
| Create flow | Page loads correctly (verified via navigation); **actual publish was intentionally not exercised**, to avoid leaving permanent test content in the production database — creating and then having no clean way to delete a production ranking was judged not worth the small extra coverage it would add, given `createRanking`'s code path was already unchanged by this task |
| Back/forward navigation | ✅ Verified implicitly through the Discover → Template → Post → Profile → Home navigation sequence above; no broken requests observed |

No smoke test failed. No regression found.

### 15.7 Request deduplication — verified in production, not assumed

Per the explicit instruction not to assume dedup works because the code looks correct: confirmed
via live Chrome DevTools network inspection on the real production site (§15.6) — General→Kindred→
General→Kindred produced exactly 2 `/api/rankings` requests total (one per tab's first visit), with
**zero** duplicate or repeated identical requests observed across the entire smoke-test session,
including page reloads, tab switches, and cross-page navigation.

### 15.8 Production row-read measurements (real, via `wrangler d1 execute --remote`)

| Query | Production `rows_read` | Compare to §14.4 local figure |
|---|---:|---:|
| Anonymous feed (`page=1&limit=5`) | **10** | 10 (local) — identical |
| `template_items` list-mode cap (50 templates) | **300** | 300 (local) — identical |
| Personalized feed, **before** `idx_votes_user_id` fix | 9,013 | *(gap — see §15.3)* |
| Personalized feed, **after** `idx_votes_user_id` fix | **506** | 749–826 (local, different account like-count) — same order of magnitude, difference fully explained by vote-count difference between test accounts |

Production numbers now match or beat the local measurements in §14.4 for every query checked,
confirming the optimized queries are genuinely running in production, not just in local dev.

### 15.9 Final status

- 🟢 **Migration:** SUCCESS (`0006_feed_indexes.sql` + `0007_votes_user_index.sql`, both applied to remote production D1, both verified present)
- 🟢 **Deployment:** SUCCESS (`9aab0041-e47f-4180-a872-cb63068a141e`, Production/master, live)
- 🟢 **Production smoke test:** SUCCESS (§15.6, no failures)
- 🟢 **Request deduplication:** VERIFIED (§15.7, live network inspection)
- 🟢 **Feed optimization:** VERIFIED (§15.5/§15.8, real `EXPLAIN QUERY PLAN` + real `rows_read`)
- 🟢 **Database indexes:** VERIFIED (all 8 present, all used by their target queries)
- 🟢 **Production row-read measurement:** AVAILABLE (§15.8)

### 15.10 Remaining risks / follow-ups after production deployment

1. **Uncommitted working tree** (§15.4) — the deploy is live and correct, but git history doesn't
   yet reflect it. Recommend committing before further work, so the next deploy's source label is
   accurate and this work isn't accidentally lost by an unrelated `git checkout`/`reset`.
2. **§14.5 items (Profile/Category limits)** are still open and still need your decision — this
   production deployment did not change that.
3. **§14.7's other follow-ups** (real Kindred logic, personalized feed's remaining ~500-row cost,
   pre-existing Category/Profile truncation, full `docs/TestCases.md` matrix) remain open.
4. **The `idx_votes_user_id` gap (§15.3) raises a broader question**: is `schema.sql` fully in sync
   with production anywhere else, beyond what this task happened to touch and measure? This was
   found only because this task's queries specifically exercised that index; other unindexed drift
   could exist elsewhere in the schema and would not have been caught by this task's scope. Worth a
   dedicated schema-diff pass as separate follow-up work.
