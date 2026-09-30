# Synthetic Data Cleanup

This document outlines the procedure to remove synthetic seed/demo data from the production Cloudflare D1 database.
The data comes from deterministic generation scripts like `scripts/gen-community-seed.mjs` and `scripts/prepare-demo-templates.mjs`.

## Known Synthetic Namespaces
- **Profiles**: `user_###`, `curator_###`, `community_###`, `filler_####`
- **Rankings**: `rank_###`, `rk_###_##`
- **Templates**: `tmpl_###`, `demo-up-ui-20260920-*`
- **Child Records**: Generated child records like `template_items`, `votes`, `comments` automatically cascade on delete. Unused `items` are cleaned up via an orphan check.

## Usage

A maintenance script is provided at `scripts/cleanup-synthetic-production.mjs`.

### Dry-run (Default)
By default, the script executes read-only queries to show the exact counts that would be deleted.
```bash
node scripts/cleanup-synthetic-production.mjs --remote
```

### Apply (Destructive)
1. **Take a backup** before applying:
   ```bash
   npx wrangler d1 export tear-of-god-db --remote --output=.d1-backups/prod-before-cleanup.sql
   ```
2. **Execute deletion**:
   ```bash
   node scripts/cleanup-synthetic-production.mjs --remote --apply
   ```

### Verification
After cleanup, you can run the dry-run command again. The synthetic counts should be 0.
Additionally, you should visit the live site (`/discover`, `/api/discover-pulse?window=now`) to verify normal operation.

## Rollback Procedure
If the cleanup mistakenly deleted real user data, you can restore from the backup taken before the cleanup.
1. Run `npx wrangler d1 execute tear-of-god-db --remote --file=.d1-backups/prod-before-cleanup.sql`
*(Note: Restoring a full SQL dump requires caution and may overwrite new user data created after the backup).*
