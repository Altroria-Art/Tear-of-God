import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

import { onRequest as rankings } from '../../functions/api/rankings.js';
import * as seenLib from '../../src/lib/trendingSeen.js';

const HOUR = 60 * 60 * 1000;

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
  script: 'export default { fetch() { return new Response("trending fallback test"); } }',
  compatibilityDate: '2026-01-01',
  d1Databases: ['DB'],
}));
const db = await mf.getD1Database('DB');
await db.batch(schemaStatements.map((statement) => db.prepare(statement)));

const realCaches = globalThis.caches;
globalThis.caches = { default: makeFakeCache() };

async function feedIds({ feedType = 'trending', seed = 0, exclude = null, seen = null, userId = null, limit = 50, fresh = '1' }) {
  const query = new URLSearchParams({ feed_type: feedType, seed: String(seed), limit: String(limit) });
  if (exclude) query.set('exclude', exclude);
  if (seen) query.set('seen', seen);
  if (fresh) query.set('fresh', fresh);
  const response = await rankings({
    request: new Request(`https://local.test/api/rankings?${query.toString()}`, { method: 'GET' }),
    env: { tear_of_god_db: db, APP_ENV: 'local' },
    data: userId ? { user: { id: userId } } : {},
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.success, true);
  return (body.data || []).map((row) => row.id);
}

async function insertRanking({ id, userId = 'author1', createdMod, hashtags = '#test' }) {
  await db.prepare(`
    INSERT INTO rankings (id, title, user_id, hashtags, created_at, last_activity_at)
    VALUES (?, ?, ?, ?, datetime('now', '${createdMod}'), datetime('now', '${createdMod}'))
  `).bind(id, `Title ${id}`, userId, hashtags).run();
}

console.log('Testing Home Trending 4-Priority Order and Cooldown Fallback...');

try {
  await db.prepare('INSERT INTO profiles (id, username, email) VALUES (?, ?, ?)').bind('author1', 'Author 1', 'author1@test.com').run();

  // Setup rankings:
  // p1_unseen_fresh: <= 7d (created 2d ago), unseen
  // p2_unseen_mid:   8-30d (created 15d ago), unseen
  // p3_seen_fresh:   <= 7d (created 3d ago), seen 10h ago (cooldown passed)
  // p4_seen_mid:     8-30d (created 20d ago), seen 12h ago (cooldown passed)
  // recent_cooldown: <= 7d (created 1d ago), seen 1h ago (< 6h cooldown)
  // old_post_7m:      > 6 months (created 210d ago, must be strictly excluded)
  await insertRanking({ id: 'p1_unseen_fresh', createdMod: '-2 days' });
  await insertRanking({ id: 'p2_unseen_mid', createdMod: '-15 days' });
  await insertRanking({ id: 'p3_seen_fresh', createdMod: '-3 days' });
  await insertRanking({ id: 'p4_seen_mid', createdMod: '-20 days' });
  await insertRanking({ id: 'recent_cooldown', createdMod: '-1 day' });
  await insertRanking({ id: 'old_post_7m', createdMod: '-210 days' });

  const now = Date.now();
  const mockSeenEntries = [
    { id: 'recent_cooldown', seenAt: now - 1 * HOUR }, // < 6h: strictly excluded
    { id: 'p3_seen_fresh', seenAt: now - 10 * HOUR },  // >= 6h: fallback
    { id: 'p4_seen_mid', seenAt: now - 12 * HOUR },    // >= 6h: fallback
  ];

  // 1. Verify trendingSeenExclude only emits cooldown entries (< 6h)
  const excludeStr = seenLib.trendingSeenExclude(mockSeenEntries, 100, now);
  assert.equal(excludeStr, 'recent_cooldown', 'trendingSeenExclude must only contain recent_cooldown');

  // 2. Verify trendingSeenFallback only emits passed-cooldown entries (>= 6h)
  const fallbackStr = seenLib.trendingSeenFallback(mockSeenEntries, 100, now);
  assert.ok(fallbackStr.includes('p3_seen_fresh'));
  assert.ok(fallbackStr.includes('p4_seen_mid'));
  assert.ok(!fallbackStr.includes('recent_cooldown'));

  // -------------------------------------------------------------------------
  // Scenario 1: Strict 4-Priority Order
  // -------------------------------------------------------------------------
  console.log('Scenario 1: Verifying 4-Priority Order (Priority 1 -> 2 -> 3 -> 4)...');
  globalThis.caches.default = makeFakeCache();
  const ids = await feedIds({
    feedType: 'trending',
    exclude: excludeStr,
    seen: fallbackStr,
    fresh: '1',
  });

  // Verify recent_cooldown and old_post_7m are completely absent
  assert.ok(!ids.includes('recent_cooldown'), 'post seen < 6h must be strictly excluded');
  assert.ok(!ids.includes('old_post_7m'), 'post > 6 months must never be in trending');

  // Verify order:
  // Priority 1: p1_unseen_fresh (unseen + <= 7d)
  // Priority 2: p2_unseen_mid (unseen + 8-30d)
  // Priority 3: p3_seen_fresh (seen >=6h + <= 7d)
  // Priority 4: p4_seen_mid (seen >=6h + 8-30d)
  assert.deepEqual(ids, ['p1_unseen_fresh', 'p2_unseen_mid', 'p3_seen_fresh', 'p4_seen_mid']);
  console.log('✔ Scenario 1 passed: 4-Priority order is strictly respected!');

  // -------------------------------------------------------------------------
  // Scenario 2: Feed is NOT empty when unseen is exhausted (Fallback in action)
  // -------------------------------------------------------------------------
  console.log('Scenario 2: Verifying fallback prevents empty feed when unseen is exhausted...');
  // User has now also seen p1 and p2 8 hours ago
  const seenAllUnseen = [
    { id: 'p1_unseen_fresh', seenAt: now - 8 * HOUR },
    { id: 'p2_unseen_mid', seenAt: now - 8 * HOUR },
    { id: 'p3_seen_fresh', seenAt: now - 10 * HOUR },
    { id: 'p4_seen_mid', seenAt: now - 12 * HOUR },
    { id: 'recent_cooldown', seenAt: now - 1 * HOUR },
  ];

  const exclude2 = seenLib.trendingSeenExclude(seenAllUnseen, 100, now);
  const fallback2 = seenLib.trendingSeenFallback(seenAllUnseen, 100, now);

  globalThis.caches.default = makeFakeCache();
  const fallbackFeed = await feedIds({
    feedType: 'trending',
    exclude: exclude2,
    seen: fallback2,
    fresh: '1',
  });

  assert.ok(fallbackFeed.length > 0, 'Feed MUST NOT be empty when <=30d data exists and cooldown has passed');
  assert.deepEqual(
    fallbackFeed,
    ['p1_unseen_fresh', 'p3_seen_fresh', 'p2_unseen_mid', 'p4_seen_mid'],
    'Seen fallback posts are returned in age tier order (<=7d then 8-30d)',
  );
  console.log('✔ Scenario 2 passed: Fallback active, Home Trending is not empty and does not prematurely show "ดูครบแล้ว"!');

  // -------------------------------------------------------------------------
  // Scenario 3: "ดูครบแล้ว" (allSeen) ONLY when genuinely all <=30d are in <6h cooldown
  // -------------------------------------------------------------------------
  console.log('Scenario 3: Verifying "ดูครบแล้ว" only triggers when everything is in <6h cooldown...');
  const seenAllRecent = [
    { id: 'p1_unseen_fresh', seenAt: now - 30 * 60 * 1000 },
    { id: 'p2_unseen_mid', seenAt: now - 30 * 60 * 1000 },
    { id: 'p3_seen_fresh', seenAt: now - 30 * 60 * 1000 },
    { id: 'p4_seen_mid', seenAt: now - 30 * 60 * 1000 },
    { id: 'recent_cooldown', seenAt: now - 30 * 60 * 1000 },
  ];

  const exclude3 = seenLib.trendingSeenExclude(seenAllRecent, 100, now);
  const fallback3 = seenLib.trendingSeenFallback(seenAllRecent, 100, now);
  assert.equal(fallback3, '', 'No fallback posts available because all were seen < 6h ago');

  globalThis.caches.default = makeFakeCache();
  const emptyFeed = await feedIds({
    feedType: 'trending',
    exclude: exclude3,
    seen: fallback3,
    fresh: '1',
  });

  assert.deepEqual(emptyFeed, [], 'Feed is empty [] only when everything has been seen within 6h cooldown');
  console.log('✔ Scenario 3 passed: Empty feed (triggering "ดูครบแล้ว") occurs only when all <=30d posts are in 6h cooldown!');

  // -------------------------------------------------------------------------
  // Scenario 4: Client filterUnseenTrending allows fallback and filters cooldown/<30d
  // -------------------------------------------------------------------------
  console.log('Scenario 4: Verifying client-side filterUnseenTrending behavior...');
  const clientCandidates = [
    { id: 'c_fresh_unseen', created_at: '2026-09-22 10:00:00' },
    { id: 'c_seen_cooldown', created_at: '2026-09-22 10:00:00' },
    { id: 'c_seen_fallback', created_at: '2026-09-20 10:00:00' },
    { id: 'c_fallback_40d', created_at: '2026-08-01 10:00:00' },
    { id: 'c_old_7m', created_at: '2026-01-01 10:00:00' },
  ];
  const clientSeen = [
    { id: 'c_seen_cooldown', seenAt: now - 2 * HOUR },
    { id: 'c_seen_fallback', seenAt: now - 15 * HOUR },
  ];

  const filtered = seenLib.filterUnseenTrending(clientCandidates, clientSeen, [], now);
  const filteredIds = filtered.map((p) => p.id);

  assert.ok(filteredIds.includes('c_fresh_unseen'), 'unseen post is allowed');
  assert.ok(filteredIds.includes('c_seen_fallback'), 'seen fallback post (>=6h) is allowed through');
  assert.ok(filteredIds.includes('c_fallback_40d'), '2-month fallback post (<=180d) is allowed through');
  assert.ok(!filteredIds.includes('c_seen_cooldown'), 'post in 6h cooldown is filtered out');
  assert.ok(!filteredIds.includes('c_old_7m'), 'post older than 6 months is filtered out');
  console.log('✔ Scenario 4 passed: Client filter allows fallback posts while blocking cooldown & >6m posts!');

  // -------------------------------------------------------------------------
  // Scenario 5: 2–6 months old posts serve as fallback when primary runs out
  // -------------------------------------------------------------------------
  console.log('Scenario 5: Verifying 2–6 month old posts serve as fallback...');
  await insertRanking({ id: 'fb_post_60d', createdMod: '-60 days' });
  globalThis.caches.default = makeFakeCache();

  // Exclude all primary posts so primary pool is empty
  const allPrimaryExclude = ['p1_unseen_fresh', 'p2_unseen_mid', 'p3_seen_fresh', 'p4_seen_mid', 'recent_cooldown'].join(',');
  const fallbackOnlyFeed = await feedIds({
    feedType: 'trending',
    exclude: allPrimaryExclude,
    fresh: '1',
  });

  assert.ok(fallbackOnlyFeed.includes('fb_post_60d'), '2-month-old post is returned as fallback when primary posts are exhausted');
  assert.ok(!fallbackOnlyFeed.includes('old_post_7m'), 'post > 6 months is NEVER returned even as fallback');
  console.log('✔ Scenario 5 passed: 2–6 month old post serves as fallback, >6m strictly excluded!');

  console.log('\nAll Trending Seen Fallback & Priority tests PASSED successfully!');
} finally {
  if (realCaches === undefined) delete globalThis.caches;
  else globalThis.caches = realCaches;
  await mf.dispose();
}
