# Tear of God — Rank Your Vibe

Implemented on `codex/ux-ui`. This is a source change, not a production deployment.

## Architecture boundaries

The app remains React/Vite with lazy route imports and the existing User, Theme and Bookmark providers. Authentication remains cookie-based Pages Functions authentication plus Firebase Google sign-in. UI work does not change `functions/`, `schema.sql`, migrations, API contracts, request deduplication, analytics, or session restoration.

Home retains cursor pagination, pending mutation guards, seen-item handling, the virtual feed window, and request-generation cancellation. Server feed/cache implementations and indexed D1 queries remain intact. Discover retains delayed loading of hashtag sections. Profile retains the lazy similar-taste query and existing pins/badges. Notification polling intervals and expiry/read behavior are unchanged. Editor drafts, item identity, wrapped-row insertion, custom tier colors and publishing validation use the existing helpers.

Duel is a ranking comparison with the template owner, not a binary-choice game. Its editor and result screen retain that existing behavior. Community Average retains aggregation, reactions, distributions and spreadsheet/image exports.

## Design implementation

- Opaque paper/ink surfaces replace the background mesh and translucent panels. Acid lime is the primary action color; violet, pink and cyan support accents. Theme tokens retain existing semantic names so secondary screens and admin inherit the system.
- Display typography, a tear-shaped wordmark, compact editorial headers and sticker eyebrows establish the identity. New copy has English and Thai translations; security and destructive confirmations retain explicit language.
- Shared `PlayHeader`, `TierLoader`, `DropZone` and CSS primitives complement the existing Modal, TierLabel, ActionButton, BookmarkButton and EditorItem components. No animation dependency or extra font request was added.
- Home introduces the product and a create CTA above the existing feed. Discover adds an in-page search form using its existing URL query contract. Template cards use larger previews.
- Create puts Quick Add, the board, then metadata in mobile reading order. Desktop uses a large left board and a right input column. Rank keeps its title visible and exposes optional metadata through a native details control. Publish shows real ranked/total progress.
- Drag source lift, drop-zone feedback and drop animation complement the existing touch/keyboard tier picker. Direction buttons have 44px targets. Tier settings now use the shared focus-trapped Modal, with named color buttons and selected-state semantics.
- Community and Duel use short tear reveals. Profile retains its real identity data in a passport-style panel. Reaction/bookmark controls have consistent targets and selected feedback.
- Shared dialogs, toast, loader, 404, export actions and admin navigation use the same surfaces. Login's decorative example counts were replaced with explicit example labels; they are not live activity claims.

## Verification

Build and oxlint ran after each implementation phase. Final lint has only the four existing Fast Refresh `only-export-components` warnings in the context/provider files.

The browser audit is `node tests/local/rank-your-vibe-browser.mjs`, with Vite running locally. It uses an isolated headless Chrome profile and synthetic intercepted API responses. `CHROME_PATH` and `UI_TEST_URL` can override local defaults. All API requests stay in the fixture harness; production data is not used.

The completed audit recorded **666 viewport checks**, no horizontal overflow and no runtime exceptions:

- 17 public/guest route states × 9 widths × 2 themes × 2 languages = 612 checks.
- Authenticated Home plus five admin screens × 9 widths = 54 checks (dark/Thai).
- Widths: 320, 360, 375, 390, 412, 430, 768, 1024 and 1440px.
- Interaction checks: tap opens tier picker, focus moves into it, Escape closes it, tap assigns an item, a drop event moves it between tiers, Discover updates the query, and reduced-motion disables transitions.

The browser audit generates screenshots and `audit.json` under the ignored `artifacts/rank-your-vibe/` directory. Local copies were pruned after review; rerun the audit to recreate them. Representative Home, Create, Discover and Community screenshots were visually inspected in both themes and at mobile/desktop sizes.

Existing checks passed:

```
node tests/local/editor-detail-regression.mjs
node tests/local/home-virtual-window.mjs
node tests/local/home-feed-cursor-cache.mjs
node tests/local/preloadable-import.mjs
node tests/local/bookmark-state-regression.mjs
node tests/local/client-request-regression.mjs
node tests/local/export-card-consistency.mjs
node tests/local/template-card-preview-comprehensive.mjs
node tests/local/template-card-preview-dimensions.mjs
node tests/local/profile-similar-lazy.mjs
node tests/local/profile-links-audit.mjs
node tests/local/notification-polling.mjs
```

Limits: the browser suite uses fixtures, not a full real-session end-to-end login/upload/publish flow. The drop assertion exercises DOM event handlers rather than a physical pointer drag. It is a responsive and accessibility smoke audit, not a complete WCAG or device-lab certification. Admin viewport fixtures cover empty management tables; populated backend behavior remains covered by existing implementation and unchanged APIs.
