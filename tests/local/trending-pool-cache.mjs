import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

import { onRequest as rankings } from '../../functions/api/rankings.js';
import {
  buildSharedHomeTrendingKey,
  buildTrendingPoolKey,
  isSharedHomeTrendingEligible,
  SHARED_HOME_TRENDING_TTL_SECONDS,
  TRENDING_POOL_CACHE_TTL_SECONDS,
} from '../../functions/lib/pool-cache.js';

const schema = await readFile(new URL('../../schema.sql', import.meta.url), 'utf8');
const schemaStatements = schema
  .split(/\r?\n/)
  .filter((line) => !line.trimStart().startsWith('--'))
  .join('\n')
  .split(';')
  .map((statement) => statement.trim())
  .filter(Boolean);

// Fake Cache API: honors the put response's max-age against a manual clock
// (so TTL expiry is deterministic — no real waiting except where the memory
// bridge uses wall time), returns FRESH Responses per match() like the real
// Cache API, records every match/put key, and can fail match/put or gate the
// first put behind a deferred release for race tests.
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function makeFakeCache({ failMatch = false, failPut = false, gateFirstPut = false } = {}) {
  const store = new Map();
  let now = Date.now();
  let releaseFirstPut = null;
  const firstPutGate = gateFirstPut ? new Promise((resolve) => { releaseFirstPut = resolve; }) : null;
  let puts = 0;
  const cache = {
    store,
    matchCalls: [],
    putCalls: [],
    advance(ms) { now += ms; },
    releaseFirstPut() { if (releaseFirstPut) releaseFirstPut(); },
    async match(request) {
      const key = new URL(request.url).search;
      cache.matchCalls.push(key);
      if (failMatch) throw new Error('simulated cache outage');
      const entry = store.get(key);
      if (!entry) return null;
      if (now > entry.expiresAt) {
        store.delete(key);
        return null;
      }
      return new Response(JSON.stringify({ ids: entry.ids, tiers: entry.tiers }), {
        headers: { 'Content-Type': 'application/json' },
      });
    },
    async put(request, response) {
      const key = new URL(request.url).search;
      cache.putCalls.push(key);
      if (failPut) throw new Error('simulated put failure');
      if (firstPutGate && puts++ === 0) await firstPutGate;
      const body = await response.json();
      const maxAge = /max-age=(\d+)/.exec(response.headers.get('Cache-Control') || '');
      store.set(key, { ids: body.ids, tiers: body.tiers, expiresAt: now + (maxAge ? Number(maxAge[1]) * 1000 : 60000) });
    },
  };
  return cache;
}

function isSharedKey(search) {
  return search.includes('shared-home-trending');
}

async function createSeededD1() {
  const mf = new Miniflare(convertV4MiniflareOptions({
    modules: true,
    script: 'export default { fetch() { return new Response("local test"); } }',
    compatibilityDate: '2026-01-01',
    d1Databases: ['DB'],
  }));
  const db = await mf.getD1Database('DB');
  await db.batch(schemaStatements.map((statement) => db.prepare(statement)));
  await db.batch([
    db.prepare(`INSERT INTO profiles (id, username, email) VALUES (?, ?, ?)`).bind('author1', 'Author One', 'author1@local.test'),
    db.prepare(`INSERT INTO profiles (id, username, email) VALUES (?, ?, ?)`).bind('author2', 'Author Two', 'author2@local.test'),
    db.prepare(`INSERT INTO profiles (id, username, email) VALUES (?, ?, ?)`).bind('userA', 'User A', 'usera@local.test'),
    db.prepare(`INSERT INTO profiles (id, username, email) VALUES (?, ?, ?)`).bind('userB', 'User B', 'userb@local.test'),
    db.prepare(`INSERT INTO follows (follower_id, following_id) VALUES (?, ?)`).bind('userA', 'author1'),
  ]);
  // 30 rankings: r_top dominates trending (recent + 100 likes). r02..r15 recent
  // with #gaming, r16..r30 old with #food. userA owns rA1 (for pin) and liked r_top.
  const inserts = [
    db.prepare(`INSERT INTO rankings (id, title, user_id, hashtags, likes_count, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))`).bind('r_top', 'Top post', 'author1', '#gaming', 100),
    db.prepare(`INSERT INTO rankings (id, title, user_id, hashtags, likes_count, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))`).bind('rA1', 'User A post', 'userA', '#gaming', 1),
  ];
  for (let i = 2; i <= 15; i += 1) {
    inserts.push(db.prepare(`INSERT INTO rankings (id, title, user_id, hashtags, likes_count, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))`).bind(`r${String(i).padStart(2, '0')}`, `Post ${i}`, i % 2 ? 'author1' : 'author2', '#gaming', 30 - i));
  }
  for (let i = 16; i <= 30; i += 1) {
    inserts.push(db.prepare(`INSERT INTO rankings (id, title, user_id, hashtags, likes_count, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now', '-100 days'))`).bind(`r${i}`, `Old ${i}`, 'author2', '#food', 1));
  }
  await db.batch(inserts);
  await db.prepare(`INSERT INTO votes (id, ranking_id, user_id, vote_type) VALUES (?, ?, ?, ?)`)
    .bind('voteA', 'r_top', 'userA', 'like').run();
  await db.prepare(`UPDATE rankings SET likes_count = likes_count + 1 WHERE id = ?`).bind('r_top').run();
  return { mf, db };
}

// Counts ONLY the candidate-pool SELECT (SELECT r.id, … AS freshness_tier
// FROM rankings r …). Slice (SELECT r.*, … IN), enrich, pin-ownership and
// fallback queries do not match this marker.
function countingDb(db, counter) {
  return {
    prepare(sql) {
      if (/freshness_tier FROM rankings r/.test(sql)) counter.pool += 1;
      return db.prepare(sql);
    },
    batch(statements) {
      return db.batch(statements);
    },
  };
}

async function callFeed(db, params, userId) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) query.set(key, String(value));
  }
  const response = await rankings({
    request: new Request(`https://local.test/api/rankings?${query.toString()}`, { method: 'GET' }),
    env: { tear_of_god_db: db, APP_ENV: 'local' },
    data: userId ? { user: { id: userId } } : {},
  });
  return { response, body: await response.json() };
}

const { mf, db: rawDb } = await createSeededD1();
const counter = { pool: 0 };
const db = countingDb(rawDb, counter);
const realCaches = globalThis.caches;
globalThis.caches = { default: makeFakeCache() };
try {
  const base = { feed_type: 'trending', seed: 777, limit: 12 };

  // CASE 1 — page 1, seed A: exactly one pool query.
  const p1 = await callFeed(db, { ...base, page: 1 }, null);
  assert.equal(p1.response.status, 200);
  assert.equal(p1.body.success, true);
  assert.equal(p1.body.data.length, 12);
  assert.equal(counter.pool, 1);
  const p1Ids = p1.body.data.map((row) => row.id);
  console.log('CASE 1 passed: page1 seed=A ran 1 pool query');

  // CASE 2 — page 2, same seed: no new pool query; disjoint slice, same session order.
  const p2 = await callFeed(db, { ...base, page: 2 }, null);
  assert.equal(p2.response.status, 200);
  assert.equal(p2.body.data.length, 12);
  assert.equal(counter.pool, 1);
  const p2Ids = p2.body.data.map((row) => row.id);
  assert.deepEqual(p2Ids.filter((id) => p1Ids.includes(id)), []);
  console.log('CASE 2 passed: page2 seed=A reused pool (still 1), disjoint slice');

  // CASE 3 — page 3, same seed: still no new pool query.
  const p3 = await callFeed(db, { ...base, page: 3 }, null);
  assert.equal(p3.response.status, 200);
  assert.equal(counter.pool, 1);
  console.log('CASE 3 passed: page3 seed=A reused pool (still 1)');

  // CASE 4 (Batch 4 behavior) — new seed within L2 TTL reuses the shared
  // raw pool (NO new pool query) but shuffles with its OWN seed, so the order
  // differs. This is the documented Batch 4 difference vs. Batch 3.
  const sharedMatchesBefore = globalThis.caches.default.matchCalls.filter(isSharedKey).length;
  const pB = await callFeed(db, { ...base, seed: 778, page: 1 }, null);
  assert.equal(pB.response.status, 200);
  assert.equal(counter.pool, 1, 'new seed must reuse the L2 shared pool');
  assert.ok(
    globalThis.caches.default.matchCalls.filter(isSharedKey).length > sharedMatchesBefore,
    'new seed must actually consult the L2 shared key',
  );
  assert.notDeepEqual(pB.body.data.map((row) => row.id), p1Ids, 'order must follow the new seed');
  console.log('CASE 4 passed: seed=B reused L2 pool (still 1), order reshuffled');

  // CASE 5 — same seed, different SQL-affecting filter: cache miss.
  const gaming = await callFeed(db, { ...base, page: 1, hashtag: 'gaming' }, null);
  assert.equal(gaming.response.status, 200);
  assert.equal(counter.pool, 2);
  assert.ok(gaming.body.data.length > 0);
  console.log('CASE 5 passed: same seed + different hashtag missed the cache');

  // CASE 6 — different exclude, same seed: NO new pool query (exclude is post-pool).
  const excl = await callFeed(db, { ...base, page: 1, exclude: p1Ids.join(',') }, null);
  assert.equal(counter.pool, 2);
  assert.ok(excl.body.data.length > 0);
  assert.deepEqual(excl.body.data.map((row) => row.id).filter((id) => p1Ids.includes(id)), []);
  console.log('CASE 6 passed: exclude variation reused pool, excluded ids absent');

  // CASE 6b — freshness buckets: shuffle must stay INSIDE a freshness tier.
  // Pool = 16 recent (r_top/rA1/r02..r15, tier ≤1h) + 15 old (r16..r30,
  // created -100d, tier older). Page 1 (12 cards) must contain ONLY recent ids
  // for ANY seed — a refresh can vary order within the hot bucket but must
  // never pull an old post up past fresh content.
  const freshSet = ['r_top', 'rA1', ...Array.from({ length: 14 }, (_, i) => `r${String(i + 2).padStart(2, '0')}`)];
  const page1a = await callFeed(db, { ...base, page: 1 }, null);
  assert.equal(counter.pool, 2, 'warm L1 must serve page1 for the same seed');
  assert.ok(page1a.body.data.every((row) => freshSet.includes(row.id)), 'page1 must be all fresh, not old');
  const page1b = await callFeed(db, { ...base, seed: 889, page: 1 }, null);
  assert.equal(counter.pool, 2, 'new seed must reuse the warm shared pool');
  assert.ok(page1b.body.data.every((row) => freshSet.includes(row.id)), 'new seed page1 must also be all fresh');
  assert.notDeepEqual(page1b.body.data.map((row) => row.id), page1a.body.data.map((row) => row.id), 'different seeds must vary order within the freshness bucket');
  console.log('CASE 6b passed: shuffle stays inside freshness buckets (old posts never rise above fresh)');

  // CASE 7 — different pin, same seed: NO new pool query; owned pin jumps first.
  const pinned = await callFeed(db, { ...base, page: 1, pin: 'rA1' }, 'userA');
  assert.equal(counter.pool, 2);
  assert.equal(pinned.body.data[0].id, 'rA1');
  console.log('CASE 7 passed: pin variation reused pool, owned pin first');

  // CASE 8 — cache outage: feed still answers via D1 fallback. Uses a filtered
  // request (unique key) so a warm memory bridge cannot mask the D1 fallback.
  globalThis.caches = { default: makeFakeCache({ failMatch: true }) };
  const outage = await callFeed(db, { feed_type: 'trending', seed: 999, limit: 12, page: 1, hashtag: 'food' }, null);
  assert.equal(outage.response.status, 200);
  assert.equal(outage.body.data.length, 12);
  assert.equal(counter.pool, 3);
  console.log('CASE 8 passed: cache match failure fell back to D1');
  globalThis.caches = { default: makeFakeCache() };

  // CASE 9 — same cached raw pool, two users: per-user fields stay correct, nothing leaks.
  // seed=0 skips the shuffle so r_top (100 likes, recent) is deterministically first.
  const userA = await callFeed(db, { feed_type: 'trending', seed: 0, limit: 5, page: 1 }, 'userA');
  const poolAfterA = counter.pool;
  const userB = await callFeed(db, { feed_type: 'trending', seed: 0, limit: 5, page: 1 }, 'userB');
  assert.equal(counter.pool, poolAfterA, 'second user must reuse the cached raw pool');
  assert.equal(userA.body.data[0].id, 'r_top');
  assert.equal(userB.body.data[0].id, 'r_top');
  assert.equal(userA.body.data[0].user_vote, 'like');
  assert.equal(userB.body.data[0].user_vote, null);
  assert.equal(userA.body.data[0].profile.is_following, true);
  assert.equal(userB.body.data[0].profile.is_following, false);
  console.log('CASE 9 passed: shared raw pool, per-user user_vote/is_following correct, no leak');

  // CASE 10 — for_you / following never touch the trending cache path.
  const beforeFY = counter.pool;
  await callFeed(db, { feed_type: 'for_you', seed: 4242, limit: 5, page: 1 }, null);
  await callFeed(db, { feed_type: 'for_you', seed: 4242, limit: 5, page: 2 }, null);
  assert.equal(counter.pool, beforeFY + 2, 'guest for_you must query the pool per page');
  const beforeF = counter.pool;
  await callFeed(db, { feed_type: 'following', seed: 4242, limit: 5, page: 1 }, 'userA');
  await callFeed(db, { feed_type: 'following', seed: 4242, limit: 5, page: 2 }, 'userA');
  assert.equal(counter.pool, beforeF + 2, 'following must query the pool per page');
  console.log('CASE 10 passed: for_you/following bypass the trending cache');

  // CASE 11 — cross-seed shared hit: seed B reuses seed A's raw pool via L2.
  // Fresh cache instance so L2 starts cold, plus a sleep so the wall-clock
  // memory bridge (global, 5s) is cold too — otherwise the bridge would
  // short-circuit and the single D1 populate below would not be attributable.
  globalThis.caches = { default: makeFakeCache() };
  await sleep(5500);
  const before11 = counter.pool;
  const sharedReads11 = globalThis.caches.default.matchCalls.filter(isSharedKey).length;
  const seedA = await callFeed(db, { feed_type: 'trending', seed: 5001, limit: 12, page: 1 }, null);
  assert.equal(counter.pool, before11 + 1);
  const seedB = await callFeed(db, { feed_type: 'trending', seed: 5002, limit: 12, page: 1 }, null);
  assert.equal(seedB.response.status, 200);
  assert.equal(counter.pool, before11 + 1, 'seed B must reuse the L2 shared pool');
  assert.ok(
    globalThis.caches.default.matchCalls.filter(isSharedKey).length > sharedReads11,
    'seed B must actually consult the L2 shared key',
  );
  const idsA = seedA.body.data.map((row) => row.id);
  const idsB = seedB.body.data.map((row) => row.id);
  assert.notDeepEqual(idsB, idsA, 'order must follow each request seed');
  console.log('CASE 11 passed: cross-seed L2 hit, per-seed order differs');

  // CASE 12 — seed B page 2: L1 hit, L2 not even consulted.
  const sharedReads12 = globalThis.caches.default.matchCalls.filter(isSharedKey).length;
  const seedBp2 = await callFeed(db, { feed_type: 'trending', seed: 5002, limit: 12, page: 2 }, null);
  assert.equal(seedBp2.response.status, 200);
  assert.equal(counter.pool, before11 + 1);
  assert.equal(
    globalThis.caches.default.matchCalls.filter(isSharedKey).length,
    sharedReads12,
    'L1 hit must not touch L2',
  );
  console.log('CASE 12 passed: seed-B page2 served from L1, L2 untouched');

  // CASE 23 — manual refresh semantics: new seed reshuffles the SAME candidate
  // set (limit 50 returns the whole pool, so the sorted sets must be equal
  // while the raw orders differ).
  const fullA = await callFeed(db, { feed_type: 'trending', seed: 5001, limit: 50, page: 1 }, null);
  const fullB = await callFeed(db, { feed_type: 'trending', seed: 5002, limit: 50, page: 1 }, null);
  const fullIdsA = fullA.body.data.map((row) => row.id);
  const fullIdsB = fullB.body.data.map((row) => row.id);
  assert.deepEqual([...fullIdsA].sort(), [...fullIdsB].sort(), 'same candidate set');
  assert.notDeepEqual(fullIdsB, fullIdsA, 'order reshuffled by the new seed');
  console.log('CASE 23 passed: refresh reshuffles the same L2 candidate set');

  // CASE 15 — user isolation across seeds sharing one raw pool (limit 50 so
  // r_top is always present to compare per-user fields on). L2 is already warm
  // from CASE 11, so both users together must add ZERO pool queries.
  const before15 = counter.pool;
  const a15 = await callFeed(db, { feed_type: 'trending', seed: 6001, limit: 50, page: 1 }, 'userA');
  const b15 = await callFeed(db, { feed_type: 'trending', seed: 6002, limit: 50, page: 1 }, 'userB');
  assert.equal(counter.pool, before15, 'both users share the warm L2 pool');
  const rowA = a15.body.data.find((row) => row.id === 'r_top');
  const rowB = b15.body.data.find((row) => row.id === 'r_top');
  assert.ok(rowA && rowB);
  assert.equal(rowA.user_vote, 'like');
  assert.equal(rowB.user_vote, null);
  assert.equal(rowA.profile.is_following, true);
  assert.equal(rowB.profile.is_following, false);
  // SECURITY: the serialized shared payload must be IDs only.
  {
    const l2key = `?k=${encodeURIComponent(buildSharedHomeTrendingKey({ poolCap: 600 }))}`;
    const entry = globalThis.caches.default.store.get(l2key);
    const stored = entry?.ids;
    assert.ok(Array.isArray(stored) && stored.length > 0, 'L2 must hold the shared id pool');
    assert.ok(stored.every((id) => typeof id === 'string'), 'L2 entries must be id strings');
    const storedTiers = entry?.tiers;
    assert.ok(
      Array.isArray(storedTiers) && storedTiers.length === stored.length
        && storedTiers.every((t) => Number.isInteger(t) && t >= 1 && t <= 5),
      'L2 must carry per-row freshness tiers aligned with the ids',
    );
    // SECURITY: the serialized shared payload must be ids + tiers only.
    const serialized = JSON.stringify({ ids: stored, tiers: storedTiers });
    for (const forbidden of ['user_id', 'email', 'cookie', 'session', 'user_vote', 'is_following', 'profile', 'username']) {
      assert.ok(!serialized.includes(`"${forbidden}"`), `L2 payload must not contain ${forbidden}`);
    }
  }
  // Authenticated responses stay explicitly private via the handler's own
  // header (unchanged code path — middleware additionally enforces it).
  assert.equal(a15.response.headers.get('Cache-Control'), 'private, no-store');
  console.log('CASE 15 passed: shared raw pool, per-user fields correct, no leak');

  // CASE 14 — filtered trending never reuses the shared Home L2 and only
  // returns its own category.
  const sharedReads14 = globalThis.caches.default.matchCalls.filter(isSharedKey).length;
  const before14 = counter.pool;
  const catRes = await callFeed(db, { feed_type: 'trending', seed: 777, limit: 12, page: 1, hashtag: 'gaming' }, null);
  assert.equal(catRes.response.status, 200);
  assert.equal(counter.pool, before14 + 1, 'filtered request must query its own pool');
  assert.ok(catRes.body.data.length > 0);
  assert.ok(catRes.body.data.every((row) => row.hashtags === '#gaming'), 'no cross-category rows');
  assert.equal(
    globalThis.caches.default.matchCalls.filter(isSharedKey).length,
    sharedReads14,
    'filtered request must not read the shared L2 key',
  );
  console.log('CASE 14 passed: filtered trending isolated from shared L2');

  // CASE 19/20 — for_you / following never read or write any pool cache keys.
  for (const params of [
    { feed_type: 'for_you', seed: 7001, limit: 5, page: 1 },
    { feed_type: 'following', seed: 7002, limit: 5, page: 1 },
  ]) {
    const fake = makeFakeCache();
    globalThis.caches = { default: fake };
    const before = counter.pool;
    const res = await callFeed(db, params, 'userA');
    assert.equal(res.response.status, 200);
    assert.equal(counter.pool, before + 1, `${params.feed_type} must query D1 directly`);
    assert.equal(fake.matchCalls.length, 0, `${params.feed_type} must not read pool cache`);
    assert.equal(fake.store.size, 0, `${params.feed_type} must not write pool cache`);
  }
  console.log('CASE 19/20 passed: for_you/following never touch pool cache');

  // CASE 17 — match outage on both layers: feed still answers via D1.
  globalThis.caches = { default: makeFakeCache({ failMatch: true }) };
  const before17 = counter.pool;
  const outage2 = await callFeed(db, { feed_type: 'trending', seed: 1717, limit: 12, page: 1, hashtag: 'food' }, null);
  assert.equal(outage2.response.status, 200);
  assert.equal(outage2.body.data.length, 12);
  assert.equal(counter.pool, before17 + 1, 'outage must fall back to D1');
  console.log('CASE 17 passed: L1/L2 match errors fall back to D1');

  // CASE 18 — put outage: current request still 200; failed writes are evicted
  // from the memory bridge so the next request truly falls back to D1.
  // Filtered key (fresh for this case) so no warm bridge can mask the fallback.
  globalThis.caches = { default: makeFakeCache({ failPut: true }) };
  const before18 = counter.pool;
  const putFail1 = await callFeed(db, { feed_type: 'trending', seed: 1818, limit: 12, page: 1, hashtag: 'food' }, null);
  assert.equal(putFail1.response.status, 200);
  assert.equal(putFail1.body.data.length, 12);
  assert.equal(counter.pool, before18 + 1);
  const putFail2 = await callFeed(db, { feed_type: 'trending', seed: 1818, limit: 12, page: 1, hashtag: 'food' }, null);
  assert.equal(putFail2.response.status, 200);
  assert.equal(counter.pool, before18 + 2, 'failed writes must not poison later requests');
  console.log('CASE 18 passed: put errors stay best-effort, next request falls back');
  globalThis.caches = { default: makeFakeCache() };

  // CASE 13 — L2 TTL expiry: advance the cache clock past 5s and let the
  // wall-clock memory bridge expire too; a new seed must query D1 again.
  const before13 = counter.pool;
  globalThis.caches.default.advance(6000);
  await sleep(5500);
  const afterExpiry = await callFeed(db, { feed_type: 'trending', seed: 1313, limit: 12, page: 1 }, null);
  assert.equal(afterExpiry.response.status, 200);
  assert.equal(counter.pool, before13 + 1, 'expired L2 must re-query D1');
  console.log('CASE 13 passed: L2 expiry re-queries D1');

  // CASE 16 — simultaneous new seeds share ONE D1 pool query via the L2-keyed
  // in-flight dedup. (L2 is cold again: CASE 13 repopulated it, so evict the
  // entry first — eviction is itself a specified fallback path — and the
  // memory bridge expired during the sleep above... except CASE 13 just
  // re-warmed it, so sleep once more to drain the bridge.)
  await sleep(5500);
  {
    const l2key = `?k=${encodeURIComponent(buildSharedHomeTrendingKey({ poolCap: 600 }))}`;
    globalThis.caches.default.store.delete(l2key);
  }
  const before16 = counter.pool;
  const [concA, concB] = await Promise.all([
    callFeed(db, { feed_type: 'trending', seed: 1601, limit: 12, page: 1 }, null),
    callFeed(db, { feed_type: 'trending', seed: 1602, limit: 12, page: 1 }, null),
  ]);
  assert.equal(concA.response.status, 200);
  assert.equal(concB.response.status, 200);
  assert.equal(counter.pool, before16 + 1, 'concurrent seeds must share one D1 pool query');
  console.log('CASE 16 passed: simultaneous seeds share one D1 query');

  // CASE 21 — delayed L1 put, same seed: page 2 arriving in the
  // post-D1/pre-put window must reuse the memory bridge (pool SQL stays 1).
  // Uses a filtered key so L2 cannot interfere either way.
  globalThis.caches = { default: makeFakeCache({ gateFirstPut: true }) };
  {
    const before21 = counter.pool;
    const reqA = callFeed(db, { feed_type: 'trending', seed: 2121, limit: 12, page: 1, hashtag: 'food' }, null);
    for (let i = 0; i < 500 && counter.pool < before21 + 1; i += 1) await sleep(10);
    assert.equal(counter.pool, before21 + 1, 'A pool query must have run');
    await sleep(300);
    const resB = await callFeed(db, { feed_type: 'trending', seed: 2121, limit: 12, page: 2 }, null);
    assert.equal(resB.response.status, 200);
    assert.equal(counter.pool, before21 + 1, 'B must reuse the bridge, not re-query');
    globalThis.caches.default.releaseFirstPut();
    const resA = await reqA;
    assert.equal(resA.response.status, 200);
    console.log('CASE 21 passed: delayed put race (same seed) reused bridge');
  }

  // CASE 22 — delayed L2 put, different seeds: seed B arriving while seed A's
  // L2 write is pending must reuse the shared bridge (pool SQL stays 1).
  // Cold state: sleep drains the wall-clock memory bridge and the gated
  // instance starts with an empty store, so A's D1 query is unavoidable.
  await sleep(5500);
  globalThis.caches = { default: makeFakeCache({ gateFirstPut: true }) };
  {
    const before22 = counter.pool;
    const reqA = callFeed(db, { feed_type: 'trending', seed: 2201, limit: 12, page: 1 }, null);
    for (let i = 0; i < 500 && counter.pool < before22 + 1; i += 1) await sleep(10);
    assert.equal(counter.pool, before22 + 1, 'A pool query must have run');
    await sleep(300);
    const resB = await callFeed(db, { feed_type: 'trending', seed: 2202, limit: 12, page: 1 }, null);
    assert.equal(resB.response.status, 200);
    assert.equal(counter.pool, before22 + 1, 'B must reuse the shared bridge, not re-query');
    globalThis.caches.default.releaseFirstPut();
    const resA = await reqA;
    assert.equal(resA.response.status, 200);
    console.log('CASE 22 passed: delayed put race (different seeds) reused bridge');
  }
  globalThis.caches = { default: makeFakeCache() };

  // Key/TTL/eligibility hygiene (unit-level).
  const l1Base = { feedType: 'trending', seed: 1, hashtag: null, authorId: null, templateId: null, days: 0, poolCap: 600 };
  const keyA = buildTrendingPoolKey(l1Base);
  // Seed is pinned (refresh safety); every SQL-affecting input changes the key.
  assert.notEqual(buildTrendingPoolKey({ ...l1Base, seed: 2 }), keyA);
  assert.notEqual(buildTrendingPoolKey({ ...l1Base, hashtag: 'gaming' }), keyA);
  assert.notEqual(buildTrendingPoolKey({ ...l1Base, hashtag: 'gaming' }), keyA);
  assert.notEqual(buildTrendingPoolKey({ ...l1Base, authorId: 'u1' }), keyA);
  assert.notEqual(buildTrendingPoolKey({ ...l1Base, templateId: 't1' }), keyA);
  assert.notEqual(buildTrendingPoolKey({ ...l1Base, days: 7 }), keyA);
  assert.notEqual(buildTrendingPoolKey({ ...l1Base, poolCap: 100 }), keyA);
  assert.ok(TRENDING_POOL_CACHE_TTL_SECONDS >= 60 && TRENDING_POOL_CACHE_TTL_SECONDS <= 600);
  assert.equal(TRENDING_POOL_CACHE_TTL_SECONDS, 60, 'trending pool cache TTL must stay 60s');
  // L2 eligibility mirrors the pool builder exactly.
  assert.equal(isSharedHomeTrendingEligible({ feedType: 'trending', hashtag: null, authorId: null, templateId: null, days: 0 }), true);
  assert.equal(isSharedHomeTrendingEligible({ feedType: 'trending', hashtag: '', authorId: null, templateId: null, days: 0 }), true);
  assert.equal(isSharedHomeTrendingEligible({ feedType: 'trending', hashtag: 'gaming', authorId: null, templateId: null, days: 0 }), false);
  assert.equal(isSharedHomeTrendingEligible({ feedType: 'trending', hashtag: 'g', authorId: null, templateId: null, days: 0 }), false);
  assert.equal(isSharedHomeTrendingEligible({ feedType: 'trending', hashtag: null, authorId: 'u', templateId: null, days: 0 }), false);
  assert.equal(isSharedHomeTrendingEligible({ feedType: 'trending', hashtag: null, authorId: null, templateId: 't', days: 0 }), false);
  assert.equal(isSharedHomeTrendingEligible({ feedType: 'trending', hashtag: null, authorId: null, templateId: null, days: 7 }), false);
  assert.equal(isSharedHomeTrendingEligible({ feedType: 'for_you', hashtag: null, authorId: null, templateId: null, days: 0 }), false);
  assert.equal(isSharedHomeTrendingEligible({ feedType: 'following', hashtag: null, authorId: null, templateId: null, days: 0 }), false);
  // L2 key carries no seed/user/page/pin/exclude; TTL is capped at 5s.
  const l2key = buildSharedHomeTrendingKey({ poolCap: 600 });
  assert.ok(!/\b\d{4,}\b/.test(l2key.replace('600', '')), 'L2 key must not embed seed-like values');
  assert.ok(SHARED_HOME_TRENDING_TTL_SECONDS <= 5, 'L2 TTL must not exceed 5s in this batch');
  console.log('Key/TTL/eligibility hygiene checks passed');

  console.log('Trending pool cache checks passed against local Miniflare D1.');
} finally {
  if (realCaches === undefined) delete globalThis.caches;
  else globalThis.caches = realCaches;
  await mf.dispose();
}
