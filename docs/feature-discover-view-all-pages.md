# Feature: Discover View-All Pages

> Read this file before touching `/discover/templates`, `/discover/hashtags`, or
> `/discover/hashtag/:tag` — whether it's a bug fix, a small feature addition, or a design tweak
> on any of these three pages.

## 1. Scope

The Discover page (`/discover`) has three sections — Popular Templates, Popular Hashtags, and one
section per top hashtag — each with a "View All" button. Those buttons used to be dead
(`<button>` with no `onClick`/`href`). This feature adds the three real destination pages they
point to:

1. **Popular Templates** (`/discover/templates`) — every template, paginated, sortable
2. **Popular Hashtags** (`/discover/hashtags`) — every hashtag used by any template, with a
   filter box and sort
3. **Hashtag Detail** (`/discover/hashtag/:tag`) — every template tagged with one specific
   hashtag, paginated, sortable

Entry points: the three "View All" links on `/discover`, plus the hashtag pills on `/discover`
and on `/discover/hashtags` (both link to `/discover/hashtag/:tag`).

## 2. Functional Requirements

| ID | Requirement | Details | Actor |
|---|---|---|---|
| FR-D1 | Browse all templates | Paginated grid of every template, 12/page | Guest, User |
| FR-D2 | Sort templates | Popular (live uses) / Recent / Most Viewed | Guest, User |
| FR-D3 | Browse all hashtags | Paginated grid of every distinct hashtag with its template count, 30/page | Guest, User |
| FR-D4 | Sort/filter hashtags | Sort: Most Used / A–Z. Filter: substring match on tag name, server-side | Guest, User |
| FR-D5 | Browse templates for one hashtag | Paginated grid of templates carrying that exact tag, 12/page | Guest, User |
| FR-D6 | Navigate from Discover | The three "View All" buttons and every hashtag pill route to the pages above | Guest, User |
| FR-D7 | Use Template from a listing | Same auth-gated `Use Template` action as the Discover page (must be logged in) | User (must be logged in) |

## 3. What each number means

| Number | Formula | Source |
|---|---|---|
| "N templates" (Popular Templates / Hashtag Detail subtitle) | `COUNT(*) FROM templates WHERE <filters>` | computed server-side, returned as `total` |
| Count on a hashtag pill (e.g. `#Movie 5`) | `COUNT(DISTINCT template_id)` of templates carrying that tag | `functions/api/hashtags.js`, **not** a sum of `use_count` |
| "Uses" badge on a template card | Same live count as everywhere else in the app: `COUNT(*) FROM rankings WHERE template_id = ?` | unchanged, see `docs/feature-template-detail-page.md` §3 |

The hashtag pill count is a *template* count, not a *usage* count — confirmed choice for this
feature. Do not sum `use_count` per tag like the old client-side `Discover.jsx` code did.

## 4. Hashtag storage & exact-tag matching

`templates.hashtags` is a single `TEXT` column: a comma-separated list, values stored **with**
the leading `#` (e.g. `'#Anime,#Tierlist'`). There is no `hashtags` table.

The original filter (`functions/api/templates.js`, still used by detail-mode-adjacent code before
this feature) did:
```sql
AND t.hashtags LIKE '%' || ? || '%'
```
This is a substring match, not a tag match — searching `Pop` also matches `#TPop`, and a future
`#AnimeMovie` would match a search for `#Anime`. The list endpoint used by these new pages instead
wraps both sides in commas and does a literal substring check that can only match whole tags:
```sql
AND instr(',' || lower(t.hashtags) || ',', lower(?)) > 0
```
bound with `,#<tag>,` (the `#` is re-added client-side after `hashtag.replace('#','')` strips it,
matching the existing `fetchTemplates` convention).

## 5. API Contracts

### `GET /api/templates?page=&limit=&sort=&hashtag=&category=`
```
{ success, data: [...same shape as before...], page, limit, total }
```
New: `page` (default 1), `sort` (`popular` default | `recent` | `views`), and `total` in the
response. `id`-based detail mode is unchanged — see `docs/feature-template-detail-page.md`.

### `GET /api/hashtags?page=&limit=&sort=&q=`
```
{ success, data: [{ tag, template_count }], page, limit, total }
```
`sort=used` (default) → `template_count DESC, tag ASC` · `sort=az` → `tag ASC`.
`q` filters by substring on the tag name (case-insensitive), applied server-side so `total`
matches what's shown.

Client wrappers: `src/lib/api.js` — `fetchTemplates({ hashtag, category, limit, page, sort })`
(extended), `fetchHashtags({ page, limit, sort, q })` (new).

## 6. Pagination & the D1 100-bound-param limit

Same constraint documented in `docs/feature-template-detail-page.md` §6 applies here. The
hashtag aggregation query splits `templates.hashtags` (a CSV string) using a `WITH RECURSIVE`
CTE entirely inside SQL — this uses a **fixed 3 bound params** (`q`, `limit`, `offset`)
regardless of how many templates or hashtags exist, so it never approaches the 100-param cap no
matter how the dataset grows. Do not rewrite this as "fetch all templates, split hashtags in JS,
paginate in memory" — that reintroduces the same unbounded-fetch problem the template-detail page
already had to fix once.

Every listing page here always sends an explicit `limit` (12 for template grids, 30 for the
hashtag grid) — never an unbounded fetch.

## 7. Related files

| File | Role |
|---|---|
| `functions/api/templates.js` | list mode extended with `page`/`sort`/`total`; detail mode untouched |
| `functions/api/hashtags.js` | new — hashtag aggregation, pagination, filter, sort |
| `src/lib/api.js` | `fetchTemplates` extended, `fetchHashtags` added |
| `src/pages/PopularTemplates.jsx` | `/discover/templates` |
| `src/pages/PopularHashtags.jsx` | `/discover/hashtags` |
| `src/pages/HashtagDetail.jsx` | `/discover/hashtag/:tag` |
| `src/components/ui/Pagination.jsx` | shared pager, also adopted by `TemplateDetailPage.jsx` |
| `src/components/ui/SortDropdown.jsx` | shared sort menu, also adopted by `TemplateDetailPage.jsx` |
| `src/components/discover/HashtagPill.jsx` | clickable hashtag pill, replaces the inline button in `Discover.jsx` |
| `src/pages/Discover.jsx` | the three "View All" buttons now link out; hashtag pills use `HashtagPill` |
| `src/components/layout/Navbar.jsx` | `isActive` changed to prefix match so `/discover/*` keeps the Discover tab highlighted |

## 8. Traps — do not repeat

- **Don't reintroduce `LIKE '%tag%'` substring matching** for hashtag filters — see §4. Always
  match on comma-delimited exact tag, not raw substring.
- **Don't compute hashtag stats by fetching N templates client-side.** The old `Discover.jsx`
  capped itself at whatever `limit` it fetched (50) — a real "view all hashtags" page needs a
  real `total` from the server, which requires the SQL-side CTE in `functions/api/hashtags.js`,
  not a bigger client-side `fetch`.
- **Every sort change must reset to page 1** (`setPage(1)` / update the URL's `page` param) — the
  existing `TemplateDetailPage.jsx` sort dropdown already does this; keep the convention.
- **`GROUP BY tag` in `functions/api/hashtags.js` is case-sensitive** (SQLite default, no
  `COLLATE NOCASE` applied) — `#anime` and `#Anime` would count as two separate rows. Current
  seed data is consistently capitalized so this is not visible yet, but if hashtag data ever
  becomes user-generated, add `COLLATE NOCASE` or normalize case before storing.
- **Don't hardcode a sixth S/A/B/C/D tier color map.** None of these three pages render tier rows
  directly — they only render `TemplateCard`, which already reads `template.tiers` from the API.
  See `docs/feature-template-detail-page.md` §8 for why this rule exists.
