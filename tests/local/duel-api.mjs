import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

import { onRequestPost as duelsPost, onRequestGet as duelsGet } from '../../functions/api/duels.js';
import { onRequest as apiMiddleware } from '../../functions/api/_middleware.js';

const schema = await readFile(new URL('../../schema.sql', import.meta.url), 'utf8');
const schemaStatements = schema
  .split(/\r?\n/)
  .filter((line) => !line.trimStart().startsWith('--'))
  .join('\n')
  .split(';')
  .map((statement) => statement.trim())
  .filter(Boolean);

async function createLocalD1() {
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: 'export default { fetch() { return new Response("local duel test"); } }',
      compatibilityDate: '2026-01-01',
      d1Databases: ['DB'],
    })
  );
  const db = await mf.getD1Database('DB');
  await db.batch(schemaStatements.map((statement) => db.prepare(statement)));
  return { mf, db };
}

async function callDuelEndpoint(db, { method = 'POST', body, url = 'http://localhost:8788/api/duels', user = null, useMiddleware = false } = {}) {
  const headers = {
    'CF-Connecting-IP': '127.0.0.42',
    'Origin': 'http://localhost:8788',
    'Sec-Fetch-Site': 'same-origin',
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const request = new Request(url, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const env = { tear_of_god_db: db };
  const context = {
    request,
    env,
    data: { user },
    next: () => {
      if (method === 'POST') return duelsPost(context);
      return duelsGet(context);
    },
  };

  if (useMiddleware) {
    const response = await apiMiddleware(context);
    const json = await response.json();
    return { response, json };
  }

  const response = method === 'POST' ? await duelsPost(context) : await duelsGet(context);
  const json = await response.json();
  return { response, json };
}

const { mf, db } = await createLocalD1();

console.log('--- Setting up Seed Data for Duel API Test ---');

// Create User A (Challenger), User B (Template Owner), and Users C, D, E (Community)
await db.batch([
  db.prepare("INSERT INTO profiles (id, username, email) VALUES ('user_a', 'alice', 'alice@test.com')"),
  db.prepare("INSERT INTO profiles (id, username, email) VALUES ('user_b', 'bob', 'bob@test.com')"),
  db.prepare("INSERT INTO profiles (id, username, email) VALUES ('user_c', 'charlie', 'charlie@test.com')"),
  db.prepare("INSERT INTO profiles (id, username, email) VALUES ('user_d', 'david', 'david@test.com')"),
  db.prepare("INSERT INTO profiles (id, username, email) VALUES ('user_e', 'eve', 'eve@test.com')"),
]);

const templateTiers = [
  { label: 'S', color: '#f87171' },
  { label: 'A', color: '#fdba74' },
  { label: 'B', color: '#fcd34d' },
  { label: 'C', color: '#4ade80' },
  { label: 'D', color: '#60a5fa' },
];

// Create Template owned by Bob (User B)
await db.prepare(`
  INSERT INTO templates (id, creator_id, title, description, hashtags, tiers, use_count)
  VALUES ('tpl_1', 'user_b', 'Best Anime 2026', 'Rank best anime', '#anime,#gaming', ?, 0)
`).bind(JSON.stringify(templateTiers)).run();

// Add template items
await db.batch([
  db.prepare("INSERT INTO template_items (id, template_id, item_id, tier, position) VALUES ('ti_1', 'tpl_1', 'anime_1', 'S', 0)"),
  db.prepare("INSERT INTO template_items (id, template_id, item_id, tier, position) VALUES ('ti_2', 'tpl_1', 'anime_2', 'A', 1)"),
  db.prepare("INSERT INTO template_items (id, template_id, item_id, tier, position) VALUES ('ti_3', 'tpl_1', 'anime_3', 'B', 2)"),
  db.prepare("INSERT INTO template_items (id, template_id, item_id, tier, position) VALUES ('ti_4', 'tpl_1', 'anime_4', 'C', 3)"),
]);

console.log('✓ Seed data ready');

console.log('\n--- 1. Testing Security & Authorization ---');

// Test 1: Unauthenticated request should be rejected (401)
{
  const { response, json } = await callDuelEndpoint(db, {
    method: 'POST',
    user: null,
    body: { template_id: 'tpl_1', items: [{ item_id: 'anime_1', tier: 'S' }] },
  });
  assert.equal(response.status, 401, 'Unauthenticated user must receive 401');
  assert.equal(json.success, false);
  console.log('✓ Unauthenticated request rejected with 401');
}

// Test 2: User B dueling their own template should be rejected (400)
{
  const { response, json } = await callDuelEndpoint(db, {
    method: 'POST',
    user: { id: 'user_b', username: 'bob' },
    body: {
      template_id: 'tpl_1',
      items: [{ item_id: 'anime_1', tier: 'S' }],
    },
  });
  assert.equal(response.status, 400);
  assert.match(json.error, /Cannot duel your own template/);
  console.log('✓ Self-duel rejected with 400');
}

// Test 3: Nonexistent template should return 404
{
  const { response, json } = await callDuelEndpoint(db, {
    method: 'POST',
    user: { id: 'user_a', username: 'alice' },
    body: {
      template_id: 'nonexistent_tpl',
      items: [{ item_id: 'anime_1', tier: 'S' }],
    },
  });
  assert.equal(response.status, 404);
  assert.match(json.error, /Template not found/);
  console.log('✓ Nonexistent template rejected with 404');
}

// Test 4: Invalid tier label should return 400
{
  const { response, json } = await callDuelEndpoint(db, {
    method: 'POST',
    user: { id: 'user_a', username: 'alice' },
    body: {
      template_id: 'tpl_1',
      items: [{ item_id: 'anime_1', tier: 'UNKNOWN_TIER' }],
    },
  });
  assert.equal(response.status, 400);
  assert.match(json.error, /unknown tier/i);
  console.log('✓ Unknown tier rejected with 400');
}

console.log('\n--- 2. Testing Successful Duel & Similarity Calculation ---');

// Test 5: Alice duels Bob's template with identical placements (anime_1=S, anime_2=A, anime_3=B, anime_4=C)
let createdDuelId = null;
{
  const { response, json } = await callDuelEndpoint(db, {
    method: 'POST',
    user: { id: 'user_a', username: 'alice' },
    body: {
      template_id: 'tpl_1',
      items: [
        { item_id: 'anime_1', tier: 'S', position: 0 },
        { item_id: 'anime_2', tier: 'A', position: 1 },
        { item_id: 'anime_3', tier: 'B', position: 2 },
        { item_id: 'anime_4', tier: 'C', position: 3 },
      ],
      title: 'Alice anime tier list',
    },
  });

  assert.equal(response.status, 201);
  assert.equal(json.success, true);
  assert.ok(json.data.id);
  createdDuelId = json.data.id;
  assert.equal(json.data.challenger_id, 'user_a');
  assert.equal(json.data.owner_id, 'user_b');
  assert.equal(json.data.template_id, 'tpl_1');
  assert.equal(json.data.similarity_score, 100, 'Identical placement must give 100% similarity');
  // Community sample count was 0 (no other users yet), so community similarity must be null
  assert.equal(json.data.community_similarity_score, null);
  assert.equal(json.data.community_sample_count, 0);

  // Verify DB entries
  const duelRow = await db.prepare('SELECT * FROM duels WHERE id = ?').bind(createdDuelId).first();
  assert.ok(duelRow);
  assert.equal(duelRow.similarity_score, 100);

  const rankingRow = await db.prepare('SELECT * FROM rankings WHERE id = ?').bind(json.data.ranking_id).first();
  assert.ok(rankingRow);
  assert.equal(rankingRow.user_id, 'user_a');
  assert.equal(rankingRow.template_id, 'tpl_1');

  // Verify notification was created for Bob (Owner)
  const notification = await db.prepare(
    "SELECT * FROM notifications WHERE user_id = 'user_b' AND type = 'duel'"
  ).first();
  assert.ok(notification, 'Bob must receive a duel notification');
  assert.equal(notification.actor_id, 'user_a');
  assert.equal(notification.template_id, 'tpl_1');

  console.log('✓ Successful duel submission with 100% match & notification created');
}

console.log('\n--- 3. Testing GET /api/duels ---');

// Test 6: Fetch single duel by ID
{
  const { response, json } = await callDuelEndpoint(db, {
    method: 'GET',
    url: `http://localhost:8788/api/duels?id=${createdDuelId}`,
  });
  assert.equal(response.status, 200);
  assert.equal(json.success, true);
  assert.equal(json.data.id, createdDuelId);
  assert.equal(json.data.similarity_score, 100);
  assert.equal(json.data.challenger.username, 'alice');
  assert.equal(json.data.owner.username, 'bob');
  assert.equal(json.data.template.title, 'Best Anime 2026');
  assert.equal(json.data.comparison.total_items, 4);
  assert.equal(json.data.comparison.matched_items, 4);
  console.log('✓ GET /api/duels?id= retrieves duel details & comparison breakdown');
}

// Test 7: Fetch user duel history
{
  const { response, json } = await callDuelEndpoint(db, {
    method: 'GET',
    url: 'http://localhost:8788/api/duels?user_id=user_a&page=1&limit=10',
  });
  assert.equal(response.status, 200);
  assert.equal(json.success, true);
  assert.equal(json.total, 1);
  assert.equal(json.data.length, 1);
  assert.equal(json.data[0].id, createdDuelId);
  console.log('✓ GET /api/duels?user_id= lists paginated duel history');
}

console.log('\n--- 4. Testing Community Average Similarity ---');

// Seed 3 community rankings from Charlie, David, Eve
for (const [userId, t1, t2, t3, t4] of [
  ['user_c', 'S', 'A', 'B', 'C'],
  ['user_d', 'S', 'A', 'B', 'C'],
  ['user_e', 'S', 'A', 'B', 'C'],
]) {
  const rId = `r_${userId}`;
  await db.batch([
    db.prepare("INSERT INTO rankings (id, template_id, user_id, title) VALUES (?, 'tpl_1', ?, 'Rank')").bind(rId, userId),
    db.prepare("INSERT INTO ranking_items (id, ranking_id, item_id, tier, position) VALUES (?, ?, 'anime_1', ?, 0)").bind(`ri_1_${userId}`, rId, t1),
    db.prepare("INSERT INTO ranking_items (id, ranking_id, item_id, tier, position) VALUES (?, ?, 'anime_2', ?, 1)").bind(`ri_2_${userId}`, rId, t2),
    db.prepare("INSERT INTO ranking_items (id, ranking_id, item_id, tier, position) VALUES (?, ?, 'anime_3', ?, 2)").bind(`ri_3_${userId}`, rId, t3),
    db.prepare("INSERT INTO ranking_items (id, ranking_id, item_id, tier, position) VALUES (?, ?, 'anime_4', ?, 3)").bind(`ri_4_${userId}`, rId, t4),
  ]);
}

// Now Alice duels again (or Eve duels Bob), community has 3 valid submissions (user_c, user_d, user_e)
{
  const { response, json } = await callDuelEndpoint(db, {
    method: 'POST',
    user: { id: 'user_a', username: 'alice' },
    body: {
      template_id: 'tpl_1',
      items: [
        { item_id: 'anime_1', tier: 'S', position: 0 },
        { item_id: 'anime_2', tier: 'A', position: 1 },
        { item_id: 'anime_3', tier: 'B', position: 2 },
        { item_id: 'anime_4', tier: 'C', position: 3 },
      ],
    },
  });

  assert.equal(response.status, 201);
  assert.equal(json.data.similarity_score, 100);
  assert.ok(json.data.community_sample_count >= 3);
  assert.equal(json.data.community_similarity_score, 100, 'Matches 100% of community when placements align');
  console.log('✓ Community Average similarity computed with sample count >= 3');
}

console.log('\n--- 5. Testing Client Spoofing Prevention ---');

// Test: Client attempts to send fake similarity_score: 99 and fake owner_id: 'fake_user'
{
  const { response, json } = await callDuelEndpoint(db, {
    method: 'POST',
    user: { id: 'user_e', username: 'eve' },
    body: {
      template_id: 'tpl_1',
      owner_id: 'fake_user_attempt',
      similarity_score: 99,
      community_similarity_score: 99,
      // Opposite placement from Bob: anime_1=D, anime_2=D, anime_3=D, anime_4=D
      items: [
        { item_id: 'anime_1', tier: 'D', position: 0 },
        { item_id: 'anime_2', tier: 'D', position: 1 },
        { item_id: 'anime_3', tier: 'D', position: 2 },
        { item_id: 'anime_4', tier: 'D', position: 3 },
      ],
    },
  });

  assert.equal(response.status, 201);
  // Owner must be Bob (from DB), NOT fake_user_attempt
  assert.equal(json.data.owner_id, 'user_b');
  // Similarity score must NOT be 99, it must be the real server-computed score!
  assert.notEqual(json.data.similarity_score, 99);
  assert.equal(json.data.similarity_score, 38); // Real calculated distance: round((1 - 0.625) * 100) = 38
  console.log('✓ Client spoofed owner_id and similarity_score ignored; computed server-side');
}

console.log('\nAll Duel API integration tests passed successfully!');
await mf.dispose();
