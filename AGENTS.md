# AGENTS.md

Social tier-list app. React 19 + Vite 8 (ESM, `.jsx`), Tailwind CSS 4 (`@tailwindcss/vite` plugin), React Router v7, Supabase BaaS. No custom backend and no tests/typecheck — security lives in Supabase RLS. Design source of truth: `SDS.md` (Thai; schema in §6, screen inventory in §7, open decisions in §9).

## Commands

- `npm run dev` — Vite dev server
- `npm run build` — production build
- `npm run lint` — oxlint only (config: `.oxlintrc.json`)
- `npm run preview` — serve built output

There are no test or typecheck scripts; do not invent them.

## Env

`src/lib/supabaseClient.js` throws if `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are missing. Copy `.env.example` → `.env` (Supabase Settings > API). `.env` is gitignored; never commit it or real keys. The throw fires only on import — nothing imports it yet.

## Conventions

- Components are default-exported with `.jsx` extension; import paths are extension-less (`./TierRow`).
- Pages in `src/pages/`, components grouped by area in `src/components/{feed,layout,ui}/`.
- Design tokens are custom Tailwind 4 theme colors defined in `src/index.css` (`@theme`): `bg-canvas`, `text-ink`, `bg-tier-s`, etc. These are not stock Tailwind colors — add new ones to `@theme`, don't inline hex.
- Tier labels are fixed at 5 (S/A/B/C/D) with fixed colors (S=red, A=orange, B=yellow, C=green, D=blue). Map them via `TIER_STYLES` in `src/lib/tiers.js` only — never hardcode tier colors/classes.
- Icons are hand-rolled inline SVGs in `src/components/ui/Icons.jsx` (inherit `currentColor`). No icon library; add new icons there.
- Mock data lives in `src/data/mockFeed.js`; its `post` shape mirrors a future `rankings` row join and local page-level mock arrays exist until the DB schema lands. Work is display-only right now.

## Repo state / gotchas

- `index.html` `<title>` is still the stale `vite-tmp`.
- Auth, DB schema, and most routes don't exist yet (only `/` HomeFeed and `/discover`). `Discover.jsx` is currently untracked/new.
- Feature work happens on branches merged via PRs (e.g. `Main_Page`, `home.v1/longin.v1`), not directly on `main`.
