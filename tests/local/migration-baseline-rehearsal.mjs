import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const wranglerCli = join(repoRoot, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
const fullConfig = join(repoRoot, 'wrangler.phase3d.toml');
const baselineConfig = join(repoRoot, 'wrangler.phase3d-baseline.toml');
const fixturePath = join(repoRoot, 'tests', 'fixtures', 'production-schema-before-0017.sql');
const activeDir = join(repoRoot, 'migrations-active');
const activeBaseline = join(activeDir, '0001_baseline.sql');
const activeReconciliation = join(activeDir, '0002_schema_reconciliation.sql');
const draftReconciliation = join(
  repoRoot,
  'docs',
  'migration-drafts',
  '0017_schema_reconciliation.sql',
);
const expectedMigrations = ['0001_baseline.sql', '0002_schema_reconciliation.sql'];
const applicationTables = [
  'profiles',
  'follows',
  'items',
  'templates',
  'rankings',
  'template_items',
  'ranking_items',
  'ranking_item_scores',
  'votes',
  'comments',
  'template_views',
  'template_reactions',
  'template_comments',
  'template_bookmarks',
  'reports',
  'auth_sessions',
  'auth_attempts',
  'auth_identities',
  'password_resets',
];
const preservedExtraIndexes = [
  'idx_follows_follower',
  'idx_template_reactions_user',
  'idx_template_views_template',
];
const seedSql = `
INSERT INTO profiles (id, username, email) VALUES
  ('creator', 'synthetic-creator', 'creator@local.test'),
  ('ranker', 'synthetic-ranker', 'ranker@local.test'),
  ('member', 'synthetic-member', 'member@local.test');
INSERT INTO items (id, name) VALUES
  ('item-a', 'Synthetic A'),
  ('item-b', 'Synthetic B');
INSERT INTO templates
  (id, creator_id, title, description, category, hashtags, tiers, use_count, created_at, view_count)
VALUES
  ('template-keep', 'creator', 'Keep', 'Synthetic', 'test', '#local', '[]', 2, '2026-01-01 00:00:00', 3),
  ('template-cascade', 'creator', 'Cascade', 'Synthetic', 'test', '#local', '[]', 1, '2026-01-02 00:00:00', 1);
INSERT INTO rankings
  (id, title, description, category, hashtags, user_id, created_at, template_id, likes_count, dislikes_count, comments_count)
VALUES
  ('ranking-main', 'Main', 'Synthetic', 'test', '#local', 'ranker', '2026-02-01 00:00:00', 'template-keep', 4, 1, 1),
  ('ranking-null-template', 'Legacy', 'Synthetic', 'test', '#local', 'ranker', '2026-02-02 00:00:00', NULL, 0, 0, 0),
  ('ranking-cascade', 'Cascade', 'Synthetic', 'test', '#local', 'ranker', '2026-02-03 00:00:00', 'template-cascade', 0, 0, 0);
INSERT INTO template_items (id, template_id, item_id, tier, position) VALUES
  ('template-item-main', 'template-keep', 'item-a', NULL, 0),
  ('template-item-cascade', 'template-cascade', 'item-b', NULL, 0);
INSERT INTO ranking_items (id, ranking_id, item_id, tier, position) VALUES
  ('ranking-item-main-a', 'ranking-main', 'item-a', 'S', 0),
  ('ranking-item-main-b', 'ranking-main', 'item-b', 'A', 1),
  ('ranking-item-cascade', 'ranking-cascade', 'item-a', 'S', 0);
INSERT INTO ranking_item_scores
  (id, ranking_id, template_id, item_id, tier_index, score, created_at)
VALUES
  ('score-main-a', 'ranking-main', 'template-keep', 'item-a', 0, 2, '2026-02-01 00:00:00'),
  ('score-main-b', 'ranking-main', 'template-keep', 'item-b', 1, 1, '2026-02-01 00:00:00'),
  ('score-cascade', 'ranking-cascade', 'template-cascade', 'item-a', 0, 2, '2026-02-03 00:00:00');
INSERT INTO votes (id, ranking_id, user_id, vote_type)
  VALUES ('vote-main', 'ranking-main', 'member', 'like');
INSERT INTO comments (id, ranking_id, user_id, content)
  VALUES ('comment-main', 'ranking-main', 'member', 'Synthetic');
INSERT INTO template_views (template_id, user_id)
  VALUES ('template-keep', 'member');
INSERT INTO template_reactions (id, template_id, user_id, vote_type)
  VALUES ('reaction-main', 'template-keep', 'member', 'like');
INSERT INTO template_comments (id, template_id, user_id, content)
  VALUES ('template-comment-main', 'template-keep', 'member', 'Synthetic');
INSERT INTO template_bookmarks (user_id, template_id)
  VALUES ('member', 'template-keep');
INSERT INTO reports
  (id, template_id, ranking_id, reporter_id, reason, comment_id, template_comment_id)
VALUES
  ('report-main', 'template-keep', 'ranking-main', 'member', 'Synthetic', 'comment-main', 'template-comment-main');
`;

function runWrangler(args, { expectFailure = false } = {}) {
  assert.ok(args.includes('--local'), 'Every rehearsal Wrangler command must use --local');
  assert.ok(!args.includes('--remote'), 'Remote Wrangler access is forbidden in Phase 3D');
  const result = spawnSync(process.execPath, [wranglerCli, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      CI: 'true',
      FORCE_COLOR: '0',
      NO_COLOR: '1',
      WRANGLER_SEND_METRICS: 'false',
    },
    timeout: 30_000,
  });
  const output = `${result.stdout || ''}${result.stderr || ''}`;
  if (expectFailure) {
    assert.notEqual(result.status, 0, `Expected Wrangler failure but command passed:\n${output}`);
  } else {
    assert.equal(result.status, 0, `Wrangler command failed:\n${output}`);
  }
  return output;
}

function localArgs(configPath, persistPath) {
  return ['--local', '--config', configPath, '--persist-to', persistPath];
}

function migrationNames(output) {
  return [...new Set(output.match(/\b\d{4}_[a-z0-9_-]+\.sql\b/gi) || [])].sort();
}

function assertDiscovery(output, expected) {
  const discovered = migrationNames(output);
  assert.deepEqual(discovered, expected);
  assert.ok(!discovered.some((name) => name.includes('templates_tiers')));
  return discovered;
}

async function findDatabaseFile(persistPath) {
  const entries = await readdir(persistPath, { recursive: true });
  const candidates = entries
    .filter((entry) => entry.endsWith('.sqlite') && basename(entry) !== 'metadata.sqlite')
    .map((entry) => join(persistPath, entry));
  assert.equal(candidates.length, 1, `Expected one isolated D1 file, found ${candidates.length}`);
  return candidates[0];
}

async function inspectDatabase(persistPath) {
  const databaseFile = await findDatabaseFile(persistPath);
  const db = new DatabaseSync(databaseFile, { readOnly: true });
  try {
    const schema = db.prepare(`
      SELECT type, name, tbl_name, sql
      FROM sqlite_master
      WHERE name NOT LIKE 'sqlite_%'
        AND name NOT LIKE '_cf_%'
        AND name <> 'd1_migrations'
      ORDER BY type, name
    `).all();
    const rows = {};
    const counts = {};
    for (const table of applicationTables) {
      const tableRows = db.prepare(`SELECT * FROM ${table}`).all();
      rows[table] = tableRows.map((row) => JSON.stringify(row)).sort();
      counts[table] = tableRows.length;
    }
    const indexes = db.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'index' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `).all().map((row) => row.name);
    const ledger = db.prepare('SELECT id, name FROM d1_migrations ORDER BY id').all();
    const foreignKeyViolations = db.prepare('PRAGMA foreign_key_check').all();
    const tableInfo = {
      rankings: db.prepare('PRAGMA table_info(rankings)').all(),
      templates: db.prepare('PRAGMA table_info(templates)').all(),
    };
    return {
      databaseFile,
      schema,
      rows,
      counts,
      indexes,
      ledger,
      foreignKeyViolations,
      tableInfo,
    };
  } finally {
    db.close();
  }
}

function applicationSnapshot(state) {
  return {
    schema: state.schema,
    rows: state.rows,
    counts: state.counts,
    indexes: state.indexes,
    foreignKeyViolations: state.foreignKeyViolations,
  };
}

function initializeScenario(configPath, persistPath) {
  const args = localArgs(configPath, persistPath);
  runWrangler(['d1', 'execute', 'DB', ...args, '--file', fixturePath]);
  runWrangler(['d1', 'execute', 'DB', ...args, '--command', seedSql]);
}

function listMigrations(configPath, persistPath) {
  return runWrangler([
    'd1', 'migrations', 'list', 'DB',
    ...localArgs(configPath, persistPath),
  ]);
}

function applyMigrations(configPath, persistPath, options) {
  return runWrangler([
    'd1', 'migrations', 'apply', 'DB',
    ...localArgs(configPath, persistPath),
  ], options);
}

async function assertSuccessfulFlow(tempRoot) {
  const persistPath = join(tempRoot, 'success');
  initializeScenario(fullConfig, persistPath);
  const initial = await inspectDatabase(persistPath);
  assert.deepEqual(initial.ledger, []);

  const initialDiscovery = listMigrations(fullConfig, persistPath);
  assertDiscovery(initialDiscovery, expectedMigrations);
  console.log(`discovery: ${expectedMigrations.join(', ')} only`);

  applyMigrations(baselineConfig, persistPath);
  const afterBaseline = await inspectDatabase(persistPath);
  assert.deepEqual(afterBaseline.ledger.map((row) => row.name), ['0001_baseline.sql']);
  assert.deepEqual(applicationSnapshot(afterBaseline), applicationSnapshot(initial));
  console.log('baseline: ledger [] -> [0001_baseline.sql], application schema/data unchanged');

  const reconciliationDiscovery = listMigrations(fullConfig, persistPath);
  assertDiscovery(reconciliationDiscovery, ['0002_schema_reconciliation.sql']);
  applyMigrations(fullConfig, persistPath);
  const afterReconciliation = await inspectDatabase(persistPath);
  assert.deepEqual(
    afterReconciliation.ledger.map((row) => row.name),
    expectedMigrations,
  );
  assert.deepEqual(afterReconciliation.counts, initial.counts);
  assert.deepEqual(afterReconciliation.rows, initial.rows);
  assert.deepEqual(afterReconciliation.foreignKeyViolations, []);
  assert.deepEqual(afterReconciliation.tableInfo, initial.tableInfo);
  assert.deepEqual(
    afterReconciliation.indexes,
    [...initial.indexes, 'idx_ranking_item_scores_ranking_item_unique'].sort(),
  );
  for (const indexName of preservedExtraIndexes) {
    assert.ok(afterReconciliation.indexes.includes(indexName));
  }
  const initialSchema = new Map(initial.schema.map((object) => [object.name, object]));
  const reconciledSchema = new Map(afterReconciliation.schema.map((object) => [object.name, object]));
  const schemaNames = new Set([...initialSchema.keys(), ...reconciledSchema.keys()]);
  const changedSchemaObjects = [...schemaNames]
    .filter((name) => (
      JSON.stringify(initialSchema.get(name)) !== JSON.stringify(reconciledSchema.get(name))
    ))
    .sort();
  assert.deepEqual(changedSchemaObjects, [
    'idx_ranking_item_scores_ranking_item_unique',
    'rankings',
    'templates',
  ]);

  const db = new DatabaseSync(afterReconciliation.databaseFile);
  try {
    const rankingTemplateFk = db.prepare('PRAGMA foreign_key_list(rankings)').all()
      .find((fk) => fk.from === 'template_id');
    assert.deepEqual(
      [rankingTemplateFk.table, rankingTemplateFk.to, rankingTemplateFk.on_delete],
      ['templates', 'id', 'CASCADE'],
    );
    const templateCreatorFk = db.prepare('PRAGMA foreign_key_list(templates)').all()
      .find((fk) => fk.from === 'creator_id');
    assert.deepEqual(
      [templateCreatorFk.table, templateCreatorFk.to, templateCreatorFk.on_delete],
      ['profiles', 'id', 'SET NULL'],
    );
    const templateIdColumn = db.prepare('PRAGMA table_info(rankings)').all()
      .find((column) => column.name === 'template_id');
    assert.equal(templateIdColumn.notnull, 0);
  } finally {
    db.close();
  }

  const beforeSecondRun = await inspectDatabase(persistPath);
  const secondList = listMigrations(fullConfig, persistPath);
  assertDiscovery(secondList, []);
  applyMigrations(fullConfig, persistPath);
  const afterSecondRun = await inspectDatabase(persistPath);
  assert.deepEqual(afterSecondRun, beforeSecondRun);
  console.log('second run: no pending migrations and no schema/data/ledger change');

  const fullArgs = localArgs(fullConfig, persistPath);
  runWrangler([
    'd1', 'execute', 'DB', ...fullArgs, '--command', `INSERT INTO ranking_item_scores
      (id, ranking_id, template_id, item_id, tier_index, score)
      VALUES ('score-duplicate', 'ranking-main', 'template-keep', 'item-a', 0, 2)`,
  ], { expectFailure: true });
  runWrangler([
    'd1', 'execute', 'DB', ...fullArgs,
    '--command', "DELETE FROM templates WHERE id = 'template-cascade'",
  ]);
  runWrangler([
    'd1', 'execute', 'DB', ...fullArgs,
    '--command', "DELETE FROM profiles WHERE id = 'creator'",
  ]);
  const semantics = new DatabaseSync(afterReconciliation.databaseFile, { readOnly: true });
  try {
    assert.equal(semantics.prepare(
      "SELECT 1 FROM rankings WHERE id = 'ranking-cascade'"
    ).get(), undefined);
    assert.ok(semantics.prepare(
      "SELECT 1 FROM rankings WHERE id = 'ranking-null-template' AND template_id IS NULL"
    ).get());
    const template = semantics.prepare(
      "SELECT creator_id FROM templates WHERE id = 'template-keep'"
    ).get();
    assert.ok(template);
    assert.equal(template.creator_id, null);
    assert.deepEqual(semantics.prepare('PRAGMA foreign_key_check').all(), []);
  } finally {
    semantics.close();
  }
  console.log('schema semantics: FK cascade, nullable template_id, SET NULL, and unique enforcement passed');
}

async function prepareFailureScenario(tempRoot, name, configPath = fullConfig, baselinePath = baselineConfig) {
  const persistPath = join(tempRoot, name);
  initializeScenario(configPath, persistPath);
  applyMigrations(baselinePath, persistPath);
  return persistPath;
}

async function assertRejectedReconciliation(tempRoot, name, invalidSql) {
  const persistPath = await prepareFailureScenario(tempRoot, name);
  runWrangler([
    'd1', 'execute', 'DB', ...localArgs(fullConfig, persistPath), '--command', invalidSql,
  ]);
  const before = await inspectDatabase(persistPath);
  applyMigrations(fullConfig, persistPath, { expectFailure: true });
  const after = await inspectDatabase(persistPath);
  assert.deepEqual(after.ledger.map((row) => row.name), ['0001_baseline.sql']);
  assert.deepEqual(applicationSnapshot(after), applicationSnapshot(before));
  assert.ok(!after.schema.some((row) => row.name === '__phase3c_preflight_guard'));
  console.log(`${name}: reconciliation rejected, rolled back, and absent from ledger`);
}

async function assertMidMigrationRollback(tempRoot) {
  const scenarioRoot = join(tempRoot, 'mid-failure-config');
  const migrationDir = join(scenarioRoot, 'migrations');
  const persistPath = join(scenarioRoot, 'state');
  const configPath = join(scenarioRoot, 'wrangler.toml');
  const baselineOnlyPath = join(scenarioRoot, 'wrangler.baseline.toml');
  await mkdir(migrationDir, { recursive: true });
  await copyFile(activeBaseline, join(migrationDir, '0001_baseline.sql'));
  const reconciliation = await readFile(activeReconciliation, 'utf8');
  const updateStatement = "UPDATE rankings SET id = '__phase3c_20260913_old__' || id;";
  assert.ok(reconciliation.includes(updateStatement));
  const injected = reconciliation.replace(
    updateStatement,
    `${updateStatement}\nINSERT INTO phase3d_missing_table (id) VALUES ('forced-failure');`,
  );
  await writeFile(join(migrationDir, '0002_schema_reconciliation.sql'), injected);
  const baseConfig = `name = "tear-of-god-phase3d-failure"
compatibility_date = "2026-01-01"
[[d1_databases]]
binding = "DB"
database_name = "tear-of-god-phase3d-failure"
database_id = "00000000-0000-4000-8000-00000000003f"
migrations_dir = "migrations"
`;
  await writeFile(configPath, baseConfig);
  await writeFile(
    baselineOnlyPath,
    `${baseConfig}migrations_pattern = "migrations/0001_baseline.sql"\n`,
  );

  initializeScenario(configPath, persistPath);
  assertDiscovery(listMigrations(configPath, persistPath), expectedMigrations);
  applyMigrations(baselineOnlyPath, persistPath);
  const before = await inspectDatabase(persistPath);
  applyMigrations(configPath, persistPath, { expectFailure: true });
  const after = await inspectDatabase(persistPath);
  assert.deepEqual(after.ledger.map((row) => row.name), ['0001_baseline.sql']);
  assert.deepEqual(applicationSnapshot(after), applicationSnapshot(before));
  console.log('mid-migration failure: schema/data rolled back and reconciliation absent from ledger');
}

const activeNames = (await readdir(activeDir)).filter((name) => name.endsWith('.sql')).sort();
assert.deepEqual(activeNames, expectedMigrations);
assert.equal(
  await readFile(activeReconciliation, 'utf8'),
  await readFile(draftReconciliation, 'utf8'),
);

const tempRoot = await mkdtemp(join(tmpdir(), 'tear-of-god-phase3d-'));
try {
  await assertSuccessfulFlow(tempRoot);
  await assertRejectedReconciliation(
    tempRoot,
    'orphan preflight',
    `INSERT INTO rankings (id, title, user_id, template_id)
      VALUES ('ranking-orphan', 'Orphan', 'ranker', 'missing-template')`,
  );
  await assertRejectedReconciliation(
    tempRoot,
    'duplicate preflight',
    `INSERT INTO ranking_item_scores
      (id, ranking_id, template_id, item_id, tier_index, score)
      VALUES ('score-duplicate-before', 'ranking-main', 'template-keep', 'item-a', 0, 2)`,
  );
  await assertMidMigrationRollback(tempRoot);
} finally {
  const resolvedTemp = resolve(await realpath(tmpdir()));
  const resolvedRoot = resolve(tempRoot);
  assert.ok(resolvedRoot.startsWith(`${resolvedTemp}${sep}`));
  assert.equal(dirname(resolvedRoot), resolvedTemp);
  assert.ok(basename(resolvedRoot).startsWith('tear-of-god-phase3d-'));
  await rm(resolvedRoot, { recursive: true, force: true });
}

console.log('Wrangler Phase 3D baseline and staging rehearsal passed using isolated local D1 only.');
