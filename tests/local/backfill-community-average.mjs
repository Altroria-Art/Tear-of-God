import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

import { onRequestGet as templatesGet } from '../../functions/api/templates.js';

const schema = await readFile(new URL('../../schema.sql', import.meta.url), 'utf8');
const schemaStatements = schema
  .split(/\r?\n/)
  .filter((line) => !line.trimStart().startsWith('--'))
  .join('\n')
  .split(';')
  .map((statement) => statement.trim())
  .filter(Boolean);

const backfillSql = await readFile(new URL('../../scripts/sql/backfill-ranking-scores.sql', import.meta.url), 'utf8');

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

async function runTests() {
  const { mf, db } = await createLocalD1();
  try {
    console.log('--- Test Suite: Backfill ranking_item_scores & Community Average ---');

    // Seed profile
    await db.prepare('INSERT INTO profiles (id, username, email) VALUES (?, ?, ?)')
      .bind('user-1', 'TestUser', 'user1@test.com').run();

    // 1. Create a template with 5 tiers (S, A, B, C, D)
    const templateId = 'tpl-backfill-test';
    const tiers = [
      { id: 't-s', label: 'S', color: '#ff7f7f' }, // idx 0, score = 5
      { id: 't-a', label: 'A', color: '#ffbf7f' }, // idx 1, score = 4
      { id: 't-b', label: 'B', color: '#ffff7f' }, // idx 2, score = 3
      { id: 't-c', label: 'C', color: '#7fff7f' }, // idx 3, score = 2
      { id: 't-d', label: 'D', color: '#7fbfff' }, // idx 4, score = 1
    ];
    await db.prepare(
      'INSERT INTO templates (id, creator_id, title, description, hashtags, tiers) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(
      templateId,
      'user-1',
      'Anime Tier List Template',
      'Test template description',
      '#anime,#test',
      JSON.stringify(tiers)
    ).run();

    // Add template items
    const items = ['Naruto', 'One Piece', 'Bleach', 'Dragon Ball'];
    for (let i = 0; i < items.length; i++) {
      await db.prepare(
        'INSERT INTO template_items (id, template_id, item_id, position, tier) VALUES (?, ?, ?, ?, ?)'
      ).bind(`ti-${i}`, templateId, items[i], i, i === 0 ? 'S' : null).run();
    }

    // 2. Simulate historical rankings that have NO ranking_item_scores:
    // Ranking 1 by user-1:
    // Naruto -> S (score should be 5 - 0 = 5)
    // One Piece -> S (score should be 5 - 0 = 5)
    // Bleach -> B (score should be 5 - 2 = 3)
    // Dragon Ball -> NULL (untiered item in pool -> MUST NOT BE SCORED)
    const rankingId1 = 'rank-1';
    await db.prepare(
      'INSERT INTO rankings (id, template_id, title, user_id) VALUES (?, ?, ?, ?)'
    ).bind(rankingId1, templateId, 'My First Ranking', 'user-1').run();

    await db.prepare('INSERT INTO ranking_items (id, ranking_id, item_id, tier, position) VALUES (?, ?, ?, ?, ?)')
      .bind('ri-1-1', rankingId1, 'Naruto', 'S', 0).run();
    await db.prepare('INSERT INTO ranking_items (id, ranking_id, item_id, tier, position) VALUES (?, ?, ?, ?, ?)')
      .bind('ri-1-2', rankingId1, 'One Piece', 'S', 1).run();
    await db.prepare('INSERT INTO ranking_items (id, ranking_id, item_id, tier, position) VALUES (?, ?, ?, ?, ?)')
      .bind('ri-1-3', rankingId1, 'Bleach', 'B', 2).run();
    await db.prepare('INSERT INTO ranking_items (id, ranking_id, item_id, tier, position) VALUES (?, ?, ?, ?, ?)')
      .bind('ri-1-4', rankingId1, 'Dragon Ball', null, 3).run(); // tier: null

    // Ranking 2:
    // Naruto -> A (score should be 5 - 1 = 4)
    // Bleach -> C (score should be 5 - 3 = 2)
    const rankingId2 = 'rank-2';
    await db.prepare(
      'INSERT INTO rankings (id, template_id, title, user_id) VALUES (?, ?, ?, ?)'
    ).bind(rankingId2, templateId, 'My Second Ranking', 'user-1').run();

    await db.prepare('INSERT INTO ranking_items (id, ranking_id, item_id, tier, position) VALUES (?, ?, ?, ?, ?)')
      .bind('ri-2-1', rankingId2, 'Naruto', 'A', 0).run();
    await db.prepare('INSERT INTO ranking_items (id, ranking_id, item_id, tier, position) VALUES (?, ?, ?, ?, ?)')
      .bind('ri-2-2', rankingId2, 'Bleach', 'C', 1).run();

    // Verify before backfill: 0 scores in database
    const scoresBefore = (await db.prepare('SELECT COUNT(*) as n FROM ranking_item_scores').first()).n;
    assert.equal(scoresBefore, 0, 'Should start with 0 scores');

    // Check GET /api/templates before backfill: has_community_average_all_time is false
    const resBefore = await templatesGet({
      request: new Request(`https://local.test/api/templates?id=${templateId}`),
      env: { tear_of_god_db: db },
      data: { user: { id: 'user-1' } },
    });
    assert.equal(resBefore.status, 200);
    const dataBefore = (await resBefore.json()).data;
    assert.equal(dataBefore.has_community_average_all_time, false);
    assert.ok(dataBefore.community_average.tiers.every((t) => t.items.length === 0));

    // 3. Execute backfill SQL
    await db.prepare(backfillSql).run();

    // 4. Verify ranking_item_scores after backfill:
    // Should have 5 scored rows:
    // rank-1: Naruto (5), One Piece (5), Bleach (3)
    // rank-2: Naruto (4), Bleach (2)
    // Dragon Ball (tier: null) must be omitted!
    const scoresAfter = (await db.prepare('SELECT COUNT(*) as n FROM ranking_item_scores').first()).n;
    assert.equal(scoresAfter, 5, 'Should have inserted exactly 5 score rows');

    const dragonBallScore = await db.prepare('SELECT * FROM ranking_item_scores WHERE item_id = ?').bind('Dragon Ball').first();
    assert.equal(dragonBallScore, null, 'Items with tier: null must NOT have scores');

    // Check scores calculation:
    // Naruto: rank-1 has tier_index 0, score 5
    const narutoR1 = await db.prepare('SELECT * FROM ranking_item_scores WHERE ranking_id = ? AND item_id = ?').bind(rankingId1, 'Naruto').first();
    assert.equal(narutoR1.tier_index, 0);
    assert.equal(narutoR1.score, 5); // tierCount (5) - tierIndex (0) = 5

    // Naruto: rank-2 has tier_index 1, score 4
    const narutoR2 = await db.prepare('SELECT * FROM ranking_item_scores WHERE ranking_id = ? AND item_id = ?').bind(rankingId2, 'Naruto').first();
    assert.equal(narutoR2.tier_index, 1);
    assert.equal(narutoR2.score, 4); // tierCount (5) - tierIndex (1) = 4

    // Bleach: rank-1 has tier_index 2, score 3
    const bleachR1 = await db.prepare('SELECT * FROM ranking_item_scores WHERE ranking_id = ? AND item_id = ?').bind(rankingId1, 'Bleach').first();
    assert.equal(bleachR1.tier_index, 2);
    assert.equal(bleachR1.score, 3); // 5 - 2 = 3

    // Bleach: rank-2 has tier_index 3, score 2
    const bleachR2 = await db.prepare('SELECT * FROM ranking_item_scores WHERE ranking_id = ? AND item_id = ?').bind(rankingId2, 'Bleach').first();
    assert.equal(bleachR2.tier_index, 3);
    assert.equal(bleachR2.score, 2); // 5 - 3 = 2

    // 5. Test idempotency (no duplicate rows on re-run)
    await db.prepare(backfillSql).run();
    const scoresAfterRerun = (await db.prepare('SELECT COUNT(*) as n FROM ranking_item_scores').first()).n;
    assert.equal(scoresAfterRerun, 5, 'Re-running backfill must not create duplicate rows');

    // 6. Check GET /api/templates after backfill:
    const resAfter = await templatesGet({
      request: new Request(`https://local.test/api/templates?id=${templateId}`),
      env: { tear_of_god_db: db },
      data: { user: { id: 'user-1' } },
    });
    assert.equal(resAfter.status, 200);
    const dataAfter = (await resAfter.json()).data;
    assert.equal(dataAfter.has_community_average_all_time, true);

    // Verify item placement in Community Average:
    // Naruto: avg score = (5 + 4) / 2 = 4.5 -> tierIndex = 5 - Math.round(4.5) = 5 - 5 = 0 -> Tier S
    const sTier = dataAfter.community_average.tiers.find((t) => t.label === 'S');
    assert.ok(sTier.items.some((i) => i.name === 'Naruto'), 'Naruto should be in S tier');

    // One Piece: avg score = 5 -> tierIndex = 5 - 5 = 0 -> Tier S
    assert.ok(sTier.items.some((i) => i.name === 'One Piece'), 'One Piece should be in S tier');

    // Bleach: avg score = (3 + 2) / 2 = 2.5 -> tierIndex = 5 - Math.round(2.5) = 5 - 3 = 2 -> Tier B
    const bTier = dataAfter.community_average.tiers.find((t) => t.label === 'B');
    assert.ok(bTier.items.some((i) => i.name === 'Bleach'), 'Bleach should be in B tier');

    // 7. Verify template with 0 rankings:
    const emptyTemplateId = 'tpl-empty';
    await db.prepare(
      'INSERT INTO templates (id, creator_id, title, description, hashtags, tiers) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(
      emptyTemplateId,
      'user-1',
      'Empty Template',
      'No rankings yet',
      '#empty',
      JSON.stringify(tiers)
    ).run();

    const resEmpty = await templatesGet({
      request: new Request(`https://local.test/api/templates?id=${emptyTemplateId}`),
      env: { tear_of_god_db: db },
      data: { user: { id: 'user-1' } },
    });
    assert.equal(resEmpty.status, 200);
    const dataEmpty = (await resEmpty.json()).data;
    assert.equal(dataEmpty.has_community_average_all_time, false);
    assert.equal(dataEmpty.tiers.length, 5);
    assert.ok(dataEmpty.community_average.tiers.every((t) => t.items.length === 0));

    console.log('ok 1 - backfill accurately computes scores (tierCount - tierIndex)');
    console.log('ok 2 - items with tier: null are excluded');
    console.log('ok 3 - duplicate rows are prevented on repeated backfill runs');
    console.log('ok 4 - Community Average is populated and items placed in correct tiers');
    console.log('ok 5 - templates with 0 rankings return clean empty tiers without errors');
  } finally {
    await mf.dispose();
  }
}

await runTests();
console.log('All local backfill Community Average tests passed.');
