# UX foundation: Home → opinion → rank → community

## Result

Home now introduces a community of opinions and prioritizes choosing an existing topic. Its compact introduction replaces the large tier demo; Trending, For You and Following remain. The primary action opens `/discover/templates`, the secondary action scrolls to the feed, and creating a topic remains a quieter link. Empty/end-of-feed actions also favor finding a topic.

Topic Detail puts **Rank mine** and **See community** together, above the quieter Duel, Save, Follow and Share controls. Post Detail adds the same next steps immediately after the ranking board. Community offers a direct Rank mine entry and lets guests start ranking from the comparison section.

The editor uses a short instruction, a compact title field and collapsed metadata so the pool and board arrive sooner. Shuffle/Sort sit below the pool on desktop. Drag/drop, click/tap assignment, custom tier definitions, autosave, cooldown enforcement at publish and existing publish validation remain.

## Before / after

| Before | After |
| --- | --- |
| Large Home demo; main CTA starts from scratch | Compact social introduction; primary CTA selects an existing topic |
| UI asks newcomers to understand Template / Community Average | Relevant EN/TH copy says Topic / Community; posts identify whose ranking is shown |
| Topic, Discover, hashtag and feed entry points request login | These entries open `/rank?template=<id>` for guests |
| Post next steps live in About Template | Primary/secondary next steps also sit beside the board |
| Topic cooldown prevents entering the editor | Users can draft; the existing editor/server publish cooldown still applies |
| An old account draft can shadow a newer guest draft | Publish flushes the guest draft and marks it for priority restoration after login |

## Guest flow

1. Choose Rank mine in Home, Topic Detail, Discover, popular topics, hashtag results, Post Detail or Community.
2. Arrange items without an account. The existing per-topic draft saves in localStorage on the same device.
3. Publish requests login with the editor URL in `next`.
4. Login returns to the editor. The current guest draft takes priority over an older account draft and is saved under the account key. Publishing remains a separate explicit action.
5. If the draft cannot be flushed, stay in the editor and show the existing storage warning.

No authentication endpoint or database contract changed. Duel retains its existing authentication rules.

## Files

| Files | Purpose |
| --- | --- |
| `src/pages/HomeFeed.jsx` | Social introduction, CTA hierarchy, guest feed entry, ranking owner copy |
| `src/pages/TemplateDetailPage.jsx` | Rank/community hierarchy and quieter utilities |
| `src/pages/RankTierList.jsx` | Compact editor and explicit guest draft handoff |
| `src/pages/PostDetail.jsx` | Next steps after the board, owner/topic terminology |
| `src/pages/CommunityAveragePage.jsx` | Public editor entry and guest comparison prompt |
| `src/pages/Discover.jsx`, `PopularTemplates.jsx`, `HashtagDetail.jsx` | Remove pre-editor login walls |
| `src/components/template/TopicRankActions.jsx` | Shared public Rank mine / See community links |
| `src/components/template/TemplateCard.jsx` | Consistent lime primary button |
| `src/components/post/AboutTemplateCard.jsx` | Guest editor entry in existing sidebar |
| `src/locales/en.json`, `th.json` | UI terminology and social/editor copy; existing keys retained |
| `src/index.css` | Quiet secondary action, lime active tabs, utility order |

## Verification — 7 October 2026

Used the Codex browser against the locally built Cloudflare Pages Functions/D1 server at `127.0.0.1:8788`. Production was viewed only as a reference.

- `npm run build`: passed.
- `npm run lint`: passed, with four existing `react(only-export-components)` warnings in Toast, UserContext, ThemeContext and BookmarkContext. No warnings introduced by this change remain.
- `node tests/local/editor-detail-regression.mjs`: passed (custom/prototype tier labels, wrapped drag insertion, draft validation, grouping and existing Excel behavior).
- `node tests/local/auth-regression.mjs`: passed against isolated local Miniflare D1, without sending email.
- Translation interpolation placeholders checked against main: unchanged.
- Browser: guest Home → Rank, popular-topic card → Rank, Topic → Rank, Post → Rank and Community → Rank all reached the editor without login.
- Browser: click-to-tier assignment with custom Thai tiers; Publish → login → original editor, with assignments restored.
- Browser: created an older account draft, made additional guest assignments, logged in again; the newer guest title and **2 / 27** assignments won over the older account draft. The temporary local QA account was logged out and removed. No ranking was published.
- Browser: Home, topics, Topic Detail, Rank, Post and Community checked at **360, 390, 768, 1024 and 1280px**, plus Thai/dark Home at all five widths: **35 width checks**, no document horizontal overflow. Details are in `artifacts/ux-foundation/responsive.json`.
- Tablet navigation opened at 768px. Editor toolbar stayed in the viewport and away from the item pool; mobile editor hides bottom navigation as before. Existing focus-visible and reduced-motion CSS remain intact. This is a browser layout/interaction check, not a full assistive-technology audit.

## Screenshots

Home EN, light, 1280px

Home TH, dark, 390px

Guest editor, 390px

Topic actions, 1280px

Post with board next steps, 1280px

## Deliberately outside this change

No production deploy or production D1 writes; no migration, schema, API field/route rename, community aggregation change, backend rewrite, Profile/Admin redesign, new dependency or palette overhaul. Duel remains available. Unrelated historical Profile/Admin terminology is left for its own pass. Drafts remain device-local, and restoring still requires the topic's item/tier signature to match.


> Screenshot captures and local visual-audit artifacts were removed before publishing this repository. The implementation findings above are retained.
