# English and Thai interface copy audit — 9 October 2026

## Scope and approach

The interface was reviewed before editing: all 1,124 English and 1,105 Thai text entries, route inventory in `src/App.jsx`, page/component strings outside the locale files, API error presentation, exported images, Excel output, and the reset-code email. Existing clear wording was kept. User names, topic titles, hashtags, item names, custom tier labels, and official education data remain user/data content.

The goal is familiar, direct language for young users: say what happens, keep buttons short, and explain the next step when something fails. English uses everyday verbs and contractions. Thai uses conversational wording such as “ลอง”, “ล็อกอิน”, and “คอมเมนต์”, without relying on slang or jokes to explain an action. Destructive confirmations still explain what gets deleted and whether it can be undone.

Terminology is consistent:

| Concept | English | Thai |
| --- | --- | --- |
| Shared set of items | Topic | หัวข้อ |
| Someone’s arrangement | Ranking | อันดับ |
| Rank this shared set | Make my ranking | ลองจัดอันดับ |
| Publish the arrangement | Post ranking | โพสต์อันดับ |
| Group/row in a ranking | Tier | ระดับ |
| Contents to arrange | Items | รายการ |
| Community result | Community ranking | อันดับรวม |

Examples: “Publish” → “Post ranking”; “Community Pulse” → “Happening now” / “ช่วงนี้คนคุยอะไรกัน”; errors explain the problem and next action. Technical explanations still distinguish an average from unanimous agreement, votes from item placements, and the selected time period from all-time counts.

## Implementation

- Reworded 554 existing English entries and 593 existing Thai entries. Filled language gaps and added error/export strings; both locales now contain the same 1,262 text entries, including array entries. Original interpolation parameters are preserved.
- Separated the “Load more” action from “Loading more...” progress text.
- Localized short relative times, missing-key fallbacks, theme labels, profile photo labels, the 404 badge, share images, statistics image footers, and Excel labels/summaries. Export images now show the correct `tear-of-god.pages.dev` domain.
- Added `src/lib/apiMessages.js` to turn known server errors into clear messages in the selected language, with safe generic fallbacks. It preserves server status, codes, retry timing, and data; it does not change request payloads or server validation. Google sign-in errors use the same locale approach.
- Reset emails have concise Thai and English text together. The six-digit code, ten-minute expiry, single-use behavior, email binding, and session revocation are unchanged.
- CSV/JSON field names and API/database identifiers remain stable. User-generated content is not translated. Excel defaults remain available to non-UI callers, while the page passes its translator for localized downloads.

## Validation

- `npm run build`: passed.
- `npm run lint`: passed with the four existing Fast Refresh warnings in ThemeContext, UserContext, Toast, and BookmarkContext.
- `tests/local/ui-copy.mjs`: passed. Same keys in both languages, no blank values, matching interpolation/rich-text markup, all static source translation references present; API errors do not leak diagnostics or alter result metadata; Excel preserves user text and localizes presentation.
- Existing targeted suites passed: client-request-regression, community-excel-analysis (23 cases), participants-excel-export (7 cases), export-card-consistency, stats-chart-export, password-reset-code, editor-detail-regression, primary-navigation-regression, page-meta-regression, and auth-mode-reset-regression.
- `tests/local/ui-copy-browser.mjs`: passed in Chromium with deterministic local API fixtures: 26 routes × 2 languages × desktop/mobile = 104 screen checks. Includes Home, Discover and search/saved/list/tag views, Create, Rank, Topic, Community, Participants, Post, own/other Profile, Duel, 404, five Admin routes, Login, Forgot Password, and Reset Password. Also checked profile editing, share previews, download themes, and failed sign-in in both languages. No runtime exceptions, untranslated visible keys, or horizontal page overflow. Selected screenshots were inspected visually.
- Browser helper cleanup now waits for Chromium to exit before deleting its temporary profile, avoiding Windows file-lock errors that can mask QA failures.

Browser fixture evidence and one-off rewrite/audit scripts are under ignored `.wrangler/copy-audit-2026-10-09/`. They are not release assets. The production site and database were not modified by this copy task. Safari/Firefox, live Google/email delivery, actual remote mutation flows, and every hidden interaction/state were not rerun; the browser checks use fixtures, not a full integration audit. The entire test catalog was not rerun. No deployment or commit was performed for this change.

To repeat browser checks: build, serve with `npm run preview -- --host 127.0.0.1 --port 8807 --strictPort`, then run `node tests/local/ui-copy-browser.mjs`. The script refuses non-local hosts and intercepts API requests.
