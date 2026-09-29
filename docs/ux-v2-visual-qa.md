# UX v2 visual QA

Branch: `codex/ux-v2`, based on `main` at `1b04621` (PR #103). This pass changes presentation and interaction feedback only. The Pages Functions, D1/R2 schema and behavior, APIs, authentication flow, ranking logic, feed cache, and draft behavior remain unchanged.

## Visual direction

The previous UI still relied on repeated rounded panels, a formal two-column authentication page, and account-like profile sections. UX v2 uses paper/ink foundations, a restrained accent palette, an editorial type hierarchy, a reusable rip mark, poster-style promotions, a membership-ticket auth layout, and a taste-passport profile. Create and Rank keep their working editor structures; their visual hierarchy and mobile guidance are refined.

Shared CSS in `src/index.css` defines the button, form, motion, and modal roles. `RipMark.jsx` provides the brand tear motif. `Modal.jsx` shares accessible dialog behavior across action, picker, and editor appearances. Motion is short and transform/opacity based, with a `prefers-reduced-motion` override.

## Screenshot review

Images in `artifacts/ux-v2/` were captured from local Pages + D1 at 1440×900 and 390×844. They are local QA artifacts and are ignored by Git. `before/` contains representative captures from `main`; matching filenames at the root show this branch. The reviewed light-mode pairs are Home, Login, Discover, Profile, Post, Community, Duel, Create, and Rank. The dark-mode baseline pairs are Home and Login. Additional after captures cover Register, Forgot/Reset Password, Edit Profile, First Profile Setup, and all major screens in dark mode.

| Area | Main finding | UX v2 result |
| --- | --- | --- |
| Home | Three lower columns read like dashboard widgets | Distinct poster, social feed, and live-pulse treatments |
| Login/Register | Generic split marketing/form layout | Asymmetric ranking-club membership ticket |
| Recovery | Scattered decorative blocks | Focused editorial headline and simple form |
| Profile/Edit/Setup | Nested account panels | Taste passport, ranking gallery, branded editor, conversational setup |
| Discover | Uniform catalog cards | Featured template rhythm with standard cards |
| Post/Community/Duel | Metadata and statistics competed with rankings | Tier board and comparison result lead each page |
| Create/Rank | Working flow needed clearer hierarchy | Quick Add and publish panel strengthened; mobile picker guidance added |

The screenshots were visually inspected, including light and dark themes, 1440px and 390px layouts, Thai content, dialog layouts, and the 320px overflow checks in the browser suite. The final Home screenshots were recaptured after the live feed and promotional content loaded. Final fixture captures in the ignored `artifacts/rank-your-vibe/` directory also cover Login, Register, Post, Community, Duel, Profile, and Discover at 1366×768. The final fixture audit checked 774 route/locale/theme/viewport combinations with no horizontal overflow or runtime exceptions.

## Interaction and device limits

Desktop mouse uses native HTML drag/drop in the Rank editor. Touch and keyboard use item activation followed by the accessible Assign Tier picker. Browser emulation confirms that fallback; it does **not** establish physical finger-drag support. No physical iOS/Android test was available, so finger drag is not claimed. A dedicated touch-drag feature would require a separate implementation and physical-device regression pass.

The real local Pages/D1 flow covered login, registration, session restore, profile setup/edit, ranking creation/publish, mouse drag, emulated-touch tier selection, focus trap/Escape, theme/language, and mobile overflow. No production deployment or merge was performed.
