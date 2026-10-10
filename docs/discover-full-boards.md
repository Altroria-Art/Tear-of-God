# Discover full boards — 2026-10-10

Discover presents topics in a horizontal squeeze carousel adapted from the
user's supplied `carousel-squeeze` component. On desktop (1024px and wider,
with at least 800px of available content width), the selected board expands
beside progressively narrower previews. On phones and tablets, the selected
board occupies the full width. Previous/next arrows, preview selection, keyboard
Arrow/Home/End navigation and touch swipes change topics within Discover.
Navigation stops at the first and last slide; there is no autoplay or duplicate
topic data. Width/strip transitions take one second, respecting the shared
reduced-motion setting. Rapid input updates selection without waiting for a timer.

Following the user's height preference, selected boards start at **600px**.
Long content fades at the bottom, with a conditional **View full board** button
outside the clipped area. Expanding reveals every tier/item within Discover;
Collapse returns to 600px and scrolls back to the card. Item counts and
comment/share actions remain visible in either state. Expansion uses the already
loaded data and makes no requests. No board has an inner vertical scrollbar.

Following the user's Home-style request, items use equal square tiles: 80px,
or 72px below 640px. Images fill the tile; text captions wrap to three lines,
like Home. Clicking/tapping a tile or pressing Enter/Space opens the shared
item-details dialog with the complete name. Broken images fall back to text.
Item buttons also support horizontal swipes without opening details. Keyboard
focus on a clipped item expands the board and brings that item into view. Narrow
panels use the same square boxes as navigation previews (up to four rows/four captions
per row), not complete rankings. Their decorative content is hidden from
assistive technology. Preview heights match the selected panel exactly, including
when expanded. Only the selected board mounts images and interactive actions.

Popular, New and Active carousels end with a **View all** navigation panel.
Popular opens `/discover/templates?sort=popular`; New/Active open the complete
catalog sorted by recency. This panel is not a topic and is never sent to the
board API. Search/saved lists retain their existing pagination without a catalog
slide that would discard those filters.

`SqueezeCarousel.jsx` handles geometry/navigation; `DiscoverBoardCarousel.jsx`
adapts community ranking data and shared `TierLabel` to its preview/content
slots. The implementation uses the site's JSX, font, theme tokens and Lucide icons.
It adds no external fonts, cover images, dependencies, API or database changes
beyond the existing full-board feature. Discover retains compact Home-style
community/update date, tags, title, rank/bookmark and comment/share actions, with flat borders
inside the carousel. Home, Profile and the templates catalog keep their existing
layouts and shared compact TemplateCard.

Following the user's community preference, Discover displays the aggregate of
each person's current contribution to a topic, rather than a latest personal
post. Main and neighbour panels say **Community rankings** (Thai: อันดับรวมของทุกคน),
with a generic community icon and no personal name/avatar. Topic title,
description and hashtags belong to the topic. The participant badge counts current
contributors; the update date uses the latest published timestamp, parsed as UTC.
Tier assignment uses the same shared score calculation as the existing Community
detail, before display rounding. Items without scores remain visible in a separate
unranked pool. Share links open `/template/:id/community`; comment links
open `/template/:id/community#comments` and scroll/focus after loading. Comment
counts refer to that topic's community discussion. Unposted topics
show their item pool and an invitation to rank, using the same expansion control
when needed; no opinion is fabricated.

## API and quota

- `GET /api/discover-boards?ids=id1,id2` accepts 1–12 validated topic IDs.
  `data` entries contain `template` metadata, `community_average`,
  `participant_count`, community comment counts and complete `template_items`.
  Missing/deleted topics are omitted.
  Client hydration preserves catalog/Pulse order.
- The batch uses three bounded queries: indexed metadata/counts, complete item
  pools and a score histogram joined to current user contributions. It aggregates
  scores before looking up item names/images, does not fetch post histories and
  shares snapshots
  for 10 seconds and deduplicates concurrent requests. Middleware skips session
  lookup only for GET on this public endpoint. Snapshots exclude emails,
  personal identities, comment bodies, bookmarks, session data and viewer reaction/following state.
- `GET /api/templates?fields=meta` is an opt-in catalog mode that skips obsolete
  item/count/preview queries; default callers keep their previous response.
  Public cache keys distinguish both modes. Saved filtering and bookmark
  overlays retain their private contracts.
- Popular/new keep eight topics; search/saved retain twelve per page. Active
  hydrates its topics in one batch. Topic/board requests are aborted when
  navigation changes, and stale responses cannot restore an old tab/viewer.
  Board snapshots do not poll comments or reload when their cache expires.
- No database migration or runtime binding change is required. Usage counts
  follow the existing exact-counter flag and indexed COUNT fallback.
  Full boards naturally transfer/read more items on a cache miss than previews;
  the batch limit, metadata-only catalog, lazy images and shared cache bound
  repeat work. This is not a concurrent-user or free-quota capacity guarantee.

## Validation

```powershell
node tests/local/discover-full-boards.mjs
node tests/local/discover-quiet-fallback-regression.mjs
node tests/local/catalog-activity-quota.mjs
node tests/local/template-discover-preview.mjs
npm run lint
npm run build
npx wrangler pages functions build functions --outfile .wrangler/discover-worker.js
```

The API regression covers 0/12/13/100/500 items, 12-ID batches, custom/empty
tiers, legacy item names, two differing user rankings, superseded/deleted
contributions, parity with Community detail, unrounded score boundaries,
unscored/unposted pools, validation, viewer isolation, exact counters, cache hits,
expiry, outage and concurrent cold requests. Cold batches use three statements
and cache hits use zero D1 statements. The previous latest-post fixture read
1,352 rows; its cost is not representative of the new aggregate contract.
Metadata-only catalog misses use two statements before any private overlay.

The community version passed **43 Chromium checks**, including two differing
contributors producing a middle-tier aggregate instead of either personal board,
API parity with Community detail, community labels in both main/neighbour panels,
all previous square-tile/expansion/navigation/mobile/theme checks and correct
community share/comment destinations. Hash navigation waits for the viewer's
comparison data before scrolling, avoiding a late layout shift above the form.
The read-only normal-Local check matched eight boards (8/9/27/14/5/18/3/1 items)
to their complete community snapshots and detail averages, including scored
items absent from the current topic pool, and made no extra board requests while
navigating. Screenshots are `discover-community-real-{1440|390}.png` and results
are `community-real-result.json` in the ignored QA directory below.

Eight relevant standalone checks, Build and Lint passed for this change (four
existing Fast Refresh warnings). SQL variants were measured on the same isolated
fixture before selecting the query: grouping scores before metadata lookup and
using the existing ranking/item index avoids scanning topic histories per user.
The final mixed 0/12/13/100/500-item fixture reads 6,985 rows across three statements
on a cold request (versus 8,329 in the initial aggregate query), with zero D1 work
on a shared cache hit. A regression guards this fixture's row budget.
The measured row cost is fixture-specific, not a production capacity guarantee.

The implementation passed 21 selected standalone regressions, the Vite build,
the Pages Functions build and lint (four existing Fast Refresh warnings).
The additional regressions cover the existing preview/catalog contracts,
Pulse, Profile pagination, sessions/mutations, live refresh, locales, hashtag
staleness, usage counters, quota hot paths and Home window/cursor/count behavior.

For Browser QA, use a **fresh isolated** state directory, not the normal local
database or production:

```powershell
npx wrangler d1 execute tear-of-god-db --local --persist-to .wrangler/browser-qa-discover-full/state --file schema.sql
npx wrangler pages dev dist --local --ip 127.0.0.1 --port 8797 --persist-to .wrangler/browser-qa-discover-full/state
# In another terminal:
$env:BROWSER_QA_URL = 'http://127.0.0.1:8797'
$env:BROWSER_QA_STATE = '.wrangler/browser-qa-discover-full/state'
node tests/local/discover-full-boards-browser.mjs
```

The browser scenario creates only isolated synthetic fixtures, checks English
and Thai in light and dark modes at 320/360/390/768/1024/1440px, uniform collapsed
boards, complete expanded content, broken images, 44px controls, keyboard focus,
reduced motion, arrows,
preview selection, hover squeeze and rapid input. Chromium touch events check
swipes in both directions while preserving vertical scrolling. Zero/one/two/three
topic lists, 0/12/13/100/500-item boards, rank navigation, two-account bookmarks,
share/comment destinations, the final View all slide, pagination, loading,
retry, cancellation and unchanged catalog/Profile cards are also covered. Output/screenshots
stay in the gitignored `.wrangler/browser-qa-*` directory. The earlier combined
Discover/Profile/Comments browser scenario has also been updated for full boards.
Chromium emulation does not establish Safari/Firefox or physical-phone results.

Before the community change, the Home-style square-tile carousel passed **42 browser checks**, including full expansion
and collapse of 0/12/13/100/500-item boards and the unposted pool at
320/390/1440px. Conditional expand controls, every item's visible bounds after
expansion, no additional API requests, fixed 600px collapsed heights and both
Popular/Active View all destinations were verified. Mouse/keyboard full-name
dialogs, Enter/Space, restored focus, mobile tap, swiping directly from item
buttons and keyboard focus on clipped items were also checked. Discover component and
bilingual copy regressions, build and lint also passed (four existing Fast Refresh
warnings). Results and English/Thai screenshots are kept in the ignored
`.wrangler/browser-qa-discover-full-20261010/` directory (`result.json` and
`discover-squeeze-{light|dark}-{en|th}-{390|1440}.png`). The earlier grid
presentation passed 36 checks, and the earlier automatic-height carousel passed
39; those historical results are separate from the current fixed-height run.
Production deployment is outside this run.

An earlier read-only Chromium run against the normal local server on port 8788
matched all eight actual boards to their API item counts (8/8/27/14/5/18/3/1),
using one browser board request while navigating all eight topics. It checked
320/390/768/900/1024/1440px alignment, full width below 1024px, desktop squeezing,
44px preview tier labels and no runtime exceptions. Actual-data screenshots are
`discover-squeeze-real-1440.png` and `discover-squeeze-real-390.png` in the same
ignored QA directory. An additional 15 isolated geometry cases checked every
item and the selected board's bottom against the carousel bounds for
0/12/13/100/500 items at 320/390/1440px, without clipping, overflow or inner
vertical scrollbars. These additional geometry checks also preceded the user's
fixed-height choice.

The fixed-height read-only check on port 8788 again preserved the same eight
actual API item counts, checked every topic/preview at 600px plus the outer
panel border, inspected mobile layout and the final View all destination,
and found no additional board requests during navigation or runtime exceptions.
The new screenshots are `discover-uniform-real-{first|long|end}-1440.png`
and `discover-uniform-real-390.png`; `real-uniform-result.json` records the
measurements. QA fixtures, credentials, scripts and images remain gitignored.
A separate read-only Chromium smoke check compared visible Home/Discover tile
dimensions and corner radius, tested click/Enter/Space and focus restoration,
and checked 320/390/768/1440px geometry. `discover-home-boxes-detail.png`
records the dialog.

The proposed university showcase topic remains a suggestion for discussion
with the teacher; this change creates no featured section or production content.
