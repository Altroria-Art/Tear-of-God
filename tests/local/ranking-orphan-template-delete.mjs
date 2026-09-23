// Regression: ลบ ranking แล้ว template กลายเป็น orphan เมื่อเจ้าของ template
// ลบ ranking ตัวสุดท้ายของตัวเองออก → ต้องลบ template พร้อม dependencies ทุก table
// ผ่าน shared helper templateDeleteStatements (ชุดเดียวกับ /api/template-delete)
// รันด้วย: node tests/local/ranking-orphan-template-delete.mjs
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
];

// ทุก non-child table ที่อ้าง template/ranking — ต้องว่างเมื่อ template ถูกลบ orphan
const templateChildTables = [
  'template_items',
  'template_views',
  'template_reactions',
  'template_comments',
  'template_bookmarks',
  'ranking_item_scores',
  'topic_follows',
  'ranking_items',
  'votes',
  'comments',
  'reports',
  'rankings',
  'templates',
  'notifications',
];

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

async function seedProfile(db, userId) {
  await db.prepare('INSERT INTO profiles (id, username, email) VALUES (?, ?, ?)')
    .bind(userId, userId, `${userId}@local.test`).run();
}

async function seedTemplate(db, templateId, creatorId, useCount = 1) {
  await db.prepare(`INSERT INTO templates (id, creator_id, title, description, hashtags, tiers, use_count)
    VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .bind(templateId, creatorId, 'Orphan test template', '', '#orphan', JSON.stringify(tiers), useCount)
    .run();
  await db.prepare(`INSERT INTO template_items (id, template_id, item_id, tier, position)
    VALUES (?, ?, ?, ?, ?)`)
    .bind(`${templateId}-ti1`, templateId, 'item-0', 'S', 0)
    .run();
}

async function seedRanking(db, rankingId, userId, templateId) {
  await seedProfile(db, `${rankingId}-voter`);
  await seedProfile(db, `${rankingId}-commenter`);
  await db.prepare(`INSERT INTO rankings (id, title, description, hashtags, user_id, template_id)
    VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(rankingId, 'Orphan ranking', '', '#orphan', userId, templateId)
    .run();
  await db.prepare(`INSERT INTO ranking_items (id, ranking_id, item_id, tier, position)
    VALUES (?, ?, ?, ?, ?)`)
    .bind(`${rankingId}-ri1`, rankingId, 'item-0', 'S', 0)
    .run();
  await db.prepare(`INSERT INTO votes (id, ranking_id, user_id, vote_type) VALUES (?, ?, ?, ?)`)
    .bind(`${rankingId}-v1`, rankingId, `${rankingId}-voter`, 'like')
    .run();
  await db.prepare(`INSERT INTO comments (id, ranking_id, user_id, content) VALUES (?, ?, ?, ?)`)
    .bind(`${rankingId}-c1`, rankingId, `${rankingId}-commenter`, 'nice')
    .run();
}

async function deleteRanking(db, rankingId, userId) {
  const response = await rankings({
    request: new Request('https://local.test/api/rankings', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: rankingId }),
    }),
    env: { tear_of_god_db: db },
    data: { user: { id: userId } },
  });
  return { response, body: await response.json() };
}

async function count(db, table, where = '', ...params) {
  const row = await db.prepare(`SELECT COUNT(*) AS count FROM ${table}${where ? ` WHERE ${where}` : ''}`)
    .bind(...params).first();
  return row.count;
}

async function assertTemplateIntact(db, templateId, creatorId) {
  const template = await db.prepare('SELECT * FROM templates WHERE id = ?').bind(templateId).first();
  assert.ok(template, 'template must survive');
  assert.equal(template.creator_id, creatorId);
  assert.equal(await count(db, 'template_items', 'template_id = ?', templateId), 1);
}

// A: เจ้าของลบ ranking ตัวสุดท้ายของตัวเอง → ranking + template หายทั้งชุด
async function testOwnerDeletesLastRanking() {
  const { mf, db } = await createLocalD1();
  const owner = 'owner-A';
  const templateId = 'orphan-a-template';
  const rankingId = 'orphan-a-ranking';
  try {
    await seedProfile(db, owner);
    await seedTemplate(db, templateId, owner);
    await seedRanking(db, rankingId, owner, templateId);
    // dependencies ของ template+ranking (เช็ค scenario E ในตัวนี้)
    await seedTemplateDependencies(db, templateId, rankingId);

    const result = await deleteRanking(db, rankingId, owner);
    assert.equal(result.response.status, 200);
    assert.equal(result.body.success, true);
    assert.equal(result.body.templateDeleted, true);

    for (const table of templateChildTables) {
      assert.equal(await count(db, table), 0, `orphan cleanup must empty ${table}`);
    }
    console.log('A: owner deleted last ranking → ranking + template + all dependencies removed');
  } finally {
    await mf.dispose();
  }
}

// B: เจ้าของลบ ranking ของตัวเอง แต่ยังมี ranking ของคนอื่น → template ต้องอยู่
async function testOwnerDeletesKeepsTemplate() {
  const { mf, db } = await createLocalD1();
  const owner = 'owner-B';
  const other = 'other-B';
  const templateId = 'orphan-b-template';
  const ownerRankingId = 'orphan-b-owner-ranking';
  const otherRankingId = 'orphan-b-other-ranking';
  try {
    await seedProfile(db, owner);
    await seedProfile(db, other);
    await seedTemplate(db, templateId, owner);
    await seedRanking(db, ownerRankingId, owner, templateId);
    await seedRanking(db, otherRankingId, other, templateId);

    const result = await deleteRanking(db, ownerRankingId, owner);
    assert.equal(result.response.status, 200);
    assert.equal(result.body.success, true);
    assert.equal(result.body.templateDeleted, false);

    await assertTemplateIntact(db, templateId, owner);
    assert.equal(await count(db, 'rankings', 'id = ?', otherRankingId), 1);
    console.log('B: owner deleted own ranking but template still has someone else → template survives');
  } finally {
    await mf.dispose();
  }
}

// C: คนอื่น (non-owner) ลบ ranking ของตัวเอง → ห้ามลบ template ของเจ้าของ แม้จะเหลือ
//    ranking เดียว (ของตัวเองที่ไม่ใช่ของเจ้าของ) — ดักกรณี non-owner ยิงเบิ้ล
async function testNonOwnerDeletesOwnRanking() {
  const { mf, db } = await createLocalD1();
  const owner = 'owner-C';
  const other = 'other-C';
  const templateId = 'orphan-c-template';
  const otherRankingId = 'orphan-c-other-ranking';
  try {
    await seedProfile(db, owner);
    await seedProfile(db, other);
    await seedTemplate(db, templateId, owner);
    await seedRanking(db, otherRankingId, other, templateId);

    const result = await deleteRanking(db, otherRankingId, other);
    assert.equal(result.response.status, 200);
    assert.equal(result.body.success, true);
    assert.equal(result.body.templateDeleted, false);

    await assertTemplateIntact(db, templateId, owner);
    assert.equal(await count(db, 'rankings', 'id = ?', otherRankingId), 0);
    console.log('C: non-owner deleted own ranking → ranking gone, owner template survives');
  } finally {
    await mf.dispose();
  }
}

// D: ลบ ranking ของคนอื่น → 403 ห้าม และต้องไม่เปลี่ยนอะไรเลย
async function testDeleteSomeoneElsesRanking() {
  const { mf, db } = await createLocalD1();
  const owner = 'owner-D';
  const attacker = 'attacker-D';
  const templateId = 'orphan-d-template';
  const rankingId = 'orphan-d-ranking';
  try {
    await seedProfile(db, owner);
    await seedProfile(db, attacker);
    await seedTemplate(db, templateId, owner);
    await seedRanking(db, rankingId, owner, templateId);

    const before = await count(db, 'rankings');
    const result = await deleteRanking(db, rankingId, attacker);
    assert.equal(result.response.status, 403);
    assert.equal(result.body.success, false);
    assert.equal(await count(db, 'rankings'), before);
    await assertTemplateIntact(db, templateId, owner);
    console.log('D: non-owner trying to delete someone else ranking → 403, nothing changed');
  } finally {
    await mf.dispose();
  }
}

// F: notifications ที่ผูก template/ranking ต้องถูกลบตาม FK โดยไม่พัง (no orphan rows)
async function testNotificationsCascade() {
  const { mf, db } = await createLocalD1();
  const owner = 'owner-F';
  const templateId = 'orphan-f-template';
  const rankingId = 'orphan-f-ranking';
  try {
    await seedProfile(db, owner);
    await seedTemplate(db, templateId, owner);
    await seedRanking(db, rankingId, owner, templateId);
    await db.prepare(`INSERT INTO notifications (id, user_id, actor_id, type, template_id, ranking_id)
      VALUES (?, ?, ?, ?, ?, ?)`)
      .bind('notif-f-1', owner, owner, 'template_use', templateId, rankingId).run();
    await db.prepare(`INSERT INTO notifications (id, user_id, actor_id, type, template_id)
      VALUES (?, ?, ?, ?, ?)`)
      .bind('notif-f-2', owner, owner, 'community_average', templateId).run();

    const result = await deleteRanking(db, rankingId, owner);
    assert.equal(result.response.status, 200);
    assert.equal(result.body.templateDeleted, true);
    assert.equal(await count(db, 'notifications'), 0, 'notifications must cascade-delete with template/ranking');
    console.log('F: notifications cascade-deleted with orphan template cleanup, no FK error');
  } finally {
    await mf.dispose();
  }
}

// scenario E ถูกเช็คใน A (ทุก dependency table ต้องว่าง) — seed dependencies ครบทุก table
async function seedTemplateDependencies(db, templateId, rankingId) {
  for (const user of ['viewer-E', 'reactor-E', 'tcommenter-E', 'tbookmarker-E', 'follow-E-1', 'reporter-E']) {
    await seedProfile(db, user);
  }
  await db.prepare(`INSERT INTO template_views (template_id, user_id) VALUES (?, ?)`)
    .bind(templateId, 'viewer-E').run();
  await db.prepare(`INSERT INTO template_reactions (id, template_id, user_id, vote_type) VALUES (?, ?, ?, ?)`)
    .bind('reaction-E-1', templateId, 'reactor-E', 'like').run();
  await db.prepare(`INSERT INTO template_comments (id, template_id, user_id, content) VALUES (?, ?, ?, ?)`)
    .bind('tcomment-E-1', templateId, 'tcommenter-E', 'great').run();
  await db.prepare(`INSERT INTO template_bookmarks (template_id, user_id) VALUES (?, ?)`)
    .bind(templateId, 'tbookmarker-E').run();
  await db.prepare(`INSERT INTO ranking_item_scores (id, ranking_id, template_id, item_id, tier_index, score)
    VALUES (?, ?, ?, ?, ?, ?)`)
    .bind('ris-E-1', rankingId, templateId, 'item-0', 0, 3).run();
  await db.prepare(`INSERT INTO topic_follows (user_id, topic_type, topic_key) VALUES (?, ?, ?)`)
    .bind('follow-E-1', 'template', templateId).run();
  await db.prepare(`INSERT INTO reports (id, template_id, ranking_id, reporter_id, reason) VALUES (?, ?, ?, ?, ?)`)
    .bind('report-E-1', templateId, rankingId, 'reporter-E', 'spam').run();
}

await testOwnerDeletesLastRanking();
await testOwnerDeletesKeepsTemplate();
await testNonOwnerDeletesOwnRanking();
await testDeleteSomeoneElsesRanking();
await testNotificationsCascade();

console.log('Ranking DELETE orphan-template regression checks passed against local Miniflare D1.');