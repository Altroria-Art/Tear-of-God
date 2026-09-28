# Project audit — 28 September 2026

Branch: `codex/project-audit-fixes`. Changes remain in the working tree; no production deployment, remote database mutation, commit or push was performed.

Subsequent update: the user later authorized production deployment. It completed successfully; see [deployment record](deployment-audit-2026-09-28.md). The paragraph above describes the audit checkpoint before that authorization.

## Verified fixes

### Authentication and request isolation

- Password reset now consumes a valid, unexpired token in the same D1 batch as the password change. Concurrent reset attempts cannot both succeed. Password changes invalidate outstanding reset links and sessions.
- Login/session creation checks the password hash again when inserting the session, preventing a password verified before a reset from creating a session after the reset.
- Concurrent registration returns the existing-email result instead of an unhandled unique constraint error. Failed reset email delivery removes only its own token; email requests have a timeout.
- UserContext ignores outdated session restoration results. API GET deduplication and similar-user caches are cleared on session changes; old completions cannot remove a newer request or refill the cache.
- Old 401 responses, including profile update, badge and pin mutations, cannot sign out a replacement session. A current unauthorized mutation emits one expiration event.
- Theme and language initialization tolerate unavailable browser storage. Inactive login form faces are hidden from assistive technology.

Evidence: `auth-concurrency`, `auth-regression`, `user-session-state`, `client-request-regression`, `verified-session-mutations`, `admin-api-security`, `security-headers`.

### D1 correctness, concurrency and costs

- Vote counter updates and vote rows change in one transaction; repeated identical votes no longer double-count. Template reactions are idempotent under concurrent requests.
- Profile pin limits are enforced by the write itself. Ranking/duel contribution cooldowns remain atomic on a fresh `schema.sql` database as well as a migrated database.
- Duel payload types, sizes and duplicate entries are validated. Its error handler retains the database/template variables needed for cleanup and cooldown responses.
- Ranking submissions cannot combine creation of a new template with an existing template ID. Template views do not create orphan rows for missing templates. Duplicate report submissions are handled under concurrency.
- Similar-user queries reuse numbered bindings, avoiding the D1 parameter limit for 60 candidates.
- Admin user deletion reconciles surviving vote and comment counters, including cascaded replies, and invalidates affected caches.
- Public profile totals include likes across all posts rather than the first page only.

Evidence: `api-concurrency-regression`, `admin-deletion-counters`, `ranking-atomicity`, `ranking-orphan-template-delete`, `template-cooldown-anti-pumping`, `duel-api`, `profile-similar-lazy`, quota/index/cache suites. Participant scalability tests cover 0, 1, 100, 101 and 500 distinct participants against local D1; the 500-participant case uses four queries with at most one bound parameter per query.

### Editor, data presentation and exports

- Tier/item lookup maps tolerate names such as `__proto__` and `constructor`. Custom Thai tier labels and each tier's own color remain supported.
- Drag insertion accounts for vertical position when cards wrap onto multiple rows. Editor item grouping avoids repeated full-list scans.
- Restored drafts validate their shape, reject duplicate item IDs and return items with unknown tiers to the unranked pool.
- Unused undo snapshots and the unused history hook were removed after checking imports and consumers.
- Cooldown displays count down and unlock without repeated API polling.
- Template/post/community route changes discard stale response state. Failed comments retain their text for retry. Duel sharing passes the correct URL and reflects actual clipboard success.
- Community pages and exports resolve display names from template items instead of showing database IDs. Personal-versus-community comparisons use stable item IDs, including when two items have the same name.
- Excel exports respect an empty filtered participant selection rather than falling back to every participant. Tier labels remain case-sensitive; image lookup uses the actual template-item response shape.
- Template community links point to the community route; the missing empty-community translation is supplied in both languages.
- HTML metadata replacement preserves literal `$&`, `$$` and related replacement tokens while continuing to escape HTML.

Evidence: `editor-detail-regression`, `community-item-identity`, `participants-excel-export`, `community-excel-analysis` (23 cases), `comment-admin-actions`, `export-card-consistency`, `stats-chart-export`, `page-meta-regression`.

### Feed, profile, bookmarks and responsive layout

- Bookmark state is scoped to identity, guards duplicate mutations, merges initial reads with later mutations, rolls back failures and emits saved-list updates only after success.
- Saved/search pagination moves back to the last valid page when results shrink. Discovery listing errors offer retry instead of appearing as empty successful results.
- A stale feed request cannot release the lock held by a newer request.
- Profiles load beyond the first 50 posts, include older pinned posts, stop on a short final page and retain the current page after failed loads. Initial post failures offer retry. Duel pagination now passes the props expected by Pagination.
- Follow actions are guarded against rapid duplicate submissions; outdated follow-list results are ignored. Profile edit drafts survive background user refreshes.
- Mobile header controls no longer overlap the logo at 320px. Tablet navigation provides access to search between 768px and 1023px. Pagination wraps; listing grids and long hashtag labels accommodate narrow screens.
- Route error boundaries reset on pathname changes. Unreachable legacy ActivityFeed, HomeRightSidebar and color-map modules were removed after import graph and repository reference checks.

Evidence: `bookmark-state-regression`, `profile-pagination-regression`, `saved-templates-sync`, feed/trending regression suites, browser checks below.

## Validation

- `npm run build`: passed on final source.
- `npm run lint`: passed with four existing Fast Refresh `only-export-components` warnings in Toast and the Theme/User/Bookmark contexts; no lint errors.
- 76 local `.mjs` test files passed. Logs and the final per-file exit codes are in `.wrangler/audit-logs/final-results.json` and `final-*.log` (ignored local artifacts).
- Updated stale fixtures to populate current effective contribution records and current response/cache shapes. Performance assertions retain exact outputs and check actual skipped queries/rows rather than ratios tied to an obsolete fixture.
- The report-expiry test uses a fixed SQL clock for both fixtures and handlers, retaining the one-second boundary checks without wall-clock flakiness.
- Two historical/environment-specific scripts were excluded: `test-browser-home.mjs` assumes an unrelated Chrome CDP port and UI-only server; browser checks used the supported browser tool instead. `migration-baseline-rehearsal.mjs` asserts the historical Phase 3D state with exactly two active migrations, while the current repository has 23. Current schema, reconciliation and duel migration suites passed; this does not certify a production migration rehearsal.

## Browser checks

Used isolated local D1/R2 state in `.wrangler/audit-browser-state` and Pages dev on `127.0.0.1:8799`, with synthetic accounts and content. The existing user development server was left alone.

Verified guest discovery, protected login return URL, email/password login, mobile item movement into tiers, publishing a ranking, post display, like, comment, save, saved-list display, unsave and empty state. Checked the header at 320px, mobile layouts at 390px and tablet navigation/search at 768px. The corrected community page displayed both real item names and two matching comparisons, with no horizontal overflow and no captured console errors. Returned the browser viewport to its normal size afterward.

Screenshot: `.wrangler/audit-logs/community-mobile.png`.

## Limits and remaining external verification

- No live Google OAuth, external email delivery, production R2 upload, production migration or production-scale traffic test was performed. Local API and synthetic failure/concurrency tests do not establish those external integrations' health.
- Registry dependency vulnerability scanning remains unverified: automatic approval review rejected `npm audit` because it would transmit dependency metadata to npm. Specific permission was requested; no registry audit was performed without that permission. No dependencies were upgraded speculatively.
- This audit documents verified defects and covered paths. Passing tests are not a guarantee that every possible defect or regression in the project has been eliminated.
