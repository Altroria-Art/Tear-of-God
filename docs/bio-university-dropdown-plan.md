# Bio: University of Phayao Dropdown (Faculty / Major / Admission Year) Plan

Status: Approved for implementation (2026-09-10).

## 1. Current behavior

The edit-profile modal in `src/pages/Profile.jsx` currently exposes four **free-text inputs**:

| Field | Column | Existing label (TH) | Existing sample value |
|---|---|---|---|
| University | `profiles.university` TEXT | "มหาวิทยาลัย:" | `พะเยา` |
| Faculty | `profiles.faculty` TEXT | "คณะ:" | `ict` |
| Major | `profiles.major` TEXT | "สาขา:" | `se` |
| Year | `profiles.year` TEXT | "ชั้นปี:" | `3` |

Notes on the current implementation:

- Schema: `schema.sql:8-11` defines the four columns as plain `TEXT`; there are no constraints, lookup tables, or reference data.
- API write path: `functions/api/auth.js` `action: update_profile` (`auth.js:74-95`) accepts `university` / `faculty` / `major` / `year` as free strings and writes them via parameterized `UPDATE`. Empty strings are never written by the UI today; missing keys are skipped.
- API read paths: `auth.js:47` (login) and `functions/api/users.js:39-42` (public profile) return the four fields as `null` when empty.
- Frontend state: `Profile.jsx:29-32` holds `university` / `faculty` / `major` / `year` strings; the edit modal (`:445-484`) renders four `<input type="text">`; the profile display block (`:265-272`) renders the stored text.
- i18n: `th.json` labels the `year` field as **"ชั้นปี:"** ("year level", e.g. ชั้นปีที่ 3). This meaning conflicts with the new "admission year (cohort)" semantics and is the reason the old values must be handled.

## 2. Decision summary (user-approved)

1. **Admission Year numbering** — two-digit Buddhist Era (BE) year, computed from the local clock. Min = `38` (BE 2538, the founding-era of the University of Phayao campus),  max = `(currentYear + 543) % 100` (2026 → `69`). The list `38..max` is generated at runtime, so every January 1 the newest cohort appears automatically with **zero source-code changes**.
2. **Legacy data** — a one-time migration clears `university`, `faculty`, `major`, `year` for every row (user chose a clean slate rather than trying to map legacy free text such as `ict`/`se`/`3`).
3. **Validation** — enforced on BOTH the client (edit form) and the server (`auth.js` `update_profile`), using a single shared data module as source of truth. Server-side enforcement exists because upcoming features will filter by faculty/major; tampered/mismatched values would otherwise poison future queries.

## 3. Proposed UI/UX flow

Edit-profile modal (own profile only):

1. A **checkbox/toggle** label: *"Studied at University of Phayao"* (TH: *"เคยศึกษาที่มหาวิทยาลัยพะเยา"*).
2. When unchecked → the faculty / major / admission-year fields are hidden and not required. Saving clears the four columns to `NULL`.
3. When checked → the three dropdowns appear in fixed order:
   - **Faculty** dropdown (18 fixed entries, see §4).
   - **Major** dropdown — `disabled` until a faculty is selected; options are exactly the majors of the selected faculty.
   - **Admission Year** dropdown — values `38..currentBE2` (§5).
4. Changing the faculty **resets** the major to empty.
5. Saving requires faculty + major + admission year when the checkbox is checked; client shows a toast error and aborts otherwise.

Profile display (own and other users): the education block keeps the four line entries, except the year line changes its label to *"Admission Year"* (TH: *"ปีที่เข้าศึกษา"*). Because legacy data is cleared, display reflects only the new dropdown values.

## 4. Data structure: Faculty → Majors

Single source of truth: **`src/lib/university.js`** (pure ESM — no browser APIs, no i18n imports, no Node built-ins — so it can also run in the Workers runtime).

```js
export const UP_UNIVERSITY_NAME = 'มหาวิทยาลัยพะเยา';
export const FACULTIES = [
  { id: 'agriculture', name: 'คณะเกษตรศาสตร์และทรัพยากรธรรมชาติ', majors: [ ... ] },
  ...
];
```

- `id` is a stable machine key (used only for React `key`s), `name` is the exact Thai display string (stored in the DB), `majors` is the exact major-name list.
- Exactly 18 faculties, each with its exact major list from the requirements (see appendix in this file).
- Shared by both worlds:
  - `src/pages/Profile.jsx` (and any future UI) imports helpers for dropdown options.
  - `functions/api/auth.js` imports the same module to validate `update_profile` payloads. No duplicated mapping anywhere.

Helpers exported:

- `getFacultyByName(name)` → faculty object or `undefined`.
- `getMajorsForFaculty(name)` → array of major names or `[]`.
- `isValidFacultyMajor(faculty, major)` → strict check that `major` belongs to `faculty`.
- Admission year: `ADMISSION_YEAR_MIN = 38`, `getCurrentAdmissionYear(date = new Date())`, `getAdmissionYears(date = new Date())` → `[38, 39, ..., current]`.

## 5. Admission Year rule

- Lowest value: **38** (fixed constant → BE 2538).
- Highest value: derived from the current date:
  `last two digits of Buddhist Era year = (date.getFullYear() + 543) % 100`.
  - 2026 → 2569 → `69`. Range today: `38..69`.
  - Because it is date-derived, the newest value appears automatically every January 1 without code changes (the app is bilingual TH/EN; the TH academic-year/BE notation is already the project's cultural context).
- No hardcoded yearly list is maintained anywhere.
- Server and client both validate `year` against `[38, current]` at save time.

## 6. Validation and edge cases

Client (`Profile.jsx` save handler):

- Checkbox unchecked → payload sends `university: null, faculty: null, major: null, year: null`.
- Checkbox checked but faculty/major/admission-year missing → toast error, no request.
- Faculty change → major cleared before render, so an invalid pairing cannot remain.
- Major is never selectable before a faculty is chosen (`disabled`).

Server (`auth.js` `update_profile`):

- `faculty` provided and not in the 18 → 400.
- `major` provided together with a known `faculty` but not in that faculty's majors → 400.
- `major` provided without a valid faculty → 400.
- `year` provided and not an integer in `[38, currentBE2]` → 400.
- `university` provided and not `NULL`/empty or equal to `UP_UNIVERSITY_NAME` → 400.
- `faculty`/`major`/`year`/`university` explicitly `null` (or `undefined`, i.e. not sent) → allowed (clearing / not touching).

## 7. Files to modify

| File | Change |
|---|---|
| `src/lib/university.js` | **New** — canonical faculty/major data + admission-year helpers (shared client/server). |
| `src/pages/Profile.jsx` | Replace the 4 free-text inputs in the edit modal with checkbox + 3 dropdowns; add reset-on-faculty-change, client validation, new state variables, and the reworded display label. |
| `src/locales/th.json` / `en.json` | Add `studiedUp`, `admissionYear`, placeholder/select labels and new error strings; the old `profile.year` label is no longer used for this field. |
| `functions/api/auth.js` | Import shared module; validate `update_profile` education payloads server-side. |
| `migrations/0011_profile_education_reset.sql` | **New** — one-time `UPDATE profiles SET university = NULL, faculty = NULL, major = NULL, year = NULL;` (next free number after `0010`, since `0005` is already `0005_follows.sql`) |
| `schema.sql` | **No change** — existing TEXT columns suffice; no new tables/columns. |

Deployment orders:

1. Apply the migration to local D1 (`npx wrangler d1 execute tear-of-god-db --local --file=./migrations/0011_profile_education_reset.sql`) and to production.
2. Deploy the `functions/` + `src/` changes together (the old free-text UI and the old server should not outlive the cleanup).

## 8. Backward compatibility

- By explicit product decision, existing education data is cleared once via the migration above — no mapping attempt for `ict` / `se` / `3`-style junk. This is a deliberate, documented data reset (deviation from "do not destroy data" is user-approved).
- After the migration, every profile starts with the checkbox unchecked; the edit form and profile display degrade gracefully to the new dropdown-only model.
- No shape change to the API payload fields (`university`/`faculty`/`major`/`year`), so reads in `users.js`, login, and the client all keep working unchanged; only the allowed *values* are now constrained.

## 9. Implementation checklist

- [ ] `src/lib/university.js` — 18 faculties + exact majors; `UP_UNIVERSITY_NAME`; `ADMISSION_YEAR_MIN`; `getCurrentAdmissionYear`; `getAdmissionYears`; `isValidFacultyMajor`; `getMajorsForFaculty`.
- [ ] Migration `0011_profile_education_reset.sql`.
- [ ] `auth.js` `update_profile` server validation (reject invalid faculty / mismatched major / out-of-range year / non-UP university).
- [ ] i18n additions (TH + EN).
- [ ] `Profile.jsx` edit modal: checkbox, faculty dropdown (18), dependent major dropdown (disabled until faculty), admission-year dropdown, reset-on-faculty-change, client validation, null-out on unchecked.
- [ ] `Profile.jsx` display block: reword year label.
- [ ] Verify: `npm run lint`, `npm run build`.
- [ ] Manual test pass with `npx wrangler pages dev dist --local` (apply migration locally first):
  - unchecked state hides fields and persists clear;
  - checked state shows fields;
  - 18 faculties listed;
  - major disabled before faculty;
  - majors match the selected faculty only;
  - faculty switch resets major;
  - admission year starts at 38 and is sequential;
  - a value above current year is not offered / rejected;
  - save → reload → values persist;
  - validation rejects impossible faculty/major and missing required fields;
  - responsive on mobile/desktop.

## Appendix A — Full Faculty → Major mapping (exact strings)

1. **คณะเกษตรศาสตร์และทรัพยากรธรรมชาติ** — สาขาวิชาเกษตรศาสตร์, สาขาวิชาเทคโนโลยีนวัตกรรมการประมง, สาขาวิชาความปลอดภัยทางอาหาร, สาขาวิชาวิทยาศาสตร์และเทคโนโลยีการอาหาร, สาขาวิชาสัตวศาสตร์, สาขาวิชาเทคโนโลยีการเกษตร
2. **คณะทันตแพทยศาสตร์** — หลักสูตรทันตแพทยศาสตรบัณฑิต
3. **คณะเทคโนโลยีสารสนเทศและการสื่อสาร** — สาขาวิชาคอมพิวเตอร์กราฟิกและมัลติมีเดีย, สาขาวิชาธุรกิจดิจิทัล, สาขาวิชาเทคโนโลยีสารสนเทศ, สาขาวิชาภูมิสารสนเทศศาสตร์, สาขาวิชาวิทยาการข้อมูลและการประยุกต์, สาขาวิชาวิทยาการคอมพิวเตอร์, สาขาวิชาวิศวกรรมคอมพิวเตอร์, สาขาวิชาวิศวกรรมซอฟต์แวร์
4. **คณะนิติศาสตร์** — หลักสูตรนิติศาสตรบัณฑิต
5. **คณะบริหารธุรกิจและนิเทศศาสตร์** — หลักสูตรเศรษฐศาสตรบัณฑิต, สาขาวิชาการจัดการการสื่อสาร, สาขาวิชาการสื่อสารสื่อใหม่, สาขาวิชาการเงินและการลงทุน, สาขาวิชาการจัดการธุรกิจ, สาขาวิชาการตลาดดิจิทัล, หลักสูตรบัญชีบัณฑิต, สาขาวิชาการท่องเที่ยวและการโรงแรม
6. **คณะพยาบาลศาสตร์** — หลักสูตรพยาบาลศาสตรบัณฑิต
7. **คณะพลังงานและสิ่งแวดล้อม** — สาขาวิศวกรรมสิ่งแวดล้อม, สาขาการจัดการพลังงานและสิ่งแวดล้อม
8. **คณะแพทยศาสตร์** — หลักสูตรแพทยศาสตรบัณฑิต, สาขาวิชาปฏิบัติการฉุกเฉินการแพทย์
9. **คณะเภสัชศาสตร์** — สาขาวิชาบริบาลทางเภสัชกรรม, สาขาวิชาวิทยาศาสตร์เครื่องสำอาง
10. **คณะรัฐศาสตร์และสังคมศาสตร์** — สาขาวิชาการจัดการนวัตกรรมสาธารณะ, หลักสูตรรัฐศาสตรบัณฑิต, สาขาวิชาพัฒนาสังคม
11. **คณะวิทยาศาสตร์** — สาขาวิชาเคมี, สาขาวิชาคณิตศาสตร์, สาขาวิชาชีววิทยา, สาขาวิชาฟิสิกส์, สาขาวิชาวิทยาศาสตร์การออกกำลังกายและการกีฬา, สาขาวิชาสถิติประยุกต์และการจัดการข้อมูล
12. **คณะวิศวกรรมศาสตร์** — สาขาวิชาวิศวกรรมเครื่องกล, สาขาวิชาวิศวกรรมโยธา, สาขาวิชาวิศวกรรมไฟฟ้า, สาขาวิชาวิศวกรรมอุตสาหการ
13. **คณะสถาปัตยกรรมศาสตร์และศิลปกรรมศาสตร์** — สาขาวิชาดนตรีและนาฏศิลป์, สาขาวิชาศิลปะและการออกแบบ, สาขาวิชาสถาปัตยกรรม, สาขาวิชาสถาปัตยกรรมภายใน
14. **คณะสหเวชศาสตร์** — สาขาวิชาเทคนิคการแพทย์, หลักสูตรกายภาพบำบัดบัณฑิต
15. **คณะสาธารณสุขศาสตร์** — หลักสูตรการแพทย์แผนไทยประยุกต์บัณฑิต, หลักสูตรการแพทย์แผนจีนบัณฑิต, สาขาวิชาการส่งเสริมสุขภาพ, สาขาวิชาอนามัยสิ่งแวดล้อม, สาขาวิชาอาชีวอนามัยและความปลอดภัย, สาขาวิชาอนามัยชุมชน
16. **คณะวิทยาศาสตร์การแพทย์** — สาขาวิชาโภชนาการและการกำหนดอาหาร, สาขาวิชาจุลชีววิทยา, สาขาวิชาชีวเคมี
17. **คณะศิลปศาสตร์** — สาขาวิชาภาษาไทย, สาขาวิชาภาษาจีน, สาขาวิชาภาษาญี่ปุ่น, สาขาวิชาภาษาฝรั่งเศส, สาขาวิชาภาษาอังกฤษ
18. **วิทยาลัยการศึกษา** — สาขาวิชาการศึกษา