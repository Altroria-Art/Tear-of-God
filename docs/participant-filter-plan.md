# Plan: Participant filter on the Community Average (Participants page)

Route: `/template/:templateId/participants`

## 1. Current behavior and existing implementation

The Participants page (`src/pages/CommunityParticipants.jsx`) shows a "Community Average"
section with these filters:

- **Tier checkboxes** (display-only): select which tier labels from the computed average are
  shown. This is a *display* filter applied after the calculation, not an input to it.
- **Faculty / Major / Academic Year** selects: these filter *which rankings feed into the
  average*, entirely client-side.

Data flow today:

1. On mount, `fetchTemplate(templateId)` and `fetchTemplateParticipants(templateId)` are fetched
   in parallel (`Promise.all`) and stored in state (`template`, `participants`).
2. `participants` is an array where **one row = one ranking** (not one user). Each row already
   carries `user_id`, `username`, `avatar_url`, `faculty`, `major`, `year` and the full
   `ranking_items` (see `functions/api/template-participants.js` — it `LEFT JOIN`s `profiles`
   on `r.user_id`).
3. `filteredRankings` (`CommunityParticipants.jsx:121`) filters `participants` by
   `facultyFilter` / `majorFilter` / `yearFilter` only.
4. `calculateCommunityAverage(filteredRankings, tiersDef)` (`:16`) averages every item's score
   across the filtered rankings (score = `tierCount - tierIndex`), groups items back into tiers
   by rounded average, and returns the tier rows rendered via `<TierRow>`.
5. The "Calculated from N users" caption maps 1:1 to the *number of ranking rows* currently
   included (`filteredRankings.length`), including duplicates when one user has several rankings.

The existing cascading behavior: changing Faculty resets Major to `''` (All) inline in the
Faculty `onChange` (`:321`). Major's select is disabled while Faculty is empty. This existing
cascade must be preserved.

All filtering happens client-side; the backend endpoint returns the full participant dataset for
the template with all ranking items in one request. No server-side filter by user exists, and
none is needed.

## 2. Where participant/user data comes from

- **Source of truth:** the `profiles` table in D1 (`schema.sql` lines 1–14) — columns
  `id`, `username`, `avatar_url`, `university`, `faculty`, `major`, `year`.
- **Fetched via:** `GET /api/template-participants?template_id={id}`
  (`functions/api/template-participants.js`), which returns all rankings for the template joined
  with the current profile values. The frontend calls it through
  `fetchTemplateParticipants()` in `src/lib/api.js:442`.
- **Identity:** `r.user_id` → `profiles.id`. A single real user may appear on multiple ranking
  rows (multiple tier lists for the same template).
- **Profile values are optional** — `faculty`, `major`, `year` may be empty/null. The profile
  editor (`src/pages/Profile.jsx`) and `functions/api/auth.js` validate that `faculty` is a known
  `FACULTIES` name, that `major` belongs to that faculty, and that `year` passes
  `isValidAdmissionYear()`. Old records predating `migrations/0004_profile_education.sql` may
  still hold values that are no longer valid → treat those as "missing".

Key utilities (`src/lib/university.js`): `FACULTIES`, `getFacultyByName(name)`,
`getMajorsForFaculty(name)`, `isValidAdmissionYear(year)`, `getAdmissionYears()`. The `year`
dropdown values are 2-digit Buddhist-era strings (e.g. `"68"`), matching `profiles.year` as
stored by the profile editor.

## 3. New participant filter behavior

- Add a participant/user selector to the Community Average filters.
- The selector lists the **people** who created at least one tier list for the current template
  (distinct `user_id`, deduplicated from the already-loaded `participants` array — no new API).
- Selecting a participant filters the Community Average to **that person's rankings only**
  (all of them combined if they created more than one).
- The filter is applied *before* `calculateCommunityAverage`, i.e. it is an input filter
  (like faculty/major/year), not a display filter (like tier checkboxes).

## 4. Interaction with Faculty / Major / Academic Year filters

Three behaviors:

1. **Auto-populate on selection.** When a participant is selected, the page sets Faculty, Major,
   and Academic Year from that user's profile:
   - If `profiles.faculty` is a known faculty name in `FACULTIES` → set Faculty to it;
     otherwise leave it `All`.
   - If `profiles.major` is a major *valid for that faculty* → set Major to it; otherwise
     `All`.
   - If `profiles.year` passes `isValidAdmissionYear()` → set Academic Year to it (normalized to
     string); otherwise `All`.
   - No value is ever invented or inferred when the profile does not contain it, or contains an
     invalid/unrecognizable value (treated as missing).
2. **Auto-setting vs the existing cascade.** When major is auto-set, `facultyFilter` is set
   first so the major dropdown is enabled and shows the option. The cascade (changing faculty
   clears major) is preserved for **manual** changes.
3. **Manual profile change clears the participant.** If the user manually changes ANY of
   Faculty / Major / Academic Year while a participant is active:
   - Reset the participant filter to `''` (All / no participant).
   - Keep the freshly selected Faculty / Major / Academic Year value.
   - The average re-computes with the new profile filter(s), per the existing logic.
   - Changing Faculty also clears Major (`''`), preserving the current cascade.

Implementation note: programmatic auto-population runs through a dedicated handler
(`applyParticipantSelection`), while the three dropdown `onChange` handlers only fire on user
interaction — so auto-population never self-clears the participant.

When no participant is selected, behavior is unchanged: the participant filter simply does not
participate in `filteredRankings`.

## 5. Expected UI/UX behavior

- The participant selector is a native `<select>` rendered **above** the Faculty / Major /
  Academic Year grid, full-width, using the exact same label / border / padding styling as the
  three existing selects so visual design and spacing stay consistent.
- Options: `All` (value `''`, label reused from `participants.all`) followed by one option per
  distinct participant, labeled with their username (`Unknown` fallback already comes from the
  backend). Sorted alphabetically for predictable ordering.
- Lives inside the existing filters card, so the "Clear all filters" and empty-state "Clear
  filters" actions both reset it.
- The "Calculated from N users (out of total)" caption keeps its existing semantics (it counts
  ranking rows). When filtering one user with a single ranking it reads "Calculated from 1 user
  (out of ...)". No caption change.

Dropdown choice rationale: the page's existing UI pattern is plain `<select>`s for the three
profile filters, and there is no searchable/combobox component in the project
(`SortDropdown.jsx` is a small custom menu for sort options, not a searchable select). Participant
count per template is small, so a native `<select>` best matches the existing look and keeps the
change minimal.

## 6. Frontend / backend / API / data-flow changes

Frontend only:

- `src/pages/CommunityParticipants.jsx`:
  - New state `participantFilter` (`''` = All).
  - Memoized `participantOptions`: distinct users derived from the already-loaded `participants`
    (skip rows without `user_id`), sorted by username.
  - `applyParticipantSelection(userId)`: sets participant + auto-populates faculty/major/year per
    §4.1 using `getFacultyByName` / `isValidAdmissionYear` from `src/lib/university.js`.
  - Manual-change handlers for faculty/major/year that set the new value (preserving the
    faculty→major cascade) and clear `participantFilter`.
  - Extend `filteredRankings` with `participantFilter` (filter by `user_id`) and normalize the
    year comparison to `String(p.year)` for robustness.
  - Include `participantFilter` in `hasActiveFilters` and `clearAllFilters`.
  - Render the participant `<select>` above the three-column grid.
- `src/locales/th.json` + `src/locales/en.json`: add one key
  `participants.participant` ("ผู้เข้าร่วม" / "Participant").

No backend change, no schema change, no migration, no new API, no new fetch. The participant
dropdown reuses data the page already loads; selecting it issues **no new request**.

## 7. Edge cases and potential regressions

- **One user, multiple rankings:** deduplicated into a single dropdown entry; selecting them
  averages across all their rankings (same weighting the page already applies to multi-rank users).
- **Ranking rows with null `user_id`:** excluded from the dropdown (not selectable) but still
  counted in the un-filtered average — preserving today's behavior.
- **Profile field present but invalid/unrecognizable:** treated as missing (`All`), per §4.1 —
  never invented, never clamps into a wrong option.
- **Year stored with different type/spacing:** `String(p.year)` matches the string-valued
  dropdown options exactly; values like `"2568"` fail `isValidAdmissionYear` → left `All`.
- **Auto-set + manual-change conflict:** avoided because auto-population bypasses the manual
  change handlers.
- **No participants:** page already short-circuits before rendering filters; the new select never
  renders. `participantOptions` empty → only the `All` option shows.
- **Existing behavior unchanged when nothing is selected** (default state `''`): rows pass the
  `participantFilter` guard, and all other logic is untouched.
- **Tier display filters** are untouched; they still slice `calculatedAverage` after computation.
- **Exports (image/Excel)** already operate on `displayTiers`, so they automatically reflect the
  participant-filtered average.

## 8. Files to be modified

1. `src/pages/CommunityParticipants.jsx`
2. `src/locales/th.json`
3. `src/locales/en.json`
4. `docs/participant-filter-plan.md` (this file — result section updated after implementation)

## 9. Testing / verification plan

Automated:
- `npm run lint` (oxlint)
- `npm run build`

Manual (local stack via `npx wrangler pages dev dist --local`):
1. Participants page loads normally.
2. Participant dropdown lists exactly the distinct users of the current template.
3. Selecting a participant shows only their data in the Community Average.
4. Selecting a participant auto-populates Faculty / Major / Academic Year from their profile.
5. Missing Faculty → Faculty stays `All`.
6. Missing Major → Major stays `All`.
7. Missing Academic Year → Academic Year stays `All`.
8. Changing Faculty while a participant is active resets the participant.
9. Changing Major while a participant is active resets the participant.
10. Changing Academic Year while a participant is active resets the participant.
11. After reset, the manually selected filter still filters correctly.
12. Tier checkboxes keep working together with the new filter.
13. Clearing the participant restores normal Community Average behavior.
14. No new/repeated API calls when selecting a participant (reuses already-loaded data).
15. Existing page behavior (load, empty state, exports, counters) unchanged.
16. Lint + build pass.

## 10. Implementation result (filled after implementation)

Implemented as planned, with no backend/schema/API changes (frontend only).

Files changed:
1. `src/pages/CommunityParticipants.jsx` — added `participantFilter` state (user_id, `''` = all),
   `participantOptions` (distinct users deduplicated by `user_id`, sorted by username), the
   `applyParticipantSelection` auto-populate handler (validates faculty/major/year against
   `getFacultyByName`/`isValidAdmissionYear`, leaves missing/invalid values as `All`), manual
   change handlers (`handleFacultyChange`, `handleMajorChange`, `handleYearChange`) that clear
   the participant filter while preserving the faculty→major cascade, extended
   `filteredRankings` (participant filter + `String(p.year)` normalization), included the
   participant filter in `hasActiveFilters`/`clearAllFilters`, and rendered a full-width
   `<select>` above the Faculty/Major/Academic Year grid styled identically to the existing ones.
2. `src/locales/th.json` / `src/locales/en.json` — added `participants.participant`
   ("ผู้เข้าร่วม" / "Participant").
3. `docs/participant-filter-plan.md` — this file.

Deviations from the original plan: none (UI choice was plain native `<select>`, full-width,
above the profile filter grid, as planned).

Tests performed:
- `npm run build` — passes (Vite production build clean).
- `npm run lint` (oxlint) — no new findings from the changed files; the single lint **error**
  (`fix_email.js:10:23: Unexpected token`) is a pre-existing syntax error in an untouched legacy
  root script, and the only warning inside the touched file (useMemo `tiersDef` dep)
  pre-dates this change.

Remaining manual QA checklist (local stack, `npx wrangler pages dev dist --local`) still to run
by hand — the interaction cases from §9 (auto-populate, missing profile fields → `All`, manual
profile change resets participant, tier filters + exports still consistent, no extra API calls).
No production deployment and no commits were made.