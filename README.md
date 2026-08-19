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

Frontend only (UI work with mock data; live API calls will fail):
```
npm run dev
```

Full stack (frontend + API + D1), first time setup:
```
npx wrangler d1 execute tear-of-god-db --local --file=./schema.sql
npx wrangler d1 execute tear-of-god-db --local --file=./seed.sql   # optional sample data
npm run build
npx wrangler pages dev dist --local
```

## Database

Schema in `schema.sql`: profiles, rankings, items, ranking_items, votes, comments.
D1 binding (`tear_of_god_db`) is defined in `wrangler.toml`.

## Known gaps

- R2 image upload/storage not implemented yet
- `Dockerfile` / `docker-compose.yml` currently build the static frontend only; `functions/api` does not run in that container
