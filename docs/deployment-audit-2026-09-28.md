# Audit fixes deployment — 28 September 2026

- User explicitly requested deployment to Cloudflare.
- Production: https://tear-of-god.pages.dev
- Deployment: https://5ab80282.tear-of-god.pages.dev
- Pages project: `tear-of-god`; production branch: `master`.
- Deployed the working tree from `codex/project-audit-fixes` with `--commit-dirty=true`; this includes the uncommitted fixes described in `project-audit-2026-09-28.md`. No Git push or commit was performed.
- Production build and Functions compilation succeeded; 58 assets uploaded and 17 reused.
- Read-only checks confirmed both production and deployment URLs serve the current build's JS asset. `/api/auth`, template list, ranking list and hashtag list returned HTTP 200 with successful JSON. Guest `/api/admin/users` returned HTTP 401.
- No database migration or production test-content mutation was performed. Live Google OAuth, email delivery and authenticated user mutation flows remain outside these deployment smoke checks.
- Previous production deployment for rollback: `9cdeb7b9-3ee3-4c81-a495-df4bb0f21f50` at https://9cdeb7b9.tear-of-god.pages.dev.
- Local deployment log: `.wrangler/audit-logs/deploy.log`; smoke-check script: `.wrangler/audit-logs/verify-deployment.mjs`.
