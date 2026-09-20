import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

import { onRequest as rankings } from '../../functions/api/rankings.js';

const schema = await readFile(new URL('../../schema.sql', import.meta.url), 'utf8');
const schemaStatements = schema
  .split(/\r?\n/)
  .filter((line) => !line.trimStart().startsWith('--'))
  .join('\n')
  .split(';')
  .map((statement) => statement.trim())
  .filter(Boolean);
const tiers = [
  { id: 's', label: 'S', color: '#f87171' },
  { id: 'a', label: 'A', color: '#fdba74' },
  { id: 'b', label: 'B', color: '#fcd34d' },
  { id: 'c', label: 'C', color: '#4ade80' },
  { id: 'd', label: 'D', color: '#60a5fa' },
];
const trackedTables = ['templates', 'template_items', 'rankings', 'ranking_items', 'ranking_item_scores'];

async function createLocalD1() {
  const mf = new Miniflare(convertV4MiniflareOptions({
    modules: true,
    script: 'export default { fetch() { return new Response("local test"); } }',
    compatibilityDate: '2026-01-01',
    d1Databases: ['DB'],
  }));
  const db = await mf.getD1Database('DB');
  await db.batch(schemaStatements.map((statement) => db.prepare(statement)));
  return { mf, db };
}

function items(count) {
  return Array.from({ length: count }, (_, index) => ({
    item_id: `item-${index}`,
    tier: tiers[index % tiers.length].label,
    position: index,
  }));
}

function requestBody(count, { templateId, createTemplate = false } = {}) {
  const rankedItems = items(count);
  return {
    payload: {
      title: `Atomic ranking ${count}`,
      description: 'Local D1 atomicity test',
      hashtags: '#atomic,#local',
      ...(templateId ? { template_id: templateId } : {}),
    },
    items: rankedItems,
    ...(createTemplate ? {
      template: {
        title: `Atomic template ${count}`,
        description: 'Created with the first ranking',
        hashtags: '#atomic,#local',
        tiers,
        items: rankedItems.map((item) => ({ name: item.item_id, position: item.position })),
      },
    } : {}),
  };
}

function instrumentDb(db, { injectFailure = false } = {}) {
  const batchSizes = [];
  let failureIndex = null;
  return {
    binding: {
      prepare: (...args) => db.prepare(...args),
      async batch(statements) {
        batchSizes.push(statements.length);
        if (!injectFailure) return db.batch(statements);
        failureIndex = Math.floor(statements.length / 2);
        const failure = db.prepare('INSERT INTO phase3a_missing_table (id) VALUES (?)').bind('forced-failure');
        return db.batch([
          ...statements.slice(0, failureIndex),
          failure,
          ...statements.slice(failureIndex),
        ]);
      },
    },
    batchSizes,
    get failureIndex() {
      return failureIndex;
    },
  };
}

async function publish(db, body, userId, options) {
  const instrumented = instrumentDb(db, options);
  const response = await rankings({
    request: new Request('https://local.test/api/rankings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    env: { tear_of_god_db: instrumented.binding },
    data: { user: { id: userId } },
  });
  return { response, body: await response.json(), instrumented };
}

async function seedProfile(db, userId) {
  await db.prepare('INSERT INTO profiles (id, username, email) VALUES (?, ?, ?)')
    .bind(userId, userId, `${userId}@local.test`).run();
}

async function seedTemplate(db, templateId, userId, useCount = 7) {
  await db.prepare(`INSERT INTO templates (id, creator_id, title, description, hashtags, tiers, use_count)
    VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .bind(templateId, userId, 'Existing template', '', '#existing', JSON.stringify(tiers), useCount)
    .run();
}

async function tableSnapshot(db) {
  const snapshot = {};
  for (const table of trackedTables) {
    snapshot[table] = (await db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).first()).count;
  }
  snapshot.templateUseCounts = (await db.prepare('SELECT id, use_count FROM templates ORDER BY id').all()).results;
  return snapshot;
}

async function assertRankingRows(db, rankingId, count) {
  const ranking = await db.prepare('SELECT * FROM rankings WHERE id = ?').bind(rankingId).first();
  assert.ok(ranking);
  assert.equal(ranking.hashtags, '#atomic,#local');

  const rankingItems = (await db.prepare(
    'SELECT item_id, tier, position FROM ranking_items WHERE ranking_id = ? ORDER BY position'
  ).bind(rankingId).all()).results;
  assert.equal(rankingItems.length, count);
  rankingItems.forEach((row, index) => {
    assert.equal(row.item_id, `item-${index}`);
    assert.equal(row.tier, tiers[index % tiers.length].label);
    assert.equal(row.position, index);
  });

  const scores = (await db.prepare(
    'SELECT item_id, tier_index, score FROM ranking_item_scores WHERE ranking_id = ? ORDER BY item_id'
  ).bind(rankingId).all()).results;
  assert.equal(scores.length, count);
  for (const row of scores) {
    const index = Number(row.item_id.slice('item-'.length));
    const tierIndex = index % tiers.length;
    assert.equal(row.tier_index, tierIndex);
    assert.equal(row.score, tiers.length - tierIndex);
  }
}

async function testExistingTemplate(count) {
  const { mf, db } = await createLocalD1();
  const userId = `existing-user-${count}`;
  const templateId = `existing-template-${count}`;
  try {
    await seedProfile(db, userId);
    await seedTemplate(db, templateId, userId);
    const result = await publish(db, requestBody(count, { templateId }), userId);
    assert.equal(result.response.status, 201);
    assert.equal(result.body.success, true);
    assert.equal(result.body.data.template_id, templateId);
    // Publish must commit in ONE atomic batch. The batch holds the core writes
    // (ranking INSERT, ranking_items, frozen scores, use_count mirror) plus the
    // notification fan-out statements (following_rank, community_average) added
    // after this test was written — fan-out joins the same batch instead of
    // splitting the transaction, so assert singleness + core minimum, not an
    // exact size that breaks on every legitimate fan-out addition.
    assert.equal(result.instrumented.batchSizes.length, 1);
    assert.ok(result.instrumented.batchSizes[0] >= 4);
    await assertRankingRows(db, result.body.data.id, count);
    assert.equal((await db.prepare('SELECT use_count FROM templates WHERE id = ?').bind(templateId).first()).use_count, 8);
    // Self-publish: fan-out recipients exclude the publisher, so no rows may land
    // in notifications even though the fan-out statements ran inside the batch.
    assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM notifications').first()).count, 0);
    console.log(`existing template: ${count} items, single atomic batch of ${result.instrumented.batchSizes[0]} statements`);
  } finally {
    await mf.dispose();
  }
}

async function testNewTemplate(count) {
  const { mf, db } = await createLocalD1();
  const userId = `new-template-user-${count}`;
  try {
    await seedProfile(db, userId);
    const result = await publish(db, requestBody(count, { createTemplate: true }), userId);
    assert.equal(result.response.status, 201);
    assert.equal(result.body.success, true);
    assert.ok(result.body.data.template_id);
    // Same atomicity contract as the existing-template path: one batch holding
    // the core writes (template + template_items + ranking + ranking_items +
    // frozen scores) plus fan-out — singleness + core minimum, not exact size.
    assert.equal(result.instrumented.batchSizes.length, 1);
    assert.ok(result.instrumented.batchSizes[0] >= 5);
    await assertRankingRows(db, result.body.data.id, count);
    const template = await db.prepare('SELECT * FROM templates WHERE id = ?').bind(result.body.data.template_id).first();
    assert.equal(template.use_count, 1);
    assert.equal(template.hashtags, '#atomic,#local');
    assert.deepEqual(JSON.parse(template.tiers), tiers);
    const templateItems = (await db.prepare(
      'SELECT item_id, tier, position FROM template_items WHERE template_id = ? ORDER BY position'
    ).bind(result.body.data.template_id).all()).results;
    assert.equal(templateItems.length, count);
    templateItems.forEach((row, index) => {
      assert.equal(row.item_id, `item-${index}`);
      assert.equal(row.tier, null);
      assert.equal(row.position, index);
    });
    console.log(`new template + first ranking: ${count} items, single atomic batch of ${result.instrumented.batchSizes[0]} statements`);
  } finally {
    await mf.dispose();
  }
}

async function testFailureRollback({ createTemplate }) {
  const { mf, db } = await createLocalD1();
  const mode = createTemplate ? 'new-template' : 'existing-template';
  const userId = `${mode}-failure-user`;
  const templateId = `${mode}-failure-template`;
  try {
    await seedProfile(db, userId);
    if (!createTemplate) await seedTemplate(db, templateId, userId);
    const before = await tableSnapshot(db);
    const result = await publish(
      db,
      requestBody(101, createTemplate ? { createTemplate: true } : { templateId }),
      userId,
      { injectFailure: true },
    );
    assert.equal(result.response.status, 500);
    assert.equal(result.body.error, 'Service temporarily unavailable');
    assert.ok(result.instrumented.failureIndex > 0);
    assert.ok(result.instrumented.failureIndex < result.instrumented.batchSizes[0]);
    assert.deepEqual(await tableSnapshot(db), before);
    console.log(`${mode} failure injection: all rows and use_count rolled back`);
  } finally {
    await mf.dispose();
  }
}

for (const count of [1, 100, 101, 500]) {
  await testExistingTemplate(count);
}
await testNewTemplate(500);
await testFailureRollback({ createTemplate: false });
await testFailureRollback({ createTemplate: true });

console.log('Ranking creation atomicity checks passed against local Miniflare D1.');
