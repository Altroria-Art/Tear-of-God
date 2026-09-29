# Rank Your Vibe — local acceptance evidence

Branch: `codex/ux-ui`, based on `main` at `0d4fab9`. This review did not merge, deploy, use remote D1, or upload to production R2.

## Scope and source audit

The redesign changes React components, CSS, Thai/English strings, local QA scripts, and documentation. No `functions/api/`, `schema.sql`, migration, `wrangler.toml`, package manifest, feed/cache service, or analytics implementation was changed. `git diff --check` passes. The Login hero uses clearly labeled examples; its previous misleading “Real Template” label and unused fabricated usage counts were removed.

One acceptance bug was reproduced with real UI and local D1: two Publish clicks in the same event turn created two rankings because a React state guard had not committed. Create and Rank now use synchronous pending refs in addition to disabled/loading state. The real browser flow verified one persisted ranking after two rapid clicks for both new-template and existing-template publishing. English-only eyebrow copy on Thai routes was moved to translations.

## Real local Pages, D1, and R2

`schema.sql` was applied to a separate local Wrangler persistence directory, then the production build was served with `wrangler pages dev dist --persist-to <local-directory>`. All mutation requests stayed on `127.0.0.1`. The browser suite uses no API interception.

- `node tests/local/rank-your-vibe-real-flow.mjs`: 31 API checks with two local accounts. Includes auth/session, new and existing template rankings, Community Average, feed, follow, like/dislike/undo, bookmark, comment/reply, pin, report, notifications, and cleanup actions.
- `node tests/local/rank-your-vibe-real-browser.mjs`: 50 browser checks. Covers guest-to-login safe return, invalid and valid login, session refresh, local JPEG/PNG/WebP uploads and validation errors, Quick Add, tier picker, focus trap and Escape, actual mouse drag/reorder/Unranked return, custom tier, rapid Publish, Post Detail refresh, Home visibility, own profile, UI logout/register, protected profile, theme/language toggle, and publishing an existing template from another account. Browser runtime exceptions, console errors/warnings, and unexpected API 5xx: zero.
- Local R2 accepted JPEG, PNG, and WebP, and rejected invalid MIME (415) and oversized files (413). This verifies local object writes, not production R2 delivery. The public R2 image URL and full UI preview/retry were not verified locally.
- The post appeared on Home through the application's Home link after publish. A full page navigation resets the intentional in-memory “last published” pin; Trending then uses its normal randomized feed behavior. This was a test navigation issue, not a missing D1 row.

The browser run counted API requests across the **whole multi-route flow**: auth 15, notifications 7, bookmarks 7, upload 5, rankings 6, templates 3, analytics 3, spotlights 1, users 1. This is not a route-only benchmark against `main`. New display components contain no fetch calls.

## Regression and build

- Existing fixture browser audit: 666 viewport checks, zero violations, zero runtime errors. It is fixture-backed responsive coverage, separate from the real Pages/D1 flow.
- Relevant existing regression scripts: 26 passed, including auth, client requests, Home cursor/cache/virtual window, bookmarks, editor, ranking atomicity, Community item identity/aggregation, Duel API, export, notifications, profile pagination/lazy similar taste, and template preview.
- `npm run build` passes. `npm run lint` passes with four pre-existing Fast Refresh `only-export-components` warnings. No dependency was added.
- Compared with a local production build of `main` using the same dependencies: total JS gzip approximately +3.5 KB, CSS gzip approximately +2.7 KB, entry JS approximately +0.2 KB, Home chunk approximately +0.5 KB. No Lighthouse or production latency benchmark was performed.

## Pending manual or limited coverage

The physical iPhone/Safari and Android/Chrome checks in [rank-your-vibe-device-checklist.md](rank-your-vibe-device-checklist.md) remain pending. Chrome emulated a 390 px touch tap, but not physical long-press drag, on-screen keyboard, safe area, camera/gallery upload, or OS share/download. Google Sign-In was not tested locally. UI-level upload preview/retry, failure-injection rollback for optimistic social actions, complex drag with many/long items while scrolling, and all Community/Profile variants were not exhaustively exercised; their relevant API and existing regression checks passed. Do not treat this as physical-device or production acceptance.

The branch is suitable for a review PR with these limits stated. Merge readiness still depends on reviewer feedback and the physical phone checklist.
