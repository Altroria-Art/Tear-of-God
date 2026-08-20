# Tear of God

Social tier-list app: create rankings, vote, and comment on other users' tier lists.

## Stack

- Frontend: React 19 + Vite, Tailwind CSS 4, React Router v7
- Backend: Cloudflare Pages Functions (`functions/api/`) + Cloudflare D1 (SQLite)
- Auth: email/password (stored in D1) + Google Sign-In via Firebase Auth
- Storage: Cloudflare R2 (planned, not wired up yet; images are currently plain URLs)

## Setup

```
npm install
```

Frontend only (UI work, no backend — `/api/*` calls will 404 and pages render empty states, they do NOT fall back to mock data):
```
npm run dev
```

Full stack (frontend + API + D1), first time setup:
```
npm run db:reset      # create local D1 schema + load fake sample data
npm run dev:full       # build + wrangler pages dev dist
```

## Database

Schema in `schema.sql`: profiles, rankings, items, ranking_items, votes, comments, templates, template_items.
D1 binding (`tear_of_god_db`) is defined in `wrangler.toml`.

**Local D1 and production D1 are two entirely separate databases.** `wrangler pages dev` runs against a local SQLite file under `.wrangler/state/` (gitignored), never against the real database at `tear-of-god.pages.dev`. Nothing you do locally can affect production data, and nothing you do in production ever shows up locally on its own.

| Script | What it does |
|---|---|
| `npm run db:reset` | Wipe local D1, apply `schema.sql`, load `seed.sql` (fake demo data) |
| `npm run db:sync` | Export the **real** production D1 (read-only) and load that snapshot into local D1, replacing whatever was there |
| `npm run db:clean` | Just wipe local D1 state |

If your local site looks out of date or shows old/fake profiles, that's not a cache problem — run `npm run db:sync` to pull down a fresh copy of production data. Requires `npx wrangler login` once.

`npm run db:sync` writes a `.d1-snapshot.sql` file containing real user emails and password hashes — it's gitignored; never commit or share it.

## Known gaps

- R2 image upload/storage not implemented yet
- `Dockerfile` / `docker-compose.yml` currently build the static frontend only; `functions/api` does not run in that container
