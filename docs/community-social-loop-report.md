# Community / Discover social loop — PR follow-up to #143

Base: latest `main`, `b4e7321` (merged #143). Branch: `codex/community-social-loop`.

## Hierarchy and behavior

Before: large “THE PEOPLE HAVE SPOKEN” verdict header → board → uses/views → actions → Rank mine → always-open popularity chart → Your vs Community → comments → repeated topic context.

After: topic/context → Your vs Community → community board and clearly labeled result reactions → existing comments/composer → collapsed detailed item statistics. Guests and signed-in users without a ranking get **Rank mine to compare**, linking directly to `/rank?template=…`. Existing guest drafting and login-at-publish remain intact.

Signed-in comparisons show up to five actual item differences, largest tier gaps first, with “higher/lower N tiers” or “same tier” sentences, own/community TierLabel badges, and a link to the user's post. The page states that their eligible contribution can be part of the aggregate. Missing shared items, loading and request failures have separate states; missing data never becomes zero agreement.

Comparison uses stable item IDs and backend-assigned tier rows. Re-rounding the API's already-rounded mean could previously move an item at a half-tier boundary; the new helper avoids that without changing the backend algorithm. Duplicate display names and custom Thai/prototype-key tier labels remain distinct. Export chart/table keys also retain item IDs.

## Metric audit

| Display / source | What it actually counts | Treatment |
| --- | --- | --- |
| `use_count`, `stats.uses`; `COUNT(*) FROM rankings WHERE template_id = …` | Published ranking rows, including multiple posts by one user | “Rankings” / “การจัดอันดับ”; Community explicitly says all time. Removed the feed's fabricated minimum of 1 and people-shaped count icons. |
| `view_count`, `stats.views`; `template_views` | Recorded template-view rows; write endpoint inserts once per `(template_id,user_id)` | Recorded views, not total traffic/impressions. Removed the redundant Community views display. |
| Community `itemCount` | Distinct item entries returned in the aggregate for the selected period | “Ranked items in this period”; may differ from the topic's original item set if historical rankings include other items. |
| Community `items[].votes` | Eligible `ranking_item_scores` rows joined to `template_user_contributions.current_ranking_id`; time filter applies to score-row creation | **Item placements**, never likes/dislikes. Sum is item assignments, not people or complete ranking count. |
| Community `items[].avg` | Existing backend mean score; tier order maps top to number of tiers, bottom to 1 | “Mean score”, with scoring explanation in optional details. No algorithm changes. |
| Community likes/dislikes | Rows in `template_reactions` by reaction type | “Reactions to the community result · all time”, separate from placement statistics. |
| Comments | `template_comments` rows | Existing discussion count/composer/replies, placed immediately after board/actions. |
| Pulse `ranking_count` | New ranking rows within selected activity window | Existing “recent rankings” copy preserved. |
| Pulse `active_rankings` | Distinct ranking IDs with qualifying creation/comment/reaction/activity | Activity on rankings, not unique users. Pulse window/fallback logic unchanged. |
| Topic-card item preview | Listing API returns only `position < 4` preview rows; no total item-count field | “Preview · N items to rank” / “ตัวอย่างของให้จัด N รายการ”. Never claims the preview count is the whole topic count. Full topic/editor still shows the complete item set. |

Future backend enhancement: expose explicitly defined unique eligible participant counts before showing “people ranked this” (historical ranking rows cannot substitute). If a total item count is needed on listing cards, expose an accurate total rather than fetching every topic's detail or counting the capped preview. No new API fields were added here.

## Copy, Discover and visual changes

- EN: “How the community ranks it”; TH: “ชุมชนจัดกันยังไง”. Context explains the eligible aggregate without implying unanimous agreement. Public Community metadata also replaces its previous people/consensus claim with ranking-row wording.
- Discussion prompt: “What would you move, and why?” / “คุณจะย้ายอะไร เพราะอะไร?”. Reuses CommentSection, including existing submit/reply/report/delete behavior.
- Search and All topics stay near the top of Discover. Smaller headers and neutral cream/charcoal surfaces replace large verdict/headline/accent blocks. Lime remains the primary action; violet is a small community accent. No dependencies or effects added.
- Pulse remains available with all existing windows, fallback and search/saved flows. Discussions receive priority; post IDs deduplicate recent rankings and topic/template/tag previews. Other independent posts remain available, even when titles match. Empty sections disappear. Related destinations remain reachable through All topics/All hashtags.
- Topic cards show item names/thumbnails in an untiered grid, preview count and Rank mine. Personal ranking posts retain their actual tier boards and author context; Community retains the aggregate board. Tier colors still come from each tier's data through shared TierLabel/TierRow.

## Validation

Passed:

- `npm run build`
- `npm run lint` — only the four existing Fast Refresh warnings in Toast/UserContext/ThemeContext/BookmarkContext
- `node tests/local/editor-detail-regression.mjs`
- `node tests/local/auth-regression.mjs` — local Miniflare D1, no email sent
- `node tests/local/community-item-identity.mjs`
- `node tests/local/community-social-loop.mjs` — score boundary, stable IDs/duplicate names, custom tiers, unknown/missing data, item-set previews, sparse/mixed Pulse deduplication
- `node tests/local/discover-pulse.mjs` — all four windows, fallback, cache and bounded reads
- `node tests/local/template-card-preview-shapes.mjs` — existing 15 normalizer compatibility cases
- `node tests/local/template-card-preview-comprehensive.mjs` — existing 16 normalizer compatibility cases
- `node tests/local/page-meta-regression.mjs`

Browser: built app served by local Wrangler on port 8788 with local D1. Guest Home → Discover → Topic → Rank works without login; arranging all 8 coffee items reaches login only at Publish. A synthetic local account logged in, recovered the draft, published a post, followed See community, saw real lower-tier differences, and posted a local discussion comment. Its seven-day comparison matched its own tiers; all-time results differed. A signed-in account without a ranking on Switch Games received the direct comparison CTA. Search “Switch” returned one topic. Discover Last week changed its visible activity/window; sparse Now fallback displayed its one active discussion only once. Community All time/7 days changed the board and comparison, including an empty seven-day period before the QA ranking was created. Expanded details showed placement units and a fitting table. EN/TH copy was checked, including the Thai mobile page.

The synthetic profile, ranking and comment were removed from local D1 after verification; the profile/ranking cleanup queries both returned zero. Production D1 was not used. No migration, auth backend, Community algorithm, Profile/Admin redesign, or deployment was performed.

Responsive browser checks used **360, 390, 768, 1024 and 1280 × 844** for Community, Discover and Topic cards. At every width `scrollWidth <= innerWidth`; scrollbar consumes 15 px. Personal comparison starts at document Y 452/420/376/376/376 respectively. Comments follow board/actions and precede collapsed statistics. At 390 px, expanded statistics table was 309 px wide with no document overflow. All topics appears at Y 181 on mobile and 169 on larger widths. Measurements: responsive-checks.json (local capture removed).

Browser did not simulate network failures; those branches were reviewed in code. Missing/unknown comparison data is covered by helper regression tests.

## Screenshots

Before/after guest Community (same topic, 390 px):

| Before | After |
| --- | --- |
| Before | After |

Before/after Discover (390 px):

| Before | After |
| --- | --- |
| Before | After |

Before/after Topic cards (390 px):

| Before | After |
| --- | --- |
| Before | After |

Additional evidence in artifacts/community-social-loop (local capture removed): Community/Discover/Topic screenshots at all five widths, signed-in comparison, expanded detail statistics, and Thai mobile Community. Signed-in screenshots include the synthetic QA ranking/comment before cleanup.


> Screenshot captures and local visual-audit artifacts were removed before publishing this repository. The implementation findings above are retained.
