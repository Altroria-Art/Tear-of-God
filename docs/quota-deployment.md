# Quota changes: deployment steps

Executed deployment: see [checkpoint](deployment-quota-2026-09-21.md). The database export step below was blocked by automatic approval review and was not performed; additive indexes and application deployment completed successfully.

Run PowerShell from `D:\GitHub\Tear-of-God`. Stop after any failed command. These instructions deploy all current quota changes, including the prior pass.

1. Verify locally:

```powershell
npm run lint
npm run build
node tests/local/quota-optimization.mjs
node tests/local/quota-item-reactions.mjs
node tests/local/quota-hot-paths.mjs
npx wrangler pages functions build functions --outdir .wrangler/quota-functions --output-routes-path .wrangler/quota-routes.json
```

2. Inspect production and back it up. The dedicated config pins D1 UUID `69d366f1-55ba-43cf-a492-882e137786f4` and discovers ONLY `0011_quota_indexes.sql`. Do not use the local-only Phase 3D config or apply all migrations. The last production checkpoint has pending `0010_drop_category.sql`; that migration is unrelated and must remain excluded.

```powershell
npx wrangler d1 migrations list tear-of-god-db --remote --config wrangler.quota.toml
npx wrangler d1 execute tear-of-god-db --remote --config wrangler.quota.toml --command "SELECT name, sql FROM sqlite_master WHERE name IN ('analytics_events','items','idx_analytics_created','idx_items_name');"
$quotaBackup = '.wrangler/quota-before-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.sql'
npx wrangler d1 export tear-of-god-db --remote --config wrangler.quota.toml --output $quotaBackup
```

Confirm the pending list contains only `0011_quota_indexes.sql`, and both tables exist with the expected `created_at`/`name` columns. If `0011` is already recorded but either index is missing, stop and reconcile the ledger; do not edit an applied migration or deploy based on that mismatch. Backup stays in ignored `.wrangler` because it contains private data.

3. **Apply `0011_quota_indexes.sql` BEFORE deploying the application.** Both indexes are additive and compatible with the currently deployed code. Confirm Wrangler's interactive prompt. No maintenance mode is required for these additive indexes. Index creation consumes one-time D1 work/storage.

```powershell
npx wrangler d1 migrations apply tear-of-god-db --remote --config wrangler.quota.toml
npx wrangler d1 execute tear-of-god-db --remote --config wrangler.quota.toml --command "SELECT name, sql FROM sqlite_master WHERE name IN ('idx_analytics_created','idx_items_name'); SELECT name FROM d1_migrations WHERE name='0011_quota_indexes.sql';"
```

Require two index definitions (`analytics_events(created_at)`, `items(name)`) and the migration ledger row before continuing.

4. Deploy the already-validated build to the project's production branch:

```powershell
npx wrangler pages deploy dist --branch=master --project-name=tear-of-god
```

5. Read-only verification:

```powershell
$quotaCatalog = Invoke-RestMethod 'https://tear-of-god.pages.dev/api/templates?limit=1&sort=recent'
if (-not $quotaCatalog.success -or -not $quotaCatalog.data.Count) { throw 'Template list smoke test failed' }
$quotaTemplateId = [uri]::EscapeDataString($quotaCatalog.data[0].id)
Invoke-RestMethod "https://tear-of-god.pages.dev/api/templates?id=$quotaTemplateId"
Invoke-RestMethod "https://tear-of-god.pages.dev/api/template-votes?template_id=$quotaTemplateId"
Invoke-RestMethod 'https://tear-of-god.pages.dev/api/hashtags?limit=1'
```

Verify the returned template content and reaction totals. In an existing signed-in browser, check notifications and admin analytics; guest API requests must not gain private fields. Do not create production votes/uploads just to measure quota savings.

If application verification fails, roll Pages back to its previous deployment; these additive indexes can stay. No database restore is needed for an application rollback.

References: [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/), [index accounting](https://developers.cloudflare.com/d1/best-practices/use-indexes/).
