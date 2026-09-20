# Spec: Template vs. Original Badge (สร้างเอง / ใช้เทมเพลต)

**Date**: 2026-09-21  
**Status**: Validated Design (Ready for Review)  
**Target Areas**: Cloudflare Pages Functions (`functions/api/rankings.js`), Frontend Profile (`src/pages/Profile.jsx`), Post Detail (`src/pages/PostDetail.jsx`), Locales (`th.json`, `en.json`)

---

## 1. Objective & Problem Statement
On user profile cards ("All Tier Lists" grid) and Post Detail view, users cannot easily distinguish whether a tier list is an **original creation** (created from scratch with user's own items/tiers via `/create`) or **used a template** (ranked using a template created by someone else via `/rank?template=...`).

The objective is to display clear badges on tier list cards in the profile page and on the post detail page:
- **"สร้างเอง" (Original)**: Created by the author directly.
- **"ใช้เทมเพลต" (Use Template)**: Ranked based on a template, accompanied by a tooltip showing the original template's title if available.

---

## 2. Business Logic & Data Definition

A ranking $R$ is defined as:
1. **Original Creation (`is_original = true`)**:
   - $R$ has no `template_id` (`template_id IS NULL`), OR
   - The associated template $T$ has `T.creator_id === R.user_id` (the author of the ranking is the creator of the template).
2. **From Template (`is_original = false`)**:
   - $R$ has a `template_id` AND the template's creator is someone else (`T.creator_id !== R.user_id`), OR the template has no creator (`T.creator_id IS NULL`, e.g., system/seed templates).
   - $R$ also carries `template_title = T.title` for UI tooltips and display.

---

## 3. Backend Implementation (`functions/api/rankings.js`)

### 3.1 Batch Rankings Query (`onRequestGet` for feeds / author profile)
- Current query for templates in line 657:
  ```sql
  SELECT id, tiers FROM templates WHERE id IN (...)
  ```
- Enhanced query (0 additional D1 queries, 0 additional D1 reads beyond columns):
  ```sql
  SELECT id, creator_id, title, tiers FROM templates WHERE id IN (...)
  ```
- When formatting the response list (`formattedRankings`):
  ```javascript
  const tpl = templateMap[r.template_id];
  const isOriginal = !r.template_id || (tpl && tpl.creator_id === r.user_id);
  const templateTitle = tpl?.title || null;
  ```
- Fields added to each ranking object:
  - `is_original: boolean`
  - `template_title: string | null`

### 3.2 Single Ranking Query (`onRequestGet` with `id`)
- Current template lookup in line 152:
  ```sql
  SELECT tiers FROM templates WHERE id = ?
  ```
- Enhanced query:
  ```sql
  SELECT id, creator_id, title, tiers FROM templates WHERE id = ?
  ```
- Response fields added:
  - `is_original: boolean`
  - `template_title: string | null`

---

## 4. Frontend Implementation

### 4.1 Profile Page (`src/pages/Profile.jsx` - `MiniTierTile`)
- In the top-left thumbnail metadata overlay (`absolute top-2 left-2 z-10 flex items-center gap-1 max-w-[calc(100%-3rem)] flex-wrap`):
  - Retain the `Pinned` tag if pinned.
  - Render the badge:
    - **Original (`is_original === true`)**:
      - Class: `text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border border-brand/30 bg-surface/90 text-ink shadow-2xs backdrop-blur-xs`
      - Label: `t('profile.badgeOriginal')` ("สร้างเอง" / "Original")
    - **From Template (`is_original === false`)**:
      - Class: `text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border border-highlight/40 bg-highlight/15 text-highlight shadow-2xs backdrop-blur-xs`
      - Label: `t('profile.badgeTemplate')` ("ใช้เทมเพลต" / "From Template")
      - Tooltip (`title` attribute): `t('profile.usedTemplateTooltip', { title: post.template_title })`
  - Render hashtags alongside badge if present.

### 4.2 Post Detail Page (`src/pages/PostDetail.jsx`)
- Above or next to the title / hashtags:
  - Render badge with matching styling:
    - If `is_original`: Badge "สร้างเอง" (Original).
    - If from template: Badge "ใช้เทมเพลต" (From Template) with link or tooltip to the template `/template/:id`.

### 4.3 Internationalization (`locales/th.json` & `locales/en.json`)
- Add translation keys:
  - `profile.badgeOriginal`: "สร้างเอง" / "Original"
  - `profile.badgeTemplate`: "ใช้เทมเพลต" / "From Template"
  - `profile.usedTemplateTooltip`: "สร้างจากเทมเพลต: {{title}}" / "Created from template: {{title}}"

---

## 5. Non-Functional Constraints & Verification
1. **Performance**: Zero additional D1 reads. Reuses existing `SELECT ... FROM templates` query in `functions/api/rankings.js`.
2. **Backward Compatibility**: Any ranking without template data gracefully falls back to `is_original: true`.
3. **Verification**:
   - `npm run lint` passes without errors.
   - `npm run build` succeeds.
