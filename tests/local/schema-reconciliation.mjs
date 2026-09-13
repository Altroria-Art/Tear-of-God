import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

const fixtureSql = await readFile(
  new URL('../fixtures/production-schema-before-0017.sql', import.meta.url),
  'utf8',
);
const migrationSql = await readFile(
  new URL('../../docs/migration-drafts/0017_schema_reconciliation.sql', import.meta.url),
  'utf8',
);

function sqlStatements(sql) {
  return sql
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n')
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);
}

const fixtureStatements = sqlStatements(fixtureSql);
const migrationStatements = sqlStatements(migrationSql);
assert.match(migrationSql, /pragma_foreign_key_check/i);
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

async function createProductionShapeD1() {
  const mf = new Miniflare(convertV4MiniflareOptions({
    modules: true,
    script: 'export default { fetch() { return new Response("local test"); } }',
    compatibilityDate: '2026-01-01',
    d1Databases: ['DB'],
  }));
  const db = await mf.getD1Database('DB');
  await db.batch(fixtureStatements.map((statement) => db.prepare(statement)));
  return { mf, db };
}

async function seedSyntheticGraph(db) {
  await db.batch([
    db.prepare(`INSERT INTO profiles (id, username, email) VALUES
      ('creator', 'synthetic-creator', 'creator@local.test'),
      ('ranker', 'synthetic-ranker', 'ranker@local.test'),
      ('member', 'synthetic-member', 'member@local.test')`),
    db.prepare(`INSERT INTO items (id, name) VALUES
      ('item-a', 'Synthetic A'),
      ('item-b', 'Synthetic B')`),
    db.prepare(`INSERT INTO templates
      (id, creator_id, title, description, category, hashtags, tiers, use_count, created_at, view_count)
      VALUES
      ('template-keep', 'creator', 'Keep', 'Synthetic', 'test', '#local', '[]', 2, '2026-01-01 00:00:00', 3),
      ('template-cascade', 'creator', 'Cascade', 'Synthetic', 'test', '#local', '[]', 1, '2026-01-02 00:00:00', 1)`),
    db.prepare(`INSERT INTO rankings
      (id, title, description, category, hashtags, user_id, created_at, template_id, likes_count, dislikes_count, comments_count)
      VALUES
      ('ranking-main', 'Main', 'Synthetic', 'test', '#local', 'ranker', '2026-02-01 00:00:00', 'template-keep', 4, 1, 1),
      ('ranking-null-template', 'Legacy', 'Synthetic', 'test', '#local', 'ranker', '2026-02-02 00:00:00', NULL, 0, 0, 0),
      ('ranking-cascade', 'Cascade', 'Synthetic', 'test', '#local', 'ranker', '2026-02-03 00:00:00', 'template-cascade', 0, 0, 0)`),
    db.prepare(`INSERT INTO template_items (id, template_id, item_id, tier, position) VALUES
      ('template-item-main', 'template-keep', 'item-a', NULL, 0),
      ('template-item-cascade', 'template-cascade', 'item-b', NULL, 0)`),
    db.prepare(`INSERT INTO ranking_items (id, ranking_id, item_id, tier, position) VALUES
      ('ranking-item-main-a', 'ranking-main', 'item-a', 'S', 0),
      ('ranking-item-main-b', 'ranking-main', 'item-b', 'A', 1),
      ('ranking-item-cascade', 'ranking-cascade', 'item-a', 'S', 0)`),
    db.prepare(`INSERT INTO ranking_item_scores
      (id, ranking_id, template_id, item_id, tier_index, score, created_at) VALUES
      ('score-main-a', 'ranking-main', 'template-keep', 'item-a', 0, 2, '2026-02-01 00:00:00'),
      ('score-main-b', 'ranking-main', 'template-keep', 'item-b', 1, 1, '2026-02-01 00:00:00'),
      ('score-cascade', 'ranking-cascade', 'template-cascade', 'item-a', 0, 2, '2026-02-03 00:00:00')`),
    db.prepare("INSERT INTO votes (id, ranking_id, user_id, vote_type) VALUES ('vote-main', 'ranking-main', 'member', 'like')"),
    db.prepare("INSERT INTO comments (id, ranking_id, user_id, content) VALUES ('comment-main', 'ranking-main', 'member', 'Synthetic')"),
    db.prepare("INSERT INTO template_views (template_id, user_id) VALUES ('template-keep', 'member')"),
    db.prepare("INSERT INTO template_reactions (id, template_id, user_id, vote_type) VALUES ('reaction-main', 'template-keep', 'member', 'like')"),
    db.prepare("INSERT INTO template_comments (id, template_id, user_id, content) VALUES ('template-comment-main', 'template-keep', 'member', 'Synthetic')"),
    db.prepare("INSERT INTO template_bookmarks (user_id, template_id) VALUES ('member', 'template-keep')"),
    db.prepare(`INSERT INTO reports
      (id, template_id, ranking_id, reporter_id, reason, comment_id, template_comment_id)
      VALUES ('report-main', 'template-keep', 'ranking-main', 'member', 'Synthetic', 'comment-main', 'template-comment-main')`),
  ]);
}

async function rowCounts(db) {
  const counts = {};
  for (const table of applicationTables) {
    counts[table] = (await db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).first()).count;
  }
  return counts;
}

async function rowDataSnapshot(db) {
  const snapshot = {};
  for (const table of applicationTables) {
    const rows = (await db.prepare(`SELECT * FROM ${table}`).all()).results;
    snapshot[table] = rows.map((row) => JSON.stringify(row)).sort();
  }
  return snapshot;
}

async function tableInfo(db, table) {
  return (await db.prepare(`PRAGMA table_info(${table})`).all()).results;
}

async function schemaSnapshot(db) {
  return (await db.prepare(`
    SELECT type, name, tbl_name, sql
    FROM sqlite_master
    WHERE name NOT LIKE 'sqlite_%'
    ORDER BY type, name
  `).all()).results;
}

async function namedIndexes(db) {
  return (await db.prepare(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'index' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `).all()).results.map((row) => row.name);
}

async function applyMigration(db) {
  return db.batch(migrationStatements.map((statement) => db.prepare(statement)));
}

async function assertNoForeignKeyViolations(db) {
  const violations = (await db.prepare('PRAGMA foreign_key_check').all()).results;
  assert.deepEqual(violations, []);
}

async function testSuccessfulReconciliation() {
  const { mf, db } = await createProductionShapeD1();
  try {
    await seedSyntheticGraph(db);
    const countsBefore = await rowCounts(db);
    const dataBefore = await rowDataSnapshot(db);
    const indexesBefore = await namedIndexes(db);
    const rankingsInfoBefore = await tableInfo(db, 'rankings');
    const templatesInfoBefore = await tableInfo(db, 'templates');

    const rankingFksBefore = (await db.prepare('PRAGMA foreign_key_list(rankings)').all()).results;
    assert.ok(!rankingFksBefore.some((fk) => fk.from === 'template_id'));
    const templateFksBefore = (await db.prepare('PRAGMA foreign_key_list(templates)').all()).results;
    assert.ok(templateFksBefore.some((fk) => (
      fk.from === 'creator_id' && fk.on_delete === 'CASCADE'
    )));
    const scoreIndexesBefore = (await db.prepare('PRAGMA index_list(ranking_item_scores)').all()).results;
    assert.ok(!scoreIndexesBefore.some((index) => index.unique === 1 && index.origin !== 'pk'));

    await applyMigration(db);

    assert.deepEqual(await rowCounts(db), countsBefore);
    assert.deepEqual(await rowDataSnapshot(db), dataBefore);
    assert.deepEqual(
      await namedIndexes(db),
      [...indexesBefore, 'idx_ranking_item_scores_ranking_item_unique'].sort(),
    );
    assert.deepEqual(await tableInfo(db, 'rankings'), rankingsInfoBefore);
    assert.deepEqual(await tableInfo(db, 'templates'), templatesInfoBefore);
    await assertNoForeignKeyViolations(db);

    const rankingFks = (await db.prepare('PRAGMA foreign_key_list(rankings)').all()).results;
    assert.ok(rankingFks.some((fk) => (
      fk.from === 'template_id'
      && fk.table === 'templates'
      && fk.to === 'id'
      && fk.on_delete === 'CASCADE'
    )));
    const templateFks = (await db.prepare('PRAGMA foreign_key_list(templates)').all()).results;
    assert.ok(templateFks.some((fk) => (
      fk.from === 'creator_id'
      && fk.table === 'profiles'
      && fk.to === 'id'
      && fk.on_delete === 'SET NULL'
    )));

    for (const indexName of preservedExtraIndexes) {
      assert.ok(await db.prepare(
        "SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = ?"
      ).bind(indexName).first());
    }

    assert.ok(await db.prepare(
      "SELECT 1 FROM rankings WHERE id = 'ranking-null-template' AND template_id IS NULL"
    ).first());

    await assert.rejects(
      db.prepare(`INSERT INTO ranking_item_scores
        (id, ranking_id, template_id, item_id, tier_index, score)
        VALUES ('score-duplicate', 'ranking-main', 'template-keep', 'item-a', 0, 2)`).run(),
      /UNIQUE constraint failed/,
    );

    await db.prepare("DELETE FROM templates WHERE id = 'template-cascade'").run();
    assert.equal(await db.prepare("SELECT 1 FROM rankings WHERE id = 'ranking-cascade'").first(), null);
    assert.equal(await db.prepare("SELECT 1 FROM ranking_items WHERE ranking_id = 'ranking-cascade'").first(), null);
    assert.equal(await db.prepare("SELECT 1 FROM ranking_item_scores WHERE ranking_id = 'ranking-cascade'").first(), null);
    assert.ok(await db.prepare("SELECT 1 FROM rankings WHERE id = 'ranking-null-template'").first());

    await db.prepare("DELETE FROM profiles WHERE id = 'creator'").run();
    const preservedTemplate = await db.prepare(
      "SELECT creator_id FROM templates WHERE id = 'template-keep'"
    ).first();
    assert.ok(preservedTemplate);
    assert.equal(preservedTemplate.creator_id, null);
    assert.ok(await db.prepare("SELECT 1 FROM rankings WHERE id = 'ranking-main'").first());
    assert.ok(await db.prepare(
      "SELECT 1 FROM template_items WHERE template_id = 'template-keep'"
    ).first());
    assert.ok(await db.prepare(
      "SELECT 1 FROM template_comments WHERE template_id = 'template-keep'"
    ).first());
    assert.ok(await db.prepare(
      "SELECT 1 FROM template_reactions WHERE template_id = 'template-keep'"
    ).first());
    await assertNoForeignKeyViolations(db);

    const ledgerCount = await db.prepare('SELECT COUNT(*) AS count FROM d1_migrations').first();
    assert.equal(ledgerCount.count, 0);
    console.log('reconciliation: row counts, data, column order, indexes, and FKs preserved');
    console.log('semantics: nullable ranking, template cascade, creator SET NULL, and score uniqueness passed');
  } finally {
    await mf.dispose();
  }
}

async function testMidMigrationRollback() {
  const { mf, db } = await createProductionShapeD1();
  try {
    await seedSyntheticGraph(db);
    const schemaBefore = await schemaSnapshot(db);
    const dataBefore = await rowDataSnapshot(db);
    const failurePoint = migrationStatements.findIndex((statement) => (
      statement.startsWith("UPDATE rankings SET id = '__phase3c_20260913_old__'")
    ));
    assert.ok(failurePoint > 0);

    const forcedFailure = db.prepare(
      "INSERT INTO phase3c_missing_table (id) VALUES ('forced-failure')"
    );
    await assert.rejects(db.batch([
      ...migrationStatements.slice(0, failurePoint + 1).map((statement) => db.prepare(statement)),
      forcedFailure,
      ...migrationStatements.slice(failurePoint + 1).map((statement) => db.prepare(statement)),
    ]), /no such table/);

    assert.deepEqual(await schemaSnapshot(db), schemaBefore);
    assert.deepEqual(await rowDataSnapshot(db), dataBefore);
    await assertNoForeignKeyViolations(db);
    console.log('atomicity: injected mid-migration failure rolled back schema and row changes');
  } finally {
    await mf.dispose();
  }
}

async function assertPreflightFailure(kind, seedInvalidState) {
  const { mf, db } = await createProductionShapeD1();
  try {
    await seedSyntheticGraph(db);
    await seedInvalidState(db);
    const schemaBefore = await schemaSnapshot(db);
    const countsBefore = await rowCounts(db);

    await assert.rejects(applyMigration(db), /CHECK constraint failed/);

    assert.deepEqual(await schemaSnapshot(db), schemaBefore);
    assert.deepEqual(await rowCounts(db), countsBefore);
    assert.equal(await db.prepare(
      "SELECT 1 FROM sqlite_master WHERE name = '__phase3c_preflight_guard'"
    ).first(), null);
    console.log(`preflight: ${kind} rejected atomically`);
  } finally {
    await mf.dispose();
  }
}

await testSuccessfulReconciliation();
await testMidMigrationRollback();
await assertPreflightFailure('orphan ranking template', async (db) => {
  await db.prepare(`INSERT INTO rankings
    (id, title, user_id, template_id)
    VALUES ('ranking-orphan', 'Orphan', 'ranker', 'missing-template')`).run();
});
await assertPreflightFailure('duplicate ranking score pair', async (db) => {
  await db.prepare(`INSERT INTO ranking_item_scores
    (id, ranking_id, template_id, item_id, tier_index, score)
    VALUES ('score-duplicate-before', 'ranking-main', 'template-keep', 'item-a', 0, 2)`).run();
});

console.log('Schema reconciliation checks passed against synthetic local Miniflare D1.');
