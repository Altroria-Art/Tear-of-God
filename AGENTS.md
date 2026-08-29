# AGENTS.md

Social tier-list app. React 19 + Vite 8 (ESM, `.jsx`), Tailwind CSS 4 (`@tailwindcss/vite` plugin), React Router v7. Backend is hand-written serverless functions on Cloudflare Pages Functions (`functions/api/`), running on the Workers runtime (not Node.js — no `fs`, no raw TCP, no Node-only packages). Database is Cloudflare D1 (SQLite), accessed via the `env.tear_of_god_db` binding, no ORM. No tests/typecheck yet. Design source of truth: `SDS.md` (Thai; schema in §6, screen inventory in §7, open decisions in §9) — note SDS.md predates the move off Supabase and still needs a pass on §2 (architecture) and §6 (schema) to match `schema.sql`.

## Commands

- `npm run dev` — Vite dev server (UI only, mock data; `/api/*` calls will 404 or fall through to index.html)
- `npm run build` — production build
- `npm run lint` — oxlint only (config: `.oxlintrc.json`)
- `npm run preview` — serve built output
- `npx wrangler pages dev dist --local` — full stack: serves the build AND runs `functions/api/*` against local D1
- `npx wrangler d1 execute tear-of-god-db --local --file=./schema.sql` — (re)apply schema to local D1

There are no test or typecheck scripts; do not invent them.

## Backend (functions/api/)

Each file exports `onRequest` (or method-specific `onRequestGet`/`onRequestPost`) and receives `{ request, env }`. `env.tear_of_god_db` is the D1 binding (see `wrangler.toml`). Query with `db.prepare(sql).bind(...).all()` / `.first()` / `.run()`, never string-interpolate user input into SQL. `crypto.randomUUID()` and `crypto.subtle` are available as Workers globals — do not `import crypto from 'crypto'` (Node built-in, unavailable here). Node-only packages in `package.json` (`pg`, `jsonwebtoken`, `bcryptjs`, `dotenv`) do not run in this runtime; treat their presence as leftover cruft, not as available tools.

## Env

Auth for email/password lives in `functions/api/auth.js` against the `profiles` table in D1 — there is no Supabase client anywhere in `src/`. Google sign-in goes through Firebase Auth (`src/lib/firebase.js`, config currently hardcoded inline, not env-driven). `.env.example` still lists `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` from the old Supabase setup; nothing in the current code reads them — do not add new Supabase env usage, and flag this file for cleanup rather than treating it as the source of truth for required env vars.

## Conventions

- Components are default-exported with `.jsx` extension; import paths are extension-less (`./TierRow`).
- Pages in `src/pages/`, components grouped by area in `src/components/{feed,layout,ui}/`.
- Design tokens are custom Tailwind 4 theme colors defined in `src/index.css` (`@theme`): `bg-canvas`, `text-ink`, `bg-tier-s`, etc. These are not stock Tailwind colors — add new ones to `@theme`, don't inline hex.
- Tier labels are fixed at 5 (S/A/B/C/D) with fixed colors (S=red, A=orange, B=yellow, C=green, D=blue). Map them via `TIER_STYLES` in `src/lib/tiers.js` only — never hardcode tier colors/classes.
- Icons are hand-rolled inline SVGs in `src/components/ui/Icons.jsx` (inherit `currentColor`). No icon library; add new icons there.
- Mock data still lives in `src/data/mockFeed.js` and is used by `FeedProvider.jsx`; `HomeFeed.jsx` and `useRankings.js`, however, already call the real `functions/api/rankings` endpoint via `src/lib/api.js`. Don't assume the whole feed is mocked — check which component you're touching before adding more mock arrays.

## Repo state / gotchas

- Feature work happens on branches merged via PRs (`Create`, `Feed`, `Main_Page`, `Profile.v2`, `backend`, `create.v2`, `discover`, `docker`, `home.v1/longin.v1`, `intemplate`, `profile/create`, `template`), not directly on `main`.
