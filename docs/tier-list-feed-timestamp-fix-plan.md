# Tier List Feed Timestamp Fix Plan

## Problem

A tier list created seconds ago renders in the Home Feed as **"7 hours ago"**. The offset exactly
matches the browser's UTC offset (Asia/Bangkok = UTC+7) and never decays — a post 5 real minutes
old also reads "7 hours ago", not "5 minutes ago".

## Investigation Summary

Traced the complete timestamp lifecycle from tier list creation through to Feed display: UI submit
→ client API call → backend endpoint → D1 INSERT → timestamp generation/storage → column type →
API response → Feed query → serialization → Feed component → relative-time calculation → display.

Inspected `schema.sql`, all files under `functions/api/`, all files under `src/` that render a
timestamp, the local D1 database (read-only), and the production D1 export (`.d1-snapshot.sql`,
read-only, gitignored, never modified). Compared tier lists against every other entity with a
`created_at` column (profiles, follows, votes, comments, templates, template_views) to check for
inconsistency. Ruled out caching as an independent hypothesis. Verified all conclusions with `node
-e` reproductions run directly in this repo — not inferred from reading code alone.

## Timestamp Data Flow

| # | Stage | File / evidence | Value |
|---|---|---|---|
| 1 | Create UI submits | `src/pages/Create.jsx:326` `createRanking(rankingData)` | no time field sent |
| 2 | Client API call | `src/lib/api.js` `createRanking` — plain JSON POST | — |
| 3 | Endpoint | `functions/api/rankings.js:285` POST branch | — |
| 4 | INSERT | `rankings.js:329` — `created_at` not in the column list | falls to SQL default |
| 5 | Generation | `schema.sql:37` `DEFAULT CURRENT_TIMESTAMP` | `'2026-09-01 06:03:04'` UTC |
| 6 | Column | `DATETIME` affinity, actual `typeof` = `text`, second resolution, no zone marker | — |
| 7 | POST response | `rankings.js:350` echoes payload, omits `created_at` | irrelevant — see 8 |
| 8 | Redirect | `Create.jsx:334` `navigate('/')` → HomeFeed refetches | real DB value now in play |
| 9 | Feed query | `rankings.js:152` `SELECT r.*` | `created_at` raw, no alias/cast |
| 10 | Serialization | `rankings.js:264-270` spreads the row | untouched |
| 11 | Feed component | `src/pages/HomeFeed.jsx:148` `timeAgo(post.created_at)` | — |
| 12 | Parse | `src/lib/format.js:14` `new Date(dateString)` | read as UTC+7 local — BUG |
| 13 | Display | `format.js:16,25` | "7 hours ago" |

Stages 1-11 are all correct. The defect is introduced at stage 12 and nowhere else.

## Root Cause

`src/lib/format.js:14` — `const date = new Date(dateString);`

D1/SQLite's `CURRENT_TIMESTAMP` produces a UTC string in the format `"YYYY-MM-DD HH:MM:SS"` —
space-separated, no `T`, no `Z`, no offset. That shape is not the ECMAScript Date Time String
Format. Per spec, a date-time string with no zone designator is parsed as local time (only a
date-only string like `"2026-09-01"` defaults to UTC). On a machine set to Asia/Bangkok (UTC+7),
`new Date("2026-09-01 06:03:04")` yields the instant `2026-08-31T23:03:04.000Z` — seven hours
earlier than the true instant `2026-09-01T06:03:04.000Z`. `timeAgo()` then computes
`seconds = (now - parsedDate) / 1000` which is about 25200, landing in the `hours < 24` branch and
rendering "7 hours ago" regardless of how recently the row was actually created.

Reproduced directly in this repo:

```
sqlite CURRENT_TIMESTAMP    : '2026-09-01 06:03:04'
JS new Date().toISOString(): '2026-09-01T06:03:04.510Z'   (identical instant, confirms DB is UTC)
sqlite datetime('now','localtime'): '2026-09-01 13:03:04' (what it would look like if it were local)

true instant : 2026-09-01T06:03:04.000Z
parsed       : 2026-08-31T23:03:04.000Z    (7h EARLIER than truth)
seconds at creation time = 25200  =>  renders "7 hours ago"
```

Direction of the skew matters: the parsed date lands in the past, so `seconds` is positive
(+25200), which is why the symptom is a stable "7 hours ago" for a UTC+7 viewer. A viewer at a
negative UTC offset (e.g. UTC-5) would see the opposite: the parsed instant lands in the future,
`seconds` goes negative, and because the `seconds < 60` guard is also true for any negative number,
the app would render literal garbage like "-14344 seconds ago".

### Is this tier-list-specific?

No. Every table with a `created_at` column (`rankings`, `profiles`, `comments`, `votes`, `follows`,
`templates`, `template_views`) sets it identically — via SQL `DEFAULT CURRENT_TIMESTAMP`, never an
explicit value in the INSERT. The bug is uniform across the app; it is simply most visible on a
brand-new tier list because "0 seconds old" vs "7 hours ago" is glaring, whereas on a 3-day-old
post the same 7-hour error rounds away. Confirmed affected render sites: `src/lib/format.js`
(`timeAgo`, used by `HomeFeed.jsx`, `Profile.jsx`, `TemplateDetailPage.jsx`), plus two independent
inline `new Date()` calls that bypass the shared helper: `src/pages/Profile.jsx:12`
(`formatJoined`) and `src/pages/PostDetail.jsx:61,81`.

`Discover.jsx` / `TemplateCard.jsx` render no timestamps at all, so this bug was never visible there.

## Evidence

**Files:**
- `schema.sql` — every `created_at DATETIME DEFAULT CURRENT_TIMESTAMP` declaration (lines 12, 18,
  37, 61, 72, 87, 94)
- `functions/api/rankings.js:329` — the tier list INSERT, omitting `created_at`
- `functions/api/rankings.js:152,264-270` — the Feed SELECT and response mapper, both leave
  `created_at` untouched
- `functions/api/rankings.js:179` — the only `datetime('now', ...)` usage in the backend; a UTC vs
  UTC comparison, internally consistent, and why the DB format must not change (see Proposed Fix)
- `src/lib/format.js:11-46` — `timeAgo()`, the single shared relative-time formatter, and the exact
  location of the defect
- `src/pages/Profile.jsx:9-15`, `src/pages/PostDetail.jsx:61,81` — duplicate, unshared parses with
  the identical defect

**Data:**
- Local D1 file (read-only query): `CURRENT_TIMESTAMP` returns `'2026-09-01 06:03:04'`, which is
  bit-for-bit the same instant as `new Date().toISOString()` at query time — proof the DB stores
  correct UTC, not local time.
- `.d1-snapshot.sql` (read-only, gitignored production export): audited all 13,852 timestamp
  literals — 100% share one shape, `'YYYY-MM-DD HH:MM:SS'`. No legacy/alternate format exists
  anywhere in the data.

**Caching, ruled out:**
- `functions/api/rankings.js:277-279` — logged-in feed responses are `Cache-Control: private,
  no-store`; anonymous responses are `public, max-age=30, stale-while-revalidate=120`. A maximum
  30-second staleness cannot produce a constant 7-hour, non-decaying offset.

**Timezone handling, otherwise absent:**
- Grep across `src/`, `functions/`, `migrations/` for `timezone`, `Asia/Bangkok`, `getTimezoneOffset`,
  `+07:00`, `25200`, `toISOString` (outside the seed script) returns nothing — there is no explicit
  timezone conversion anywhere in the app to interact with (double-convert or otherwise). The bug is
  purely V8's implementation-defined fallback parsing of a non-ISO string.

## Proposed Fix

Add a single shared parsing function, `parseDbDate()`, to `src/lib/format.js`. It detects the exact
zone-less `"YYYY-MM-DD HH:MM:SS"` (or `T`-separated, fractional-seconds-optional) shape that D1
emits and appends a `Z` before handing it to `Date`, anchoring the instant to UTC instead of letting
it fall through to local-time parsing. A value that already carries `Z` or an explicit offset does
not match the pattern and is passed to `Date` unchanged — this is what prevents double conversion.

```js
const SQLITE_DATETIME = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?)$/;

export function parseDbDate(value) {
  if (value == null) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    const fromEpoch = new Date(value);
    return Number.isNaN(fromEpoch.getTime()) ? null : fromEpoch;
  }
  if (typeof value !== 'string') return null;

  const raw = value.trim();
  if (!raw) return null;

  const m = SQLITE_DATETIME.exec(raw);
  const date = new Date(m ? `${m[1]}T${m[2]}Z` : raw);
  return Number.isNaN(date.getTime()) ? null : date;
}
```

`timeAgo()` is rewritten to call `parseDbDate()` instead of `new Date()` directly, and hardened
with two additional guards while the function is already being edited:
- Negative-seconds clamp (`Math.max(0, seconds)`), so a client clock running a few minutes fast
  cannot render "-300 seconds ago".
- A `< 45` second branch renders "just now" instead of "N seconds ago".

A companion `formatDbDate(value, locale, options)` helper wraps `parseDbDate` + `toLocaleDateString`
for the two call sites (`Profile.jsx`, `PostDetail.jsx`) that currently duplicate the same broken
parse logic outside `timeAgo`.

### Implementation trap, verified

The obvious "just replace the space with T" fix does not work:

```
new Date('2026-09-01T06:03:04')   ->  2026-08-31T23:03:04.000Z   (STILL 7 hours off)
new Date('2026-09-01T06:03:04Z')  ->  2026-09-01T06:03:04.000Z   (correct)
```

A date-time string without a zone designator is local time per spec regardless of whether the
separator is a space or a `T`. The `Z` suffix is what actually anchors it to UTC. This is why the
fix appends `Z`, not merely swaps the separator.

## Files To Modify

| File | Change | Reason |
|---|---|---|
| `src/lib/format.js` | Add `parseDbDate()` and `formatDbDate()`; rewrite `timeAgo()` to use the parser and add the negative-clamp / "just now" guards | Single shared formatter module (already the documented convention — see `docs/feature-template-detail-page.md`); fixes the root cause for every consumer of `timeAgo` in one place |
| `src/pages/Profile.jsx` | Delete the local `formatJoined()` (duplicate parse logic); route the "Joined ..." label through the new `formatDbDate()` | Removes a second copy of the same defect |
| `src/pages/PostDetail.jsx` | Replace the two inline `new Date(...).toLocaleDateString()` calls (post header, comment list) with `formatDbDate(...)` | Removes the last two call sites that bypass the shared helper |
| `AGENTS.md` | Add one line under Conventions documenting that D1 timestamps are zone-less UTC strings and must go through `parseDbDate()` | Prevents the next contributor from reintroducing `new Date(rawString)` |

No changes to `functions/`, `schema.sql`, or `migrations/`.

## Database Changes

None required. The database already stores correct UTC values in a consistent, 100%-uniform
format across all 13,852 production timestamp rows audited. Changing the storage format would be
strictly worse: it would require rewriting every existing row, and it would silently break
`created_at > datetime('now', '-1 day')` at `functions/api/rankings.js:179` — SQLite's `datetime()`
returns the space-separated form, so comparing it against an ISO `T`-separated string compares the
byte `'T'` (0x54) against `' '` (0x20) at the same string position, causing every converted row to
sort past the intended 24-hour boundary with no error raised. It would also require touching the
six indexes in `migrations/0006_feed_indexes.sql` that rely on the current format's lexicographic
ordering, `MAX(created_at)` in `functions/api/templates.js:149`, and the seed generator
`scripts/gen-community-seed.mjs:345`.

## Timezone Handling

The correct convention — already the architecture's implicit intent, now made to actually work end
to end — is:

- Store timestamps in UTC. No change needed; D1's `CURRENT_TIMESTAMP` already does this.
- Transmit timestamps unmodified as UTC. No change needed; the API already returns the raw D1
  string with no server-side transformation.
- Convert to the viewer's local timezone only at the point of display, via `parseDbDate()`
  followed by `Date`'s built-in local-time formatting (`toLocaleDateString`, and the relative-time
  arithmetic in `timeAgo`). This is the one place currently missing the correct UTC anchor, and is
  exactly what this fix adds.

## Backward Compatibility

Full backward compatibility. No stored value changes and no API response shape changes — this is a
pure client-side parsing fix. Every one of the 13,852 existing production timestamps is in the
exact shape `parseDbDate()` handles, so every existing tier list, comment, vote, and profile
continues to load and simply renders its correct time instead of a time skewed by the viewer's
UTC offset. Rows written after the fix are byte-identical to rows written before it, so this change
can be reverted at any time with no data cleanup required.

## Edge Cases

| Case | Behavior after fix |
|---|---|
| Newly created tier list | Renders "\<today\> • just now" — the reported bug, fixed |
| Existing tier lists | Render their true instant; see note below on date-boundary shifts |
| Timestamps around midnight | `toLocaleDateString` now operates on the corrected instant, so the calendar date matches the viewer's true local day. Measured against the production snapshot: 1,515 of 13,852 rows (10.9%) will display a date one day later for a UTC+7 viewer than they did before the fix (and 1,045 / 7.5% one day earlier for a UTC-5 viewer). This is the fix working correctly — those posts were always made at that local instant — not a regression, but worth flagging to anyone verifying the change so it isn't mistaken for a new bug. |
| Future timestamps (client clock skew) | Clamped to 0 seconds, renders "just now" instead of a negative number |
| Invalid/malformed timestamp string | `parseDbDate` returns `null`, `timeAgo` renders "Just now" (existing fallback behavior, preserved) |
| Null timestamp | Same as above — `null` is checked explicitly and short-circuits before reaching `Date` |
| Cached Feed responses | Not implicated — caching windows (30s or less) are far too short to explain the observed 7-hour, non-decaying offset; confirmed unrelated |
| Value already ISO-8601 with `Z` or an offset | Regex does not match (anchored, requires no trailing zone marker), so it is passed to `Date` unchanged and not double-converted |

## Verification Plan

No test runner exists in this project (per `AGENTS.md`: "no test or typecheck scripts; do not
invent them"), so verification is a `node` reproduction plus manual browser checks.

1. Isolated parser proof — run `parseDbDate` and `timeAgo` from `src/lib/format.js` directly via
   `node --input-type=module -e "import { timeAgo, parseDbDate } from './src/lib/format.js'; ..."`
   against a table of inputs including a raw D1 string, an already-`Z`-suffixed string, an
   already-offset string, and null/empty/malformed values. Assert the first three resolve to the
   same instant (proof against double conversion) and the rest resolve to `null`.
2. Cross-timezone proof — re-run the same parse under `TZ=EST5EDT`, `TZ=Asia/Bangkok`, and
   `TZ=UTC` and confirm the fixed parser returns the identical UTC instant regardless of the host
   machine's timezone (the current broken behavior returns a different, wrong instant under each).
3. End-to-end, newly created tier list — run the full stack locally
   (`npm run build && npx wrangler pages dev dist`), create a tier list, and confirm the Home Feed
   shows "just now" immediately, not "7 hours ago".
4. Relative time updates over time — leave the created post visible for a couple of minutes and
   reload; confirm the label advances from "just now" to "N minutes ago" rather than staying frozen.
5. Existing tier lists remain correct — spot-check several older seeded rows in the Feed,
   Profile, and Template Detail pages and confirm their relative times are sane (no negative values,
   no multi-year-off values).
6. Feed and Discover consistency — confirm Discover still shows no timestamps (unaffected by
   this change, verified not to render any) and that Feed/Profile/Template Detail all agree on the
   same relative-time convention.
7. No timezone regression — repeat step 3 with the OS timezone changed to a negative UTC offset
   (e.g. US Eastern) and confirm the newly created post still reads "just now", not a negative or
   nonsensical value.
8. API/database timestamps unchanged — re-run the local D1 read-only query after testing and
   confirm `created_at` values are still stored in the original `'YYYY-MM-DD HH:MM:SS'` UTC format,
   unmodified by this fix.

## Implementation Steps

1. Add `parseDbDate()` and `formatDbDate()` to `src/lib/format.js`; rewrite `timeAgo()` to use
   `parseDbDate()` and add the negative-clamp / "just now" guards.
2. Run the isolated parser proof (verification steps 1-2) before touching any other file.
3. Update `src/pages/Profile.jsx`: remove the local `formatJoined()`, import `formatDbDate` from
   `src/lib/format.js`, and use it for the "Joined ..." label.
4. Update `src/pages/PostDetail.jsx`: import `formatDbDate` and replace the two inline
   `new Date(...).toLocaleDateString()` calls.
5. Add the one-line convention note to `AGENTS.md`.
6. Run the full end-to-end verification (steps 3-8 above).
7. Confirm `git diff --stat` touches only the files listed above — no changes to `functions/`,
   `schema.sql`, or `migrations/`.

## Risk Assessment

| Risk | Mitigation |
|---|---|
| Double conversion of an already-zoned value | The regex is anchored (`$`) to match only the zone-less shape; any value already ending in `Z` or an offset falls through untouched. Verified with a same-instant assertion across all three input forms. |
| A call site is missed and keeps the old bug | Closed inventory: `format.js`, `HomeFeed.jsx:148,226`, `Profile.jsx:9-15,350`, `TemplateDetailPage.jsx:140,194,355`, `PostDetail.jsx:61,81`. After the fix, `grep -rn "new Date(" src` should return only `format.js`. |
| ~11% of rows visibly shift by one calendar day | Expected and correct (see Edge Cases); flag to reviewers/testers in advance so it is not mistaken for a regression. |
| Non-UTC+7 viewers currently see a different, more severe symptom (negative seconds) | The same fix resolves this; the negative-clamp guard additionally prevents a raw negative number from ever reaching the UI even in an unanticipated edge case. |
| Scope creep into backend or database | Explicitly out of scope for this fix — no `functions/` change, no migration, no new dependency. Verify via `git diff --stat` before merging. |
