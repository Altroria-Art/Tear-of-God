# Feature: Hashtag counts = real usage (templates ∪ rankings)

> Read this before touching `GET /api/hashtags` or any consumer of its counts
> (`HomeRightSidebar` Trending Topics, `PopularHashtags`, `Discover` hashtag sections).

## 1. Problem

The Trending Topics box on Home (`HomeRightSidebar.jsx`) showed hashtag counts that never
moved. Creating a tier-list post ("ranking") or using a template tagged `#Gaming` had zero
effect on the `#Gaming` counter.

Root cause: `functions/api/hashtags.js` counted **only** `templates.hashtags` (via a recursive
CTE), while the vast majority of tag usage lives in `rankings.hashtags` (`#Gaming`: 12 templates
vs 123 rankings in local dev at the time of writing). "Create/use a hashtag" produces a ranking,
so the number was a frozen count of templates nobody creates from the UI. A second aggravator was
`Cache-Control: public, max-age=60, stale-while-revalidate=300`, which could hide fresh counts
for ~6 minutes.

## 2. Fix (2026-09-06)

1. **`functions/api/hashtags.js`** — the split CTE now seeds from **both** `templates.hashtags`
   and `rankings.hashtags` (two `UNION ALL` anchors + one recursive splitter), and counts
   `COUNT(DISTINCT tid)`. Response field renamed `template_count` → **`content_count`**
   (it is no longer template-only; the old name was a lie).
2. **Cache** — `max-age=60 + stale-while-revalidate=300` → `max-age=30` with no SWR, matching the
   change already made to `templates.js` list responses (docs/discover-template-view-refresh-and-tracking-plan.md);
   the SWR window was what made updates look like they never arrived.
3. **Consumers updated** to the renamed field so every page shows the same number:
   - `src/components/feed/HomeRightSidebar.jsx` (Trending Topics box)
   - `src/pages/PopularHashtags.jsx` (count pill)
   - `src/pages/Discover.jsx` (hashtag section count + `>= 3` threshold filter)

`src/components/discover/HashtagPill.jsx` takes a generic `count` prop — untouched.

## 3. Verified

- `GET /api/hashtags?limit=6` — `#Gaming` 135 (`123 rankings + 12 templates`), `Cache-Control:
  public, max-age=30`.
- POSTed a ranking with `#Gaming,#TestTag` → `#Gaming` 135 → 136; deleted the test row and the
  count returned to 135.
- `npm run lint` clean (removed the lingering unused `Sparkles` import), `npm run build` passes,
  headless-browser DOM check shows the box rendering "#Movie 137".

## 4. Known gap / follow-up

`/discover/hashtag/<tag>` (`HashtagDetail`) still lists **templates only** (`/api/templates?hashtag=`),
so a tag's pill count now exceeds the number of cards you see on its page. Extending that page to
also browse rankings-by-hashtag is a separate feature (needs a rankings `hashtag` filter path on
`GET /api/rankings`); intentionally out of scope here.