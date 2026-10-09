# Quota optimization release — 10 October 2026

The user authorized Preview deployment, then Production deployment after Preview passes, and live testing. The source is the working tree on `codex/free-quota-optimization`; no commit or Git push is part of this release.

## Release preparation

- Vite build and lint passed; lint has four existing Fast Refresh warnings.
- All 96 standalone regressions passed again after the live Discover fix.
- Production before deployment: `dc6f9ef1-e257-4df6-a962-b95786b63443`.
- Production D1: `69d366f1-55ba-43cf-a492-882e137786f4`. Its existing ledger already includes unread-counter migration `0015`, and foreign-key checks passed.
- Captured a D1 Time Travel recovery bookmark before Production changes. Evidence stays in ignored `.wrangler/release-quota-20261010/`; it is not a public data export.
- The old Preview D1 had been deleted. Created a separate APAC Preview D1, `7621470e-290b-417d-bdcd-b413c0b5df61`, initialized the current fresh schema, and applied `0028`/`0029` through the migration ledger. The fresh schema does not include the optional unread-counter table; installed prerequisite `0015` before keeping `NOTIFICATION_UNREAD_COUNTS=true`. Production did not need that migration repeated.
- Preview retains `tear-of-god-preview` R2 and synthetic-account restrictions. Its managed public R2 URL is disabled; app-uploaded bytes can be verified through the authenticated R2 API. Public Preview image serving is not claimed.

## Issue found during live Preview QA

Pulse's public cache can still reference a recently deleted template. Discover's Active tab previously displayed an error for the whole section when that template's metadata returned 404. The API client now retains HTTP status on error results, and Discover skips only 404 metadata results while preserving valid topics in Pulse order. Network/server failures still show retry. Regression coverage verifies mixed valid/deleted topics, all-deleted empty state and a 503 outage; no shorter cache or additional polling was introduced.

Initial QA attempts exposed a stale counter selector and a quoting error in the new external QA harness; corrected the harness. Each attempt removed only its exact synthetic accounts, content and uploaded object, then verified D1 counters/foreign keys. A Preview notification 500 from the missing `0015` prerequisite was corrected before proceeding to Production.

## Deployment and live verification

- Tested Preview deployment: `5fbc4377`; final Preview deployment after restoring uploads disabled: `5cc69834-c9cf-4cd9-a25e-7552201863f0`, https://release-quota-20261010.tear-of-god.pages.dev.
- Production deployment: `c3445033-a5c1-4842-8a40-cebec553ea31`, https://tear-of-god.pages.dev. Both deployments contain the same verified build and preserve the expected separate D1/R2 bindings. Production mail secret remains bound.
- Applied only Production migrations `0028_quota_read_indexes.sql` and `0029_exact_template_usage_counts.sql` through Wrangler migration discovery/ledger. Enabled `TEMPLATE_USAGE_COUNTERS=true` only after comparing counters with live ranking counts. `NOTIFICATION_UNREAD_COUNTS=true` remains enabled.
- Successful Preview and Production QA each used two synthetic accounts registered/logged in through the real auth endpoint. Created a temporary ranking/template through the app, checked exact usage counters, posted/replied/deleted comments through the built UI, and verified cross-user delete rejection, unsent drafts, notifications, root deletion preserving the other author's reply, counters `0→1→2→1→0` and persistence after refresh.
- Shared Community comments/reactions were checked with different sessions: public totals agree, private votes remain isolated, and fresh requests after mutation reflect deletion.
- Chromium checked Home, Discover/list, Profile, Post and Community in English/Thai at 390/1440px. Discover's three tabs and four API time windows passed. No uncaught runtime error or API 5xx was observed in the final successful browser checks. Mobile viewport emulation is not a test on a physical phone.
- Initial screenshot capture in the external harness could occur during loading. A separate read-only Production pass then explicitly waited for loaded feed cards, Discover/list cards, Profile tiles, the real post title and the loaded Community result. All **24 loaded screens** (six routes × two languages × two widths) passed page-overflow checks, with no runtime error/API 5xx; loaded Discover and Community images were inspected visually. Evidence remains private in `.wrangler/release-quota-20261010/loaded-ui/`.
- Actual cross-account comment/reply visibility in Preview: 9,356/10,671ms; Production: 9,246/10,666ms. These are observed timings from one run, not a latency guarantee.
- App upload reached the intended R2 bucket in both environments, and authenticated R2 downloads matched the uploaded bytes. Production additionally passed public image retrieval and immutable cache-header checks. Preview uploads were enabled only for QA and disabled again in its final deployment; its public managed domain remains disabled.
- A separate Production smoke check used the authorized existing administrator account. Authenticated report archive API/tabs, own Profile education, public Discover/Profile/Comments, actual existing R2 images, login/signup form reset and book layout passed. This check did not mutate real reports/content or send emails; it logged out its own session afterward. Report count was zero, so nonempty Production archive rendering was not demonstrated in this release.
- Additional authenticated admin stats/catalog requests and public Spotlights/template suggestions passed with the new exact-counter flag enabled, without content mutations; their temporary admin session was logged out.

## Data integrity and cleanup

Before migration and after final QA cleanup, Production counts were unchanged: 66 profiles, 30 templates, 59 rankings, 43 post comments, 1 community comment and 0 reports/actions. Exact template usage and notification unread counters matched live counts, with zero foreign-key violations. Preview contains zero test profiles/templates/rankings/comments after cleanup.

Every QA attempt recorded its exact identities/content/object key in Git-ignored evidence. Cleanup first checked for external adoption of the owned topic, removed the owned ranking through normal app behavior, then removed only exact synthetic profiles/sessions and unreferenced owned item IDs. Uploaded test objects were deleted from their respective bucket. Routine aggregate telemetry/auth rate-limit records retain their normal lifecycle; cleanup did not edit shared analytics aggregates or unrelated users' data.

No raw SQL snapshots, credentials, sessions, QA screenshots or test JSON were added to Git. No Git commit/push was performed. `git diff --check` passed.

## Remaining limits and rollback

- No concurrent Production load test, physical-phone test or Safari/Firefox run. Real browser hidden/offline behavior and sustained Workers CPU budgets were not verified in this release; their existing logic has local regression coverage.
- Administrator coverage is a read-only smoke check, not all Admin actions. Duel transactions retain local regression coverage; live Duel creation/resolution was not repeated. No real OTP delivery/password reset was performed.
- Two historical cleanup Worker exceptions were not diagnosed by these Pages deployment checks. This release does not claim to repair them.
- Free-tier capacity is not guaranteed; measure actual player duration, tabs, edge locations, CPU and data growth after rollout. These smoke checks are functional tests, not a campus-scale traffic simulation.
- If application smoke tests later reveal a regression, roll Pages back to prior Production deployment `dc6f9ef1-e257-4df6-a962-b95786b63443`. The new tables/indexes/triggers are additive and compatible with the older code; keep them rather than dropping user data. Disable the new counter flag for a forward deployment if needed. Restoring an old D1 bookmark would discard subsequent writes and is not the ordinary UI rollback.
