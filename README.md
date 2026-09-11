# Tear of God

**Tear of God** is a social platform for creating, sharing, and debating tier lists. Think of it as a community-driven ranking tool — users pick a template (a set of items to rank), drag items into custom tiers (S/A/B/C/D or any labels they choose), and publish their rankings. Others can vote, comment, and follow creators. Each template also has a **Community Average** that aggregates every published ranking into a single consensus view. The app is built for University of Phayao students, with built-in faculty/major data, and supports both English and Thai interfaces.

## Features

- Create and share tier lists from community templates
- Drag-and-drop tier list editor with auto-scroll and in-tier reorder
- Community Average — aggregated rankings per template with time-period filtering
- Home feed with General/Kindred personalized tabs
- Discover section — trending templates, categories, hashtags
- Like/dislike voting on posts and Community Average
- Comments on posts and Community Average
- Follow other users
- User profiles with University of Phayao faculty/major info
- Admin panel — dashboard, user/ranking/template/report management
- Share and export tier lists as PNG
- Dark/light theme toggle
- Internationalization (English + Thai)
- Report inappropriate content
- Email/password + Google Sign-In authentication

## Stack

- Frontend: React 19 + Vite 8, Tailwind CSS 4, React Router v7, i18next (EN/TH), lucide-react icons
- Backend: Cloudflare Pages Functions (`functions/api/`) — Workers runtime, hand-written SQL, no ORM
- Database: Cloudflare D1 (SQLite), binding `tear_of_god_db`
- Storage: Cloudflare R2 (avatar/image uploads, binding `STORAGE`)
- Auth: email/password (salted PBKDF2 in D1) + Google Sign-In (Firebase token verified server-side); HttpOnly cookie sessions

## Project Structure

```
├── functions/api/       Cloudflare Pages Functions (backend endpoints + admin/)
├── src/
│   ├── pages/           Page components (14 user pages + 5 admin pages)
│   ├── components/      Reusable UI (admin/, discover/, feed/, layout/, post/, template/, tier/, ui/)
│   ├── lib/             Core utilities (api client, auth, format, tiers, colors, university, share, export)
│   ├── context/         React contexts (UserContext, ThemeContext)
│   ├── locales/         i18n translations (en.json, th.json)
│   └── data/            Legacy mock data (largely unused)
├── schema.sql           Full database schema (14 tables)
├── migrations/          D1 migration files
├── scripts/             Utility scripts (score backfill, seed generation, k6 reports)
├── tests/               k6 load test scenarios and reports
└── docs/                Internal planning documents
```

## Setup

```
npm install
```

Frontend only (UI work, no backend — `/api/*` calls will 404 and pages render empty states):
```
npm run dev
```

Full stack (frontend + API + D1), first time setup:
```
npm run db:reset      # create local D1 schema
npm run dev:full       # build + wrangler pages dev dist
```

## Database

Schema in `schema.sql`: profiles, follows, rankings, items, ranking_items, votes, comments, templates, template_views, template_items, ranking_item_scores, template_reactions, template_comments, reports.
D1 binding (`tear_of_god_db`) is defined in `wrangler.toml`.

**Local D1 and production D1 are two entirely separate databases.** `wrangler pages dev` runs against a local SQLite file under `.wrangler/state/` (gitignored), never against the real database at `tear-of-god.pages.dev`. Nothing you do locally can affect production data, and nothing you do in production ever shows up locally on its own.

| Script | What it does |
|---|---|
| `npm run db:reset` | Wipe local D1, apply `schema.sql` |
| `npm run db:sync` | Export the **real** production D1 (read-only) and load that snapshot into local D1, replacing whatever was there |
| `npm run db:clean` | Just wipe local D1 state |

If your local site looks out of date, that's not a cache problem — run `npm run db:sync` to pull down a fresh copy of production data. Requires `npx wrangler login` once.

`npm run db:sync` writes a `.d1-snapshot.sql` file containing real user emails and password hashes — it's gitignored; never commit or share it.

## API Endpoints

All endpoints live under `functions/api/`. Each file exports `onRequest` (or method-specific `onRequestGet`/`onRequestPost`) and receives `{ request, env }`.

### Public

| Endpoint | Methods | Purpose |
|----------|---------|---------|
| `/api/auth` | POST | Register, login, Google sync, update profile |
| `/api/rankings` | GET, POST | List/feed rankings (pagination, filtering, sorting), create ranking |
| `/api/templates` | GET, POST | List templates, create template, record views |
| `/api/users` | GET | Public user profile |
| `/api/follows` | GET, POST | Followers/following, follow/unfollow |
| `/api/votes` | POST | Like/dislike ranking |
| `/api/comments` | GET, POST | Comments on rankings |
| `/api/template-votes` | GET, POST | Like/dislike Community Average |
| `/api/template-comments` | GET, POST | Comments on Community Average |
| `/api/template-participants` | GET | Users who created rankings from a template |
| `/api/hashtags` | GET | Aggregated hashtags from templates + rankings |
| `/api/categories` | GET | Top categories |
| `/api/upload` | POST | Image upload to R2 (JPEG/PNG/WebP/GIF, max 5MB) |
| `/api/report` | POST | Report template or ranking for inappropriate content |

### Admin

| Endpoint | Methods | Purpose |
|----------|---------|---------|
| `/api/admin` | GET | Dashboard stats |
| `/api/admin/users` | GET, POST | User management (search, set role, delete) |
| `/api/admin/rankings` | GET, POST | Ranking management (search, delete) |
| `/api/admin/templates` | GET, POST | Template management (search, delete) |
| `/api/admin/reports` | GET, POST | Report management (filter, resolve/dismiss/delete) |

## Deploying

Deploys are manual — there is no CI and pushing to a branch does not auto-deploy.

```
npm run deploy      # build + wrangler pages deploy dist --branch=master
```

This ships `functions/api/*` and the built frontend to https://tear-of-god.pages.dev/. Requires `npx wrangler login` once per machine.

**Production D1 has real registered users and their real tier lists — never destroy that data.** Before any schema change, verify against remote first:

```
npx wrangler d1 execute tear-of-god-db --remote --command "SELECT (SELECT COUNT(*) FROM profiles) profiles, (SELECT COUNT(*) FROM rankings) rankings"
```

## Load Testing

k6 test scenarios in `tests/scenarios/` (smoke, load, stress, spike, soak). Run against a running local or remote instance:

```
k6 run tests/scenarios/smoke.js
```

HTML reports in `tests/reports/`. Helper script `scripts/generate-k6-summary.mjs` produces summary reports from raw k6 JSON output.

## Architecture Notes

- **Auth model** — `/api/_middleware.js` verifies a 7-day HttpOnly cookie against hashed sessions in D1. Mutations use the session owner, and admin endpoints verify the current database role. Legacy SHA-256 passwords upgrade to PBKDF2 on successful login. Firebase public config is shared in `src/lib/firebaseConfig.js`; Google tokens are verified by Firebase on the server. Apply migrations `0012` and `0013` before deploying this version; see [session and UI rollout notes](docs/session-and-ui-improvements.md).
- **Home feed** — Seeded-shuffled (FNV-1a hash + mulberry32 PRNG + Fisher-Yates) for deterministic-random ordering stable within a session. "General" tab shows all posts; "Kindred" tab shows personalized content (requires 2+ matching signals from category, template, or hashtags).
- **Community Average** — Aggregated tier rankings per template, computed from frozen `ranking_item_scores` (score = tier position at time of publish). Supports time-period filtering. Includes self-healing backfill if scores are missing for older rankings.
- **Timestamps** — D1 returns `created_at`/`updated_at` as `"YYYY-MM-DD HH:MM:SS"` in UTC with no timezone marker. Always parse through `parseDbDate()` / `formatDbDate()` in `src/lib/format.js` — never pass raw D1 timestamps to `new Date()`.
- **Theme** — Dark/light toggle persisted to `localStorage`, respects system preference on first visit.

## Known Gaps

- Password recovery by email is not implemented.
- k6 mutation scenarios that only send `user_id` now need authenticated cookie sessions.
- No formal test suite (only k6 load tests for the API)
- No CI/CD pipeline — deploys are manual via `npm run deploy`
