# Discover, UX/UI and Create deployment — 10 October 2026

User authorized Cloudflare deployment of the current working tree on `codex/discover-full-boards`, based on `b539ea2` with uncommitted changes. This release includes community boards/carousel in Discover, the preceding local UX/UI fixes, and exact duplicate name handling/draft repair in Create. No Git commit or push was performed.

- Preview: `9c58d235-3664-4e2a-a2fd-df99c8212434`, https://9c58d235.tear-of-god.pages.dev; existing alias https://release-quota-20261010.tear-of-god.pages.dev.
- Production: `f9ca852d-9abc-4236-85c1-c842938ff748`, https://tear-of-god.pages.dev; deployment URL https://f9ca852d.tear-of-god.pages.dev.
- Previous Production, for Pages rollback: `c3445033-a5c1-4842-8a40-cebec553ea31`.

## Preparation and deployment

The current production build and lint passed (four existing Fast Refresh warnings). Applicable local regressions passed: Create names, editor/detail, ranking atomicity including 500 items and rollback, full Discover boards, Discover fallback/cancellation/paging, Profile pagination, security headers and maintenance guards. Create browser QA had already passed real local D1 submissions and draft repair in both languages on mobile/desktop.

The initial Discover regression was denied loopback access by the shell sandbox; rerunning with the local Workers permissions passed. A mistyped security test filename was corrected to the existing `security-headers.mjs`; its actual checks passed.

Wrangler compiled and uploaded the Pages Functions in each deployment. Production used the same static build that passed Preview. The live HTML, its referenced JS/CSS, and Create chunk were compared with local build contents and matched. Only `dist` static assets and the Functions bundle were published; QA scripts/screenshots/accounts, credentials and database state remain under ignored `.wrangler/release-discover-create-20261010/`.

Existing bindings were verified through the Cloudflare deployment API: Preview D1 `7621470e-290b-417d-bdcd-b413c0b5df61` and R2 `tear-of-god-preview`; Production D1 `69d366f1-55ba-43cf-a492-882e137786f4` and R2 `tear-of-god`. Environment/counter flags and Production mail secret binding remain present. No migration, bucket/config change, or secret update was made. Preview uploads remain disabled.

## Live verification

- Preview: registered/logged in one synthetic `@example.test` account and posted through the actual Create UI. All eight Thai names (`มะม่วง`, `มะยม`, `มะขาม`, `มะขามป้อม`, `มะขามแขก`, `นู้นนี้`, `นู้นนั้น`, `นั้นนู้น`) survived; the second exact `มะขาม` was skipped with its name shown. The post and public community board contained all eight names, one participant, and an exact D1 usage count of one.
- The Preview account/topic were cleaned up through normal post deletion followed by parameterized deletion of the exact owned synthetic profile/sessions. Cleanup checked that no unrelated account had adopted or commented on the topic, verified the topic/profile were gone, and found zero foreign-key violations. Both the initial and final Preview smoke attempts cleaned up their owned data.
- Preview and Production each passed 28 loaded Chromium screens: Home, Discover, topic list, Create, Login, public Post and Profile × English/Thai × 390/1440px. The 390px cases used dark mode and 1440px cases light mode. Loaded feed/Discover cards were awaited before inspecting geometry. Create addition and explicit old-draft repair were exercised in all four combinations. No page overflow, visible translation keys, runtime exceptions or browser API 5xx was found.
- Both environments returned successful auth/catalog/feed/hashtag/Pulse reads. The public board endpoint returned community data without email/session/save/vote/follow overlays and a public cache lifetime bounded by ten seconds. The initial harness expected exactly ten seconds even on a cache hit; corrected it to accept the remaining lifetime specified by `public-response-cache.js`, then reran Preview successfully. Application code was unchanged by this correction.
- Production smoke used guest browsing and client-side Create drafts; it did not publish test posts, delete user content, send OTP email or reset a password on the live site. Browser screenshots were inspected for loaded Discover and Create, including the name warning.

## Limits

This release did not repeat live authenticated Comments/Admin/Duel mutations, real Google sign-in/OTP delivery, R2 uploads/downloads, physical-phone testing, Safari/Firefox, hidden/offline recovery or concurrent campus-scale load. R2 and mail binding checks do not establish upload or delivery success. The wider preceding local audit is recorded in `site-ux-audit-2026-10-10.md`; its local results remain distinct from these remote smoke checks.

If a regression appears, roll Pages back to the previous Production deployment above. This release changed no database schema or stored user content, so a database restore is not part of ordinary UI rollback.
