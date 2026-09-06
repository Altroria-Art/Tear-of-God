# Plan: Template Hashtag Inheritance & Display

## 1. Current implementation findings

- Templates are first-class database records in the `templates` table, each with its own
  `hashtags` TEXT column (CSV, e.g. `#Anime,#Tierlist`). These hashtags are the **original
  template owner's** hashtags and are written exactly once when the template is created.
- Tier lists ("rankings") are separate records in the `rankings` table. A ranking that was
  created from a template carries both `template_id` (link back to the source template) and its
  own `hashtags` CSV column.
- The "Use Template" entry points (Discover, Discover Detailed, Community Average, Hashtag
  Detail, Popular Templates, and the About Template card on posts) all navigate to
  `/rank?template=<id>`.
- `RankTierList.jsx` (the page behind `/rank`) fetches the source template with
  `fetchTemplate(id, { light: true })` and pre-populates title/description/tiers/items — but for
  hashtags it only adds the template hashtags to the *suggested* tag list. They are never
  **pre-selected** on the creation page.
- Discover Detailed (`/template/:id`) and Community Average (`/template/:id/community`) both
  already receive `template.hashtags` from `GET /api/templates`, but neither page renders them.

## 2. Current data flow for templates

1. A user creates/publishes a tier list on `Create.jsx`. `POST /api/rankings` inserts a
   `templates` row (transactionally with the `rankings` row) with `templates.hashtags` taken from
   the creator's selected hashtags, and links the ranking via `template_id`.
2. The template appears on Discover. Template cards are rendered from `GET /api/templates`
   (list mode), which already returns `hashtags` in every item.
3. Clicking **Use Template** on any Discover-style page navigates to `/rank?template=<id>`.
4. `RankTierList` calls `GET /api/templates?id=<id>&fields=meta` (light detail mode), which still
   returns `hashtags` alongside title/description/tiers/template_items.
5. The user arranges items, edits hashtags, and saves. `POST /api/rankings` inserts a new
   `rankings` row with `template_id = <id>` and its own `hashtags` derived from the user's
   selection. The `templates` row is never touched (aside from `use_count`).

## 3. How hashtags are currently stored

- `templates.hashtags`: TEXT, CSV without spaces around commas, leading `#` kept, case
  significant (`#Anime` ≠ `#anime`). Written only at template creation.
- `rankings.hashtags`: same CSV format, belongs to the derived tier list only.
- `GET /api/hashtags` aggregates distinct tags **only from `templates.hashtags`** (recursive CTE),
  which is why PopularHashtags counts reflect template-owned tags.
- `GET /api/rankings` filters by `rankings.hashtags`; hashtag-detail pages surface rankings via
  that column, but the tag *registry* (PopularHashtags) is template-scoped.

## 4. How "Use Template" currently works

- All entry points guard for login (`handleProtectedAction` / `warnLoginUse`) then navigate to
  `/rank?template=<id>`.
- `RankTierList` reads the `template` search param, runs `loadTemplate()`:
  - title/description come from the template records;
  - tiers are mapped from `template.tiers` (fall back to `DEFAULT_TIERS`);
  - items are copied from `template_items` into the Unranked Pool (`tierId: null`);
  - `data.hashtags` is split, deduped, and merged into `suggestedTags` (shown as `+ tag`
    buttons) — this is the gap: hashtags are offered, not inherited.
- Save sends `payload.template_id`, items with tier labels, and `hashtags` = joined
  `selectedHashtags`.

## 5. API endpoints / functions / components involved

- `functions/api/templates.js` — `GET` list + detail (returns `hashtags` in both; detail also in
  light `?fields=meta` mode), `POST` view tracking.
- `functions/api/rankings.js` — `POST` create ranking (and optional new template). No change to
  `templates.hashtags` when `payload.template_id` is set.
- `functions/api/hashtags.js` — tag aggregation from `templates.hashtags` (no change).
- `src/lib/api.js` — `fetchTemplate`, `fetchTemplates`, `createRanking`, `fetchHashtags`.
- `src/pages/RankTierList.jsx` — the `/rank` creation page; target for inheritance pre-select.
- `src/pages/TemplateDetailPage.jsx` — Discover Detailed; target for hashtag display.
- `src/pages/CommunityAveragePage.jsx` — Community Average; target for hashtag display.
- `src/components/template/HashtagList.jsx` — new shared presenter for template hashtag pills.
- `src/components/template/TemplateCard.jsx`, `Discover.jsx`, `HashtagDetail.jsx`,
  `PopularTemplates.jsx`, `src/components/post/AboutTemplateCard.jsx` — entry points that just
  navigate to `/rank?template=<id>` (no change needed).

## 6. Database tables / columns involved

- `templates.hashtags` — source of truth for template hashtags (exists since migration
  `0001_templates_tiers.sql`).
- `rankings.template_id` — link from a derived tier list back to its source template.
- `rankings.hashtags` — the derived tier list's own hashtags (must never mutate the template's).

## 7. Root cause / gap preventing the desired behavior

- `RankTierList.jsx` pushes the source template's hashtags only into `suggestedTags`, never into
  `selectedHashtags`, so nothing is pre-selected when the creation page opens.
- Discover Detailed and Community Average already have `template.hashtags` in their data but
  render no hashtag UI at all.

Data ownership is already structurally sound — nothing in `POST /api/rankings` writes back to
`templates.hashtags` — so the only real gaps are pure frontend concerns.

## 8. Proposed implementation approach

Pure frontend change, reading existing data:

1. **Inheritance**: in `RankTierList.loadTemplate()`, normalize `data.hashtags` (trim entries,
   ensure leading `#`, `Set`-dedupe) and set `selectedHashtags` to that array, in addition to
   merging into `suggestedTags`. The user keeps full control (add/remove) via the existing
   controls.
2. **Display**: add a shared `HashtagList` component rendering link pills in the existing
   hashtag UI convention (same classes/behavior as `PostDetail`/`HomeFeed`), and render it on
   `TemplateDetailPage` (under the description) and `CommunityAveragePage` (in the article card,
   below the title/items line). Follow the existing link-pill pattern — no new design language.
3. No backend or database changes.

## 9. Data ownership and source-of-truth rules

- **Source Template Hashtags** (`templates.hashtags`) belong to the original/source template.
  They are inherited (copied into the new draft) when a user clicks **Use Template**.
- **Derived Tier List Hashtags** (`rankings.hashtags`) belong only to that derived tier list.
- A derived tier list must never write its hashtags back to `templates.hashtags`. There is no
  shared mutable relationship between template and derived lists.
- `GET /api/templates?id=<id>` is the single authoritative read for "what hashtags does this
  template have". Never derive them from any ranking.

## 10. Preventing hashtags from User B propagating to User C

- `templates.hashtags` is immutable after creation (only `Create.jsx` publish / seed writes it;
  `POST /api/rankings` with `payload.template_id` never updates the template row).
- Inheritance always reads the source template record fresh at `/rank` load time, never from a
  ranking's hashtags and never from another user's draft. Therefore:
  - User B inherits A's tags, adds `#game`, publishes → only the new `rankings` row gets
    `#game`.
  - User C opens the ORIGINAL template A → `GET /api/templates?id=A` still returns exactly A's
    tags. `#game` cannot appear.
- Guardrails to keep in place: never add an endpoint that copies `rankings.hashtags` into
  `templates.hashtags`, and never change the hashtag filter/aggregation source.

## 11. Required backend/API changes

None. `GET /api/templates` already returns `hashtags` in both list and detail (including light
`?fields=meta`) modes, and `POST /api/rankings` already preserves template ownership. We
explicitly choose NOT to add backend copying logic to avoid any risk of mutating the source
template.

## 12. Required frontend/UI changes

- `src/pages/RankTierList.jsx`
  - In `loadTemplate()`, normalize the template tags and `setSelectedHashtags(...)` with them so
    inheritance pre-selects them; keep them merged into `suggestedTags` so removing a tag
    returns it to the suggestions.
- `src/components/template/HashtagList.jsx` (new)
  - Presenter that renders `#tag` link pills to `/discover/hashtag/<tag>`, following the exact
    pill UI used by `PostDetail` (`px-3 py-1 rounded-md bg-surface-glass text-ink-soft text-[11px]
    font-bold uppercase tracking-wider hover:bg-surface`). Accepts `hashtags` (CSV string or
    array) and renders nothing when empty.
- `src/pages/TemplateDetailPage.jsx`
  - Render `<HashtagList hashtags={template.hashtags} />` below the description.
- `src/pages/CommunityAveragePage.jsx`
  - Render `<HashtagList hashtags={template.hashtags} />` in the article card below the
    title/items line (mirrors PostDetail placement).

## 13. Required database/migration changes

None. `templates.hashtags` has existed since `0001_templates_tiers.sql`. Backward compatible with
all existing records (including seeds and any template created before this feature).

## 14. Backward compatibility considerations

- Templates with no hashtags: inheritance yields an empty selection; page behaves exactly as
  before (user must pick at least one to save). Display component renders nothing.
- Old templates: same read path (`templates.hashtags`) that Discover already uses; no format
  change. Normalization (trim + `#` prefix) is defensive only and does not rewrite stored data.
- Seed data confirmed (`tmpl_*`) stores `#Tag` CSV; normalization preserves it unchanged.
- Save flow, category derivation (`selectedHashtags[0]` lowercased), and existing creation
  without a template are untouched.

## 15. Testing strategy

No test framework exists in this repo (AGENTS.md: do not invent test scripts). Verification uses:

- `npm run lint` (oxlint) — catches syntax/unused issues.
- `npm run build` — production build success.
- `npx wrangler pages dev dist --local` — full-stack manual scenarios A–F (see task brief):
  - A: Use Template → new list starts with the template's hashtags pre-selected.
  - B: publish a list with an extra tag, then Use the ORIGINAL template again → only the
    template's tags are inherited.
  - C: Discover Detailed and Community Average show the source template's hashtags.
  - D: template with zero hashtags still works normally.
  - E: creating a tier list without a template behaves exactly as before (no pre-selected tags).
  - F: re-adding an inherited hashtag does not create a duplicate (existing
    `includes`-guard in `RankTierList`).

## 16. Potential edge cases

- **Old templates / empty or null hashtags**: `(data.hashtags || '')` + `.filter(Boolean)` yields
  an empty set; no crash, no pre-selections.
- **Single / many hashtags**: handled uniformly through split/filter/dedupe.
- **Whitespace / missing `#`**: normalization trims entries and prefixes `#`; case is preserved
  (case is significant in the tag registry, per seed docs).
- **Duplicate hashtags on the template record**: `Set`-dedupe before seeding state.
- **User adds a tag already inherited**: existing `!selectedHashtags.includes(formatted)` guard
  in `handleTagInputKeyDown` and the `prev.includes` check in `toggleHashtag` prevent duplicates.
- **User removes an inherited tag**: removal is supported; the tag remains in `suggestedTags`,
  so it can be re-selected.
- **User adds new tags**: they join `selectedHashtags` and land only in the new ranking's
  `hashtags` on save.
- **Multiple users / multiple generations**: every `/rank?template=` load re-reads the source
  template record, so behavior is identical for all generations.
- **Editing a list created from a template**: there is no edit-existing-ranking page; revisiting
  `/rank?template=<id>` always re-fetches the source template fresh. Nothing cached/stale is
  inherited.
- **Deleted templates**: `GET /api/templates` returns 404; `RankTierList` logs the error and
  falls back to defaults (pre-existing behavior, unchanged). Display pages already handle
  not-found with a fallback view.
- **API responses with missing/null hashtag data**: guarded by `(data.hashtags || '')` and the
  component's empty-state fallback.
- **Dangling `template_id` on a ranking whose template was deleted**: not introduced here;
  pre-existing behavior, harmless for this feature.