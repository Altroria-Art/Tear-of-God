# Feature: Post Detail — "Use Template" / "View Community Average"

> Read this before touching the **About this Template** card on the Post Detail page
> (`/post/:postId`, `src/components/post/AboutTemplateCard.jsx`). Both buttons on that card
> navigate to pages that already exist elsewhere in the app — this feature is wiring, not new
> pages or new API routes.

## 1. Scope

The sidebar card on `/post/:postId` shows two buttons:

- **Use Template** → `/rank?template=<id>`, which preloads the template's items into
  `RankTierList` so the user can create a new ranking from it.
- **View Community Average** → `/template/<id>` (`TemplateDetailPage`), which shows the
  template's aggregated Community Average tier list plus other users' rankings of it.

Both destinations are fully built (`src/pages/RankTierList.jsx`, `src/pages/TemplateDetailPage.jsx`).
The card itself (`AboutTemplateCard.jsx`) already branches on a `templateId` prop and already had
the `Link` for View Community Average — it was just never receiving `templateId` from
`PostDetail.jsx`, and Use Template never had an `onClick` at all. This feature closes both gaps.

## 2. Functional Requirements

| ID | Requirement | Details | Actor |
|---|---|---|---|
| FR-P1 | Show real template metadata | Card title/description/item-count describe the **template**, not the post | Guest, User |
| FR-P2 | Use Template navigates | Click → `/rank?template=<id>`, prefilling the ranker with that template | User (must be logged in) |
| FR-P3 | Use Template is guarded | Guests get an `alert()` and are sent to `/login`, same as `TemplateDetailPage` | Guest |
| FR-P4 | View Community Average navigates | Click → `/template/<id>` | Guest, User |
| FR-P5 | Graceful disabled state | A post with no `template_id` (e.g. created via `/create`) keeps both buttons disabled, no crash | Guest, User |

## 3. Where the data comes from

1. `GET /api/rankings?id=<postId>` (`functions/api/rankings.js:13-57`) does `SELECT r.*`, so
   `data.template_id` is already present in the response — `PostDetail.jsx` just wasn't reading it.
2. Once `template_id` is known, `GET /api/templates?id=<template_id>` (`fetchTemplate`, in
   `functions/api/templates.js:100-190`) supplies the real `title`, `description`, and
   `template_items` (for an accurate item count) — the same shape `RankTierList.jsx` already
   consumes when preloading a template.

The template fetch is a second, independent effect keyed only on the resolved `template_id`, not
folded into the post-loading effect (which also depends on `currentUser` and would otherwise
refetch the template every time login state changes).

## 4. Guest vs. logged-in behaviour

- **View Community Average** — no gate. Anyone can read a template's community average and other
  users' rankings.
- **Use Template** — gated. Copied verbatim from `TemplateDetailPage.jsx`'s `handleUseTemplate`:
  guests get a Thai `alert()` and `navigate('/login')`; logged-in users go straight to
  `/rank?template=<id>`.

## 5. Traps

- `template_id` is **nullable**. Rankings created from scratch via `/create` never set it
  (`Create.jsx`'s publish payload omits `template_id` entirely). The disabled state on both
  buttons is a real, reachable state for such posts — don't remove the `disabled={!templateId}`
  guards.
- Don't block the whole card on the template fetch. Render post-derived fallbacks
  (`name={tpl?.title ?? title}`, etc.) so the card is useful immediately and upgrades once
  `/api/templates` responds — the post itself must stay readable even if that fetch is slow or
  fails.
- `template` state outlives a post switch — it is not reset synchronously when `postId` changes, so
  a render can commit with the new post's `templateId` but the previous post's `template` object.
  Never read `template` directly in the card; always gate it first with
  `template?.id === post.templateId ? template : null` (`PostDetail.jsx`, computed as `tpl`) so a
  stale template can never be displayed against the wrong post, even for one frame.
- The `!currentUser → alert + navigate('/login')` guard is now duplicated a fifth time (Discover,
  PopularTemplates, HashtagDetail, TemplateDetailPage, and this card). Worth extracting to a
  shared `useUseTemplate()` hook later — out of scope here.

## 6. Related files

| File | Role |
|---|---|
| `src/pages/PostDetail.jsx` | Captures `template_id` from the post payload, fetches the template, passes props down |
| `src/components/post/AboutTemplateCard.jsx` | The card itself; owns both button behaviours |
| `src/pages/TemplateDetailPage.jsx` | Destination of View Community Average; source of the `handleUseTemplate` pattern being copied |
| `src/pages/RankTierList.jsx` | Destination of Use Template; reads `?template=` via `useSearchParams` |
| `src/lib/api.js` | `fetchTemplate`, `fetchRanking` — no changes needed, already return `template_id` / template detail |
| `functions/api/rankings.js`, `functions/api/templates.js` | Backend — no changes needed |
