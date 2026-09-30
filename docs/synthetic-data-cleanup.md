# Synthetic Data Cleanup

This document outlines the procedure to remove synthetic seed/demo data from the production Cloudflare D1 database.
The data comes from deterministic generation scripts like `scripts/gen-community-seed.mjs` and `scripts/prepare-demo-templates.mjs`.

## Known Synthetic Namespaces
- **Profiles**: `user_###`, `curator_###`, `community_###`, `filler_####`
- **Rankings**: `rank_###`, `rk_###_##`
- **Templates**: `tmpl_###`, `demo-up-ui-20260920-*`
- **Child Records**: Generated child records like `template_items`, `votes`, `comments` are tied to these parents.

## Safe Maintenance Workflow

**WARNING:** Cloudflare D1 cascading deletes (`ON DELETE CASCADE`) are not completely reliable in all batch execution contexts. Generic `DELETE` statements based on patterns can silently orphan records, lose unconstrained dependent rows, or violate foreign keys. Therefore, **all cleanup must follow this explicit safe workflow**:

1. **Audit**: Run the safe, read-only audit tool to identify synthetic data counts and cross-contaminations:
   ```bash
   node scripts/cleanup-synthetic-production.mjs --remote
   ```
2. **Production Backup**: Take a complete SQL snapshot before any mutations.
   ```bash
   npx wrangler d1 export tear-of-god-db --remote --output=.d1-backups/prod-before-cleanup.sql
   ```
3. **Dependency Review**: Review the audit report for "adopted content" (synthetic content that real users have interacted with) and "bot-dependent interactions" (real users interacting with bots).
4. **Explicit Reviewed Cleanup SQL**: Do not use generic cleanup scripts. Write a specific, targeted `.sql` file that safely deletes the required rows while explicitly `NULL`ing or protecting adopted content.
5. **Execution**: Run the explicit SQL script against production (`npx wrangler d1 execute ...`).
6. **PRAGMA foreign_key_check**: Immediately verify database integrity.
   ```bash
   npx wrangler d1 execute tear-of-god-db --remote --command="PRAGMA foreign_key_check;"
   ```
7. **Logical Orphan Checks**: Run queries to ensure no child records (e.g. `template_views`, `ranking_items`) are orphaned from deleted parents.
8. **API Smoke Tests**: Verify critical endpoints (e.g., `/`, `/discover`, `/api/discover-pulse`) to ensure no `500` errors resulting from nullified IDs.

## September 30 Cleanup Post-Mortem

A major cleanup operation was executed on Sept 30, 2026, targeting ~24,000 synthetic rows. Following strict forensic verification, the operation ended with:
- **Zero unexplained real-user data loss**. Every real user account, real ranking, and real comment was successfully protected.
- **Adopted Templates**: 13 synthetic templates were successfully preserved (and their `creator_id` set to `NULL`) because real users had built rankings upon them.
- **One follow intentionally retired**: A real user's follow to `community_028` was retired because the target profile was synthetic.
- **One duel intentionally retired**: A real user's duel against `curator_004` was retired because the opponent profile was synthetic.

These retired interactions are considered acceptable cleanup outcomes, distinct from accidental data loss.
