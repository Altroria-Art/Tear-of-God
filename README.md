# Tear of God

**Tear of God** is a social platform for creating, sharing, and debating tier lists. Think of it as a community-driven ranking tool — users pick a template (a set of items to rank), drag items into custom tiers (S/A/B/C/D or any labels they choose), and publish their rankings. Others can vote, comment, and follow creators. Each template also has a **Community Average** that aggregates every published ranking into a single consensus view. The app is built for University of Phayao students, with built-in faculty/major data, and supports both English and Thai interfaces.

## Features

- Create and share tier lists from community templates
- Guest-first Create flow — start ranking immediately with Quick Add, then add metadata at publish; optional pairwise mode turns head-to-head choices into tiers automatically
- Challenge friends to rank the same template, compare taste, and share an exportable result card
- Drag-and-drop tier list editor with auto-scroll and in-tier reorder
- Community Average — aggregated rankings per template with time-period filtering
- Home feed with Trending, For You, and Following tabs
- Following Activity Feed — see followed users' new rankings, likes, and template participation
- Follow topics — follow hashtags, categories, and templates to tune the For You feed
- Daily Pick and Weekly Debate prompts that refresh on Bangkok calendar cycles
- Live today feed hub — Hot in 24 hours, Just ranked, Under debate, and Divided opinions
- Discover section — trending templates, categories, hashtags
- Like/dislike voting on posts and Community Average
- Comments on posts and Community Average
- Follow other users
- In-app notifications for replies, template usage, followed creators/topics' new rankings, trending posts, Community Average changes, daily like digests, and completed challenges
- Rich social link previews for posts, templates, Community Average, and challenges; downloadable share cards in landscape, square, and story formats with QR/CTA
- First-party product funnel and returning-user analytics in the admin dashboard
- User profiles with University of Phayao faculty/major info, Taste Identity (hashtag distribution, favorite S-tier items, badges, similar users), and up to three pinned rankings
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

Classification now uses `hashtags` only. `rankings` and `templates` no longer
have a `category` column in the fresh schema. Existing databases need the staged
[hashtags-only migration](docs/hashtags-only-migration.md): apply 0009, deploy the
new app, then apply 0010. Do not apply 0010 while the old app is still running.

Schema in `schema.sql`: profiles, follows, topic_follows, rankings, items, ranking_items, votes, comments, templates, template_views, template_items, ranking_item_scores, profile_pins, template_reactions, template_comments, reports.
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
| `/api/auth` | GET, POST | Restore session; register, login, logout, forgot/reset password, Google sync, update profile |
| `/api/rankings` | GET, POST | List/feed rankings (pagination, filtering, sorting), create ranking |
| `/api/templates` | GET, POST | List/read templates and record a deduplicated authenticated view |
| `/api/users` | GET | Public user profile + Taste Identity summary |
| `/api/profile-pins` | POST | Pin/unpin one of the current user's rankings (maximum 3) |
| `/api/follows` | GET, POST | Followers/following, follow/unfollow |
| `/api/topic-follows` | GET, POST | Follow/unfollow hashtags, categories, and templates; read follower counts |
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

Deploys are manual — there is no CI and pushing to a branch does not auto-deploy. The `tear-of-god` Cloudflare Pages project uses Direct Upload, with `master` as its Pages Production branch label; `main` and other labels create Preview deployments. Wrangler's `--branch` option selects the Pages deployment environment by label — it does not check out or otherwise select a local Git branch. The deploy script therefore intentionally uses `--branch=master`.

**Production D1 has real registered users and their real tier lists — never destroy that data.** Before any schema change, verify against remote first:

```
npx wrangler d1 execute tear-of-god-db --remote --command "SELECT (SELECT COUNT(*) FROM profiles) profiles, (SELECT COUNT(*) FROM rankings) rankings"
```

## Load Testing

k6 test scenarios live in `tests/scenarios/` (smoke, load, stress, spike, soak). Mutation traffic is disabled by default, so ordinary runs are read-only:

```
k6 run tests/scenarios/smoke.js
```

Mutation traffic requires an explicit opt-in and is accepted only for a loopback URL. Production, Pages branch aliases, and all other remote hosts fail closed. When enabled, exported k6 `setup()` creates a small pool of run-isolated local accounts through `/api/auth`, logs them in, verifies session restore, and supplies the server-issued `tog_session` cookie to mutation requests. Mutation payloads do not send an authorization `user_id`:

```
k6 run -e BASE_URL=http://localhost:8788 -e ALLOW_MUTATIONS=true tests/scenarios/load.js
```

HTML reports in `tests/reports/`. Helper script `scripts/generate-k6-summary.mjs` produces summary reports from raw k6 JSON output.

Local auth and k6 safety regressions run without a production connection:

```
node tests/local/auth-regression.mjs
node tests/local/k6-auth-safety.mjs
```

## Architecture Notes

- **Auth model** — `/api/_middleware.js` verifies a 7-day HttpOnly cookie against hashed sessions in D1. Mutations use the session owner, and admin endpoints verify the current database role. New passwords use salted PBKDF2-SHA-256; legacy unsalted SHA-256 hashes upgrade on successful login. Forgot/reset password uses one-hour, single-use hashed tokens and Brevo for transactional email when configured; a successful reset revokes old sessions. Firebase public config is shared in `src/lib/firebaseConfig.js`; Google tokens are verified by Firebase on the server. Production D1 schema state must be verified separately before deployment.
- **Ranking publish integrity** — Creating a new template with its first ranking, or publishing from an existing template, submits all template/ranking/item/score/counter writes in one D1 transaction through a single `db.batch()` call.
- **Pages SPA routing** — Static deep links rely on Cloudflare Pages' SPA fallback when no top-level `404.html` exists. `/api/*` remains handled by Pages Functions, and static assets are served directly; no catch-all `_redirects` rule is required.
- **Home feed** — "Trending" ranks posts by freshness and engagement; "For You" uses template, hashtag, and explicit topic-follow signals (a followed topic can surface a matching post on its own) with a session-stable seeded mix; "Following" shows the newest posts from followed accounts. Guests can scroll Trending, while every feed interaction opens a login/sign-up prompt and all non-auth deep links redirect through login with a safe return path.
- **Community Average** — Aggregated tier rankings per template, computed from frozen `ranking_item_scores` (score = tier position at time of publish). Supports time-period filtering. Includes self-healing backfill if scores are missing for older rankings.
- **Timestamps** — D1 returns `created_at`/`updated_at` as `"YYYY-MM-DD HH:MM:SS"` in UTC with no timezone marker. Always parse through `parseDbDate()` / `formatDbDate()` in `src/lib/format.js` — never pass raw D1 timestamps to `new Date()`.
- **Theme** — Dark/light toggle persisted to `localStorage`, respects system preference on first visit.

## Known Gaps

- There is no unified test-runner script or CI/CD pipeline; local regression scripts under `tests/local/` are run individually and deploys remain manual.
- k6 mutation runs intentionally leave their isolated accounts and votes in local D1 until the local database is reset.
