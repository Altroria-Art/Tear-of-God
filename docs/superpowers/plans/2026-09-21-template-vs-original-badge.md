# Template vs. Original Badge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display clear visual badges on tier list cards in the user profile page and in the post detail view indicating whether a tier list was originally created by the user ("สร้างเอง") or ranked using an existing template ("ใช้เทมเพลต").

**Architecture:** Extend backend `functions/api/rankings.js` template queries (both single and batch) to include `creator_id` and `title` without adding extra D1 queries, returning `is_original` and `template_title`. Update `Profile.jsx` (`MiniTierTile`) and `PostDetail.jsx` with responsive badge UI and tooltips, backed by `th.json` and `en.json` locale strings.

**Tech Stack:** Cloudflare Pages Functions (D1 / SQLite), React 19, Tailwind CSS 4, react-i18next.

---

### Task 1: Locales & Translations

**Files:**
- Modify: `src/locales/th.json`
- Modify: `src/locales/en.json`

- [ ] **Step 1: Add translation keys in `th.json` and `en.json`**
  - Add `badgeOriginal`: "สร้างเอง" / "Original"
  - Add `badgeTemplate`: "ใช้เทมเพลต" / "From Template"
  - Add `usedTemplateTooltip`: "สร้างจากเทมเพลต: {{title}}" / "Created from template: {{title}}"

- [ ] **Step 2: Commit translation changes**
  - Run `git commit -m "i18n: add badge translations for original vs template"`

---

### Task 2: Backend Template Metadata in `functions/api/rankings.js`

**Files:**
- Modify: `functions/api/rankings.js:150-185` (single ranking fetch)
- Modify: `functions/api/rankings.js:655-745` (batch ranking fetch)

- [ ] **Step 1: Update single ranking query in `functions/api/rankings.js`**
  - Query `id, creator_id, title, tiers FROM templates WHERE id = ?` instead of just `tiers`.
  - Calculate `is_original = !ranking.template_id || (tpl && tpl.creator_id === ranking.user_id)`.
  - Attach `is_original` and `template_title = tpl?.title || null` to the response.

- [ ] **Step 2: Update batch ranking query in `functions/api/rankings.js`**
  - Query `id, creator_id, title, tiers FROM templates WHERE id IN (...)`.
  - Store `creator_id` and `title` in `templateById` map.
  - In `formattedRankings = rankings.map(...)`, compute `is_original = !r.template_id || (tpl && tpl.creator_id === r.user_id)`.
  - Attach `is_original` and `template_title = tpl?.title || null` to each item.

- [ ] **Step 3: Verify backend changes**
  - Run `npm run lint`

- [ ] **Step 4: Commit backend changes**
  - Run `git commit -m "feat(api): include is_original and template_title in rankings response"`

---

### Task 3: Profile Cards Badge in `src/pages/Profile.jsx`

**Files:**
- Modify: `src/pages/Profile.jsx:55-80` (`MiniTierTile`)

- [ ] **Step 1: Render the badge in `MiniTierTile`**
  - Inside the top-left overlay container (`absolute top-2 left-2 z-10 flex items-center gap-1 max-w-[calc(100%-3rem)] flex-wrap`):
    - If `post.is_original`: render badge with `bg-surface/90 text-ink border-line-soft font-bold text-[9px]` displaying `t('profile.badgeOriginal')`.
    - If `!post.is_original`: render badge with `bg-highlight/15 text-highlight border-highlight/40 font-bold text-[9px]` displaying `t('profile.badgeTemplate')`, with `title={t('profile.usedTemplateTooltip', { title: post.template_title || post.title })}`.

- [ ] **Step 2: Verify lint and build**
  - Run `npm run lint` and `npm run build`

- [ ] **Step 3: Commit profile changes**
  - Run `git commit -m "feat(profile): display template vs original badge on tier list cards"`

---

### Task 4: Post Detail Page Badge in `src/pages/PostDetail.jsx`

**Files:**
- Modify: `src/pages/PostDetail.jsx:400-430`

- [ ] **Step 1: Render the badge in `PostDetail.jsx`**
  - Next to post title or above hashtags, display the corresponding badge with link to template if `!is_original` and `post.templateId`.

- [ ] **Step 2: Verify lint and build**
  - Run `npm run lint` and `npm run build`

- [ ] **Step 3: Commit PostDetail changes**
  - Run `git commit -m "feat(post): display original vs template badge on post detail"`
