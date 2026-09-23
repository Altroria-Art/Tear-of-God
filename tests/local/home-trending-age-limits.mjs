import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

import { onRequest as rankings } from '../../functions/api/rankings.js';
import { onRequest as votes } from '../../functions/api/votes.js';
import { onRequest as comments } from '../../functions/api/comments.js';

const schema = await readFile(new URL('../../schema.sql', import.meta.url), 'utf8');
const schemaStatements = schema
  .split(/\r?\n/)
  .filter((line) => !line.trimStart().startsWith('--'))
  .join('\n')
  .split(';')
  .map((statement) => statement.trim())
  .filter(Boolean);

function makeFakeCache() {
  const store = new Map();
  return {
    store,
    async match(request) {
      const key = new URL(request.url).search;
      const entry = store.get(key);
      if (!entry) return null;
      return new Response(JSON.stringify({ ids: entry.ids, tiers: entry.tiers }), {
        headers: { 'Content-Type': 'application/json' },
      });
    },
    async put(request, response) {
      const key = new URL(request.url).search;
      const body = await response.json();
      store.set(key, { ids: body.ids, tiers: body.tiers });
    },
    async delete(request) {
      const key = new URL(request.url).search;
      return store.delete(key);
    },
  };
}

const mf = new Miniflare(convertV4MiniflareOptions({
  modules: true,
  script: 'export default { fetch() { return new Response("home trending test"); } }',
  compatibilityDate: '2026-01-01',
  d1Databases: ['DB'],
}));
const db = await mf.getD1Database('DB');
await db.batch(schemaStatements.map((statement) => db.prepare(statement)));

const realCaches = globalThis.caches;
globalThis.caches = { default: makeFakeCache() };

async function feedData({ feedType = 'trending', seed = 0, exclude = null, userId = null, limit = 50, fresh = '1' }) {
  const query = new URLSearchParams({ feed_type: feedType, seed: String(seed), limit: String(limit) });
  if (exclude) query.set('exclude', exclude);
  if (fresh) query.set('fresh', fresh);
  const response = await rankings({
    request: new Request(`https://local.test/api/rankings?${query.toString()}`, { method: 'GET' }),
    env: { tear_of_god_db: db, APP_ENV: 'local' },
    data: userId ? { user: { id: userId } } : {},
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.success, true);
  return body.data;
}

async function feedIds(options) {
  const data = await feedData(options);
  return data.map((row) => row.id);
}

async function vote(userId, rankingId, voteType) {
  const response = await votes({
    request: new Request('https://local.test/api/votes', {
      method: 'POST',
      body: JSON.stringify({ rankingId, voteType }),
    }),
    env: { tear_of_god_db: db },
    data: { user: { id: userId } },
  });
  return await response.json();
}

async function comment(userId, rankingId, text) {
  const response = await comments({
    request: new Request('https://local.test/api/comments', {
      method: 'POST',
      body: JSON.stringify({ ranking_id: rankingId, content: text }),
    }),
    env: { tear_of_god_db: db },
    data: { user: { id: userId } },
  });
  return await response.json();
}

async function insertRanking({ id, userId, hashtags = '#test', likes = 0, comments: cCount = 0, createdMod, lastMod = null }) {
  const createdExpr = `datetime('now', '${createdMod}')`;
  const lastExpr = lastMod !== null ? `datetime('now', '${lastMod}')` : createdExpr;
  await db.prepare(`
    INSERT INTO rankings (id, user_id, hashtags, likes_count, comments_count, created_at, last_activity_at)
    VALUES (?, ?, ?, ?, ?, ${createdExpr}, ${lastExpr})
  `).bind(id, userId, hashtags, likes, cCount).run();
}

try {
  console.log('Testing Home Trending Feed age limits and sorting...');

  // Setup test users
  await db.batch([
    db.prepare('INSERT INTO profiles (id, username, email) VALUES (?, ?, ?)').bind('author1', 'Author 1', 'author1@test.com'),
    db.prepare('INSERT INTO profiles (id, username, email) VALUES (?, ?, ?)').bind('author2', 'Author 2', 'author2@test.com'),
    db.prepare('INSERT INTO profiles (id, username, email) VALUES (?, ?, ?)').bind('viewer1', 'Viewer 1', 'viewer1@test.com'),
    db.prepare('INSERT INTO follows (follower_id, following_id) VALUES (?, ?)').bind('viewer1', 'author2'),
    db.prepare("INSERT INTO topic_follows (user_id, topic_type, topic_key) VALUES ('viewer1', 'hashtag', 'special')"),
  ]);

  // -------------------------------------------------------------------------
  // Scenario 1: Posts aged >6 months NEVER appear in Home Trending Feed
  // -------------------------------------------------------------------------
  console.log('Scenario 1: Verifying >6 month old posts are completely excluded from Trending...');
  await insertRanking({ id: 'old_7m', userId: 'author1', createdMod: '-210 days' });  // 7 months old (> 180 days)
  await insertRanking({ id: 'old_8m', userId: 'author1', createdMod: '-240 days' });  // 8 months old (> 180 days)
  await insertRanking({ id: 'old_1y', userId: 'author1', createdMod: '-365 days' });  // 1 year old (> 180 days)
  await insertRanking({ id: 'fresh_1h', userId: 'author1', createdMod: '-1 hour' });  // Fresh: 1 hour old

  let trending = await feedIds({ feedType: 'trending' });
  assert.ok(trending.includes('fresh_1h'), 'fresh post must appear in trending');
  assert.ok(!trending.includes('old_7m'), '7-month-old post must NOT appear in trending');
  assert.ok(!trending.includes('old_8m'), '8-month-old post must NOT appear in trending');
  assert.ok(!trending.includes('old_1y'), '1-year-old post must NOT appear in trending');
  console.log('✔ Scenario 1 passed: >6 month old posts are completely excluded from Trending Feed!');

  // -------------------------------------------------------------------------
  // Scenario 2: Old post (>6 months) CANNOT revive even with fresh like/comment
  // -------------------------------------------------------------------------
  console.log('Scenario 2: Verifying old post cannot revive despite fresh like and comment...');
  await vote('viewer1', 'old_7m', 'like');
  await comment('viewer1', 'old_7m', 'Brand new comment just now!');

  // Check that last_activity_at is updated
  const la = (await db.prepare('SELECT last_activity_at FROM rankings WHERE id = ?').bind('old_7m').first()).last_activity_at;
  assert.ok(la, 'last_activity_at should have been updated by vote/comment');

  // Clear fake cache and check trending again
  globalThis.caches.default = makeFakeCache();
  trending = await feedIds({ feedType: 'trending' });
  assert.ok(!trending.includes('old_7m'), '7-month-old post with new like/comment must STILL NOT appear in trending');
  console.log('✔ Scenario 2 passed: 7-month-old post did not revive in Trending despite fresh activity!');

  // -------------------------------------------------------------------------
  // Scenario 3: Age control - <= 7 days (priority) vs 8–30 days (fallback)
  // -------------------------------------------------------------------------
  console.log('Scenario 3: Verifying priority of <= 7 days over 8–30 days fallback...');
  // Post created 5 days ago (<= 7 days, priority), 0 likes
  await insertRanking({ id: 'prio_5d', userId: 'author1', createdMod: '-5 days', likes: 0 });
  // Post created 20 days ago (8–30 days, fallback), with 50 likes and activity 2 mins ago
  await insertRanking({ id: 'fall_20d', userId: 'author1', createdMod: '-20 days', lastMod: '-2 minutes', likes: 50 });

  globalThis.caches.default = makeFakeCache();
  trending = await feedIds({ feedType: 'trending' });
  const prioIdx = trending.indexOf('prio_5d');
  const fallIdx = trending.indexOf('fall_20d');
  assert.ok(prioIdx !== -1 && fallIdx !== -1, 'both 5d and 20d posts should be in pool');
  assert.ok(prioIdx < fallIdx, '5d post (<= 7 days) must rank above 20d post (8–30 days) despite 20d having 50 likes and recent activity');
  console.log('✔ Scenario 3 passed: <= 7 days post prioritized above 8–30 days post!');

  // -------------------------------------------------------------------------
  // Scenario 4: last_activity_at sorts WITHIN the same age group
  // -------------------------------------------------------------------------
  console.log('Scenario 4: Verifying last_activity_at sorts within the same age group...');
  // Age group 1 (<= 7 days):
  // g1_active created 6 days ago, activity 1 min ago
  // g1_stale created 2 days ago, activity 2 days ago
  await insertRanking({ id: 'g1_active', userId: 'author1', createdMod: '-6 days', lastMod: '-1 minutes' });
  await insertRanking({ id: 'g1_stale', userId: 'author1', createdMod: '-2 days', lastMod: '-2 days' });

  // Age group 2 (8–30 days):
  // g2_active created 25 days ago, activity 1 min ago
  // g2_stale created 10 days ago, activity 9 days ago
  await insertRanking({ id: 'g2_active', userId: 'author1', createdMod: '-25 days', lastMod: '-1 minutes' });
  await insertRanking({ id: 'g2_stale', userId: 'author1', createdMod: '-10 days', lastMod: '-9 days' });

  globalThis.caches.default = makeFakeCache();
  trending = await feedIds({ feedType: 'trending' });

  const idxG1Active = trending.indexOf('g1_active');
  const idxG1Stale = trending.indexOf('g1_stale');
  const idxG2Active = trending.indexOf('g2_active');
  const idxG2Stale = trending.indexOf('g2_stale');

  // Within group 1 (<= 7 days): active ranks before stale
  assert.ok(idxG1Active < idxG1Stale, 'within <=7d group: 6d post with 1m activity beats 2d post with 2d activity');

  // Within group 2 (8–30 days): active ranks before stale
  assert.ok(idxG2Active < idxG2Stale, 'within 8-30d group: 25d post with 1m activity beats 10d post with 9d activity');

  // Across groups: all group 1 posts rank before all group 2 posts
  assert.ok(idxG1Stale < idxG2Active, 'any <=7d post must rank before any 8-30d post');
  console.log('✔ Scenario 4 passed: last_activity_at sorts correctly within each age bracket!');

  // -------------------------------------------------------------------------
  // Scenario 5: Shuffling preserves age bracket priority (bucket tier safety)
  // -------------------------------------------------------------------------
  console.log('Scenario 5: Verifying shuffle never lifts 8–30d posts above <=7d posts...');
  for (const seed of [123, 4567, 891011]) {
    const shuffled = await feedIds({ feedType: 'trending', seed });
    const sG1Stale = shuffled.indexOf('g1_stale');
    const sG2Active = shuffled.indexOf('g2_active');
    assert.ok(sG1Stale < sG2Active, `seed ${seed}: <=7d post must stay ahead of 8-30d post`);
  }
  console.log('✔ Scenario 5 passed: seed shuffle respects age bracket boundary!');

  // -------------------------------------------------------------------------
  // Scenario 6: Seen filter & "ดูครบแล้ว" when pool is seen
  // -------------------------------------------------------------------------
  console.log('Scenario 6: Verifying seen filter and end-of-feed behavior...');
  // Collect all currently qualifying IDs
  const allValidIds = trending;
  assert.ok(allValidIds.length > 0);

  // If user has seen all qualifying IDs, feed must return empty [] rather than filling with >6 month posts!
  const seenExclude = allValidIds.join(',');
  const exhausted = await feedIds({ feedType: 'trending', exclude: seenExclude });
  assert.deepEqual(exhausted, [], 'when all valid posts are excluded/seen, trending must return [] (all seen)');
  assert.ok(!exhausted.includes('old_7m'), 'must NEVER backfill with >6 month post');
  assert.ok(!exhausted.includes('old_8m'), 'must NEVER backfill with >6 month post');
  console.log('✔ Scenario 6 passed: returns empty [] when unseen is exhausted (triggers "ดูครบแล้ว")!');

  // -------------------------------------------------------------------------
  // Scenario 7: For You & Following feeds are UNCHANGED
  // -------------------------------------------------------------------------
  console.log('Scenario 7: Verifying For You and Following feeds are not restricted to age limits...');
  await insertRanking({ id: 'old_following', userId: 'author2', createdMod: '-250 days' });
  await insertRanking({ id: 'old_foryou', userId: 'author1', hashtags: '#special', createdMod: '-250 days' });

  // Following feed for viewer1: should include old_following because viewer1 follows author2
  const following = await feedIds({ feedType: 'following', userId: 'viewer1' });
  assert.ok(following.includes('old_following'), 'following feed must still show older posts from followed users');

  // For You feed for viewer1: should include old_foryou because topic_key matches hashtag
  const forYou = await feedIds({ feedType: 'for_you', userId: 'viewer1' });
  assert.ok(forYou.includes('old_foryou'), 'for_you feed must still show older posts matching interest');
  console.log('✔ Scenario 7 passed: For You and Following feeds retain older posts without age restrictions!');

  console.log('\nAll Home Trending Feed age limit tests PASSED successfully!');
} finally {
  if (realCaches === undefined) delete globalThis.caches;
  else globalThis.caches = realCaches;
  await mf.dispose();
}
