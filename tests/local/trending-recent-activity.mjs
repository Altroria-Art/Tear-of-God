import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Minimal Cache API fake: honors the put response's max-age against a manual
// clock, records keys, returns fresh Responses per match(). A fresh instance is
// installed between mutation-then-re-read scenarios so L1/L2 never leak; the
// module-level memory bridge (5s wall clock) is drained with sleeps.
function makeFakeCache() {
  const store = new Map();
  const matchCalls = [];
  const putCalls = [];
  let now = Date.now();
  return {
    store,
    matchCalls,
    putCalls,
    async match(request) {
      const key = new URL(request.url).search;
      matchCalls.push(key);
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
      putCalls.push(key);
      const body = await response.json();
      const maxAge = /max-age=(\d+)/.exec(response.headers.get('Cache-Control') || '');
      store.set(key, { ids: body.ids, tiers: body.tiers, expiresAt: now + (maxAge ? Number(maxAge[1]) * 1000 : 60000) });
    },
  };
}

const mf = new Miniflare(convertV4MiniflareOptions({
  modules: true,
  script: 'export default { fetch() { return new Response("trending recent activity test"); } }',
  compatibilityDate: '2026-01-01',
  d1Databases: ['DB'],
}));
const db = await mf.getD1Database('DB');
await db.batch(schemaStatements.map((statement) => db.prepare(statement)));

const realCaches = globalThis.caches;
globalThis.caches = { default: makeFakeCache() };

async function feedIds({ feedType = 'trending', seed = 0, hashtag, userId = null, limit = 50 }) {
  const query = new URLSearchParams({ feed_type: feedType, seed: String(seed), limit: String(limit) });
  if (hashtag) query.set('hashtag', hashtag);
  const response = await rankings({
    request: new Request(`https://local.test/api/rankings?${query.toString()}`, { method: 'GET' }),
    env: { tear_of_god_db: db, APP_ENV: 'local' },
    data: userId ? { user: { id: userId } } : {},
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.success, true);
  return body.data.map((row) => row.id);
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
  const body = await response.json();
  assert.equal(response.status, 200, `vote ${voteType} on ${rankingId} failed: ${body.error || ''}`);
  return body;
}

async function comment(userId, rankingId, content, parentId = null) {
  const payload = { ranking_id: rankingId, content };
  if (parentId) payload.parent_id = parentId;
  const response = await comments({
    request: new Request('https://local.test/api/comments', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
    env: { tear_of_god_db: db },
    data: { user: { id: userId } },
  });
  const body = await response.json();
  assert.equal(response.status, 201, `comment on ${rankingId} failed: ${body.error || ''}`);
  return body.data;
}

const lastActivity = async (id) =>
  (await db.prepare('SELECT last_activity_at AS la FROM rankings WHERE id = ?').bind(id).first()).la;

// "~now" for the second-granularity UTC strings D1 stores.
const isRecent = (la, withinSeconds = 120) => {
  const stored = Date.parse(la.replace(' ', 'T') + 'Z') / 1000;
  const now = Date.now() / 1000;
  return Math.abs(now - stored) <= withinSeconds;
};

// createdMod/lastMod are SQL datetime modifiers ('-2 minutes', '-20 days');
// lastFixed is a literal UTC string; lastFixed:null means an explicit NULL
// (pre-migration-style row). last_activity_at defaults to created_at.
async function insertRanking({ id, user, hashtag, likes = 0, comments: commentCount = 0, dislikes = 0, createdMod, lastMod = null, lastFixed }) {
  const createdExpr = `datetime('now', '${createdMod}')`;
  let lastExpr = createdExpr;
  if (lastMod !== null) lastExpr = `datetime('now', '${lastMod}')`;
  if (lastFixed !== undefined) lastExpr = lastFixed === null ? 'NULL' : `'${lastFixed}'`;
  await db.prepare(
    `INSERT INTO rankings (id, user_id, hashtags, likes_count, comments_count, dislikes_count, created_at, last_activity_at)
     VALUES (?, ?, ?, ?, ?, ?, ${createdExpr}, ${lastExpr})`,
  ).bind(id, user, `#${hashtag}`, likes, commentCount, dislikes).run();
}

try {
  // -------------------------------------------------------------------------
  // Fixture users (FKs on rankings/votes/comments are enforced).
  // -------------------------------------------------------------------------
  await db.batch([
    db.prepare('INSERT INTO profiles (id, username, email) VALUES (?, ?, ?)').bind('authorA', 'Author A', 'authora@local.test'),
    db.prepare('INSERT INTO profiles (id, username, email) VALUES (?, ?, ?)').bind('userA', 'User A', 'usera@local.test'),
    db.prepare('INSERT INTO profiles (id, username, email) VALUES (?, ?, ?)').bind('userB', 'User B', 'userb@local.test'),
    db.prepare("INSERT INTO topic_follows (user_id, topic_type, topic_key) VALUES ('userA', 'hashtag', 'hh')"),
    db.prepare("INSERT INTO follows (follower_id, following_id) VALUES ('userA', 'authorA')"),
  ]);

  // -------------------------------------------------------------------------
  // A — fresh 0/0 vs 20d-old 100-like accumulation. Fresh must win: the capped
  // engagement addend (min(likes,50)) can never outrank the freshness ceiling,
  // so a dead post cannot sit on top by accumulated likes alone.
  // -------------------------------------------------------------------------
  await insertRanking({ id: 'a1', user: 'authorA', hashtag: 'aa', createdMod: '-2 minutes' });
  await insertRanking({ id: 'a2', user: 'authorA', hashtag: 'aa', likes: 100, createdMod: '-20 days' });
  assert.deepEqual(await feedIds({ hashtag: 'aa' }), ['a1', 'a2']);
  console.log('A passed: fresh 0/0 ranks above 20d 100-like accumulation');

  // -------------------------------------------------------------------------
  // B — an old ranking with a RECENT like (via the votes handler, which bumps
  // last_activity_at) rises above a stale high-like post.
  // -------------------------------------------------------------------------
  await insertRanking({ id: 'b1', user: 'authorA', hashtag: 'bb', likes: 5, createdMod: '-10 days' });
  await insertRanking({ id: 'b2', user: 'authorA', hashtag: 'bb', likes: 60, createdMod: '-20 days' });
  const bBefore = await feedIds({ hashtag: 'bb' });
  assert.ok(bBefore.indexOf('b2') < bBefore.indexOf('b1'), 'stale high-likes lead before the like');
  await vote('userA', 'b1', 'like');
  assert.ok(isRecent(await lastActivity('b1')), 'like must bump last_activity_at to now');
  await sleep(5500);
  globalThis.caches = { default: makeFakeCache() };
  const bAfter = await feedIds({ hashtag: 'bb' });
  assert.ok(bAfter.indexOf('b1') < bAfter.indexOf('b2'), 'recently-liked old post must lead');
  console.log(`B passed: recent like lifts old ranking above stale high-likes (${bBefore.join(',')} -> ${bAfter.join(',')})`);

  // -------------------------------------------------------------------------
  // C — a RECENT comment lifts similarly, and replies bump too (see G).
  // -------------------------------------------------------------------------
  await insertRanking({ id: 'c1', user: 'authorA', hashtag: 'cc', comments: 3, createdMod: '-20 days' });
  await insertRanking({ id: 'c2', user: 'authorA', hashtag: 'cc', likes: 80, createdMod: '-30 days' });
  const cBefore = await feedIds({ hashtag: 'cc' });
  assert.ok(cBefore.indexOf('c2') < cBefore.indexOf('c1'), 'stale high-likes lead before the comment');
  await comment('userA', 'c1', 'bump me');
  assert.ok(isRecent(await lastActivity('c1')), 'comment must bump last_activity_at to now');
  await sleep(5500);
  globalThis.caches = { default: makeFakeCache() };
  const cAfter = await feedIds({ hashtag: 'cc' });
  assert.ok(cAfter.indexOf('c1') < cAfter.indexOf('c2'), 'recently-commented old post must lead');
  console.log(`C passed: recent comment lifts old ranking above stale high-likes (${cBefore.join(',')} -> ${cAfter.join(',')})`);

  // -------------------------------------------------------------------------
  // D — 7d+/inactive high-like posts fall below active low-engagement posts.
  // -------------------------------------------------------------------------
  await insertRanking({ id: 'd1', user: 'authorA', hashtag: 'dd', likes: 60, createdMod: '-30 days' });
  await insertRanking({ id: 'd2', user: 'authorA', hashtag: 'dd', createdMod: '-1 hours' });
  await insertRanking({ id: 'd3', user: 'authorA', hashtag: 'dd', likes: 8, createdMod: '-2 hours' });
  const dOrder = await feedIds({ hashtag: 'dd' });
  assert.ok(dOrder.indexOf('d1') > dOrder.indexOf('d2'), 'fresh 0/0 must outrank the inactive 60-like post');
  assert.ok(dOrder.indexOf('d1') > dOrder.indexOf('d3'), '2h 8-like post must outrank the inactive 60-like post');
  console.log(`D passed: active posts rank above 30d-inactive 60-like post (${dOrder.join(',')})`);

  // -------------------------------------------------------------------------
  // E — like then unlike: the unlike must NOT refresh last_activity_at.
  // -------------------------------------------------------------------------
  await insertRanking({ id: 'e1', user: 'authorA', hashtag: 'ee', createdMod: '-30 days', lastFixed: '2020-01-01 00:00:00' });
  await vote('userA', 'e1', 'like');
  const afterLike = await lastActivity('e1');
  assert.ok(isRecent(afterLike), 'like must refresh');
  await vote('userA', 'e1', null); // unlike
  assert.equal(await lastActivity('e1'), afterLike, 'unlike must leave last_activity_at untouched');
  console.log('E passed: unlike does not refresh activity');

  // -------------------------------------------------------------------------
  // F — dislike does NOT refresh; dislike->like transition DOES refresh.
  // -------------------------------------------------------------------------
  await insertRanking({ id: 'f1', user: 'authorA', hashtag: 'ff', createdMod: '-30 days', lastFixed: '2020-01-01 00:00:00' });
  await vote('userA', 'f1', 'dislike');
  assert.equal(await lastActivity('f1'), '2020-01-01 00:00:00', 'dislike must not touch last_activity_at');
  await vote('userA', 'f1', 'like'); // transition dislike -> like
  assert.ok(isRecent(await lastActivity('f1')), 'dislike->like transition must refresh');
  console.log('F passed: dislike inert, dislike->like transition refreshes');

  // -------------------------------------------------------------------------
  // G — both a top-level comment and a reply to an existing comment refresh.
  // -------------------------------------------------------------------------
  await insertRanking({ id: 'g1', user: 'authorA', hashtag: 'gg', createdMod: '-10 days', lastFixed: '2020-01-01 00:00:00' });
  await db.prepare("INSERT INTO comments (id, ranking_id, user_id, content) VALUES ('g-parent', 'g1', 'userB', 'root')").run();
  const reply = await comment('userA', 'g1', 'a reply', 'g-parent');
  assert.ok(reply.parent_id === 'g-parent', 'reply must attach to the parent comment');
  assert.ok(isRecent(await lastActivity('g1')), 'reply must refresh last_activity_at');
  await insertRanking({ id: 'g2', user: 'authorA', hashtag: 'gg', createdMod: '-10 days', lastFixed: '2020-01-01 00:00:00' });
  await comment('userB', 'g2', 'plain comment');
  assert.ok(isRecent(await lastActivity('g2')), 'top-level comment must refresh last_activity_at');
  console.log('G passed: comment and reply both refresh activity');

  // -------------------------------------------------------------------------
  // H — for_you / following keep created_at DESC (unchanged), while trending
  // ranks a recently-active post above a newer-but-stale one.
  // -------------------------------------------------------------------------
  await insertRanking({ id: 'h-old-active', user: 'authorA', hashtag: 'hh', likes: 3, createdMod: '-20 days', lastMod: '-2 minutes' });
  await insertRanking({ id: 'h-new-stale', user: 'authorA', hashtag: 'hh', createdMod: '-1 hours' });
  const hTrending = await feedIds({ hashtag: 'hh' });
  assert.ok(hTrending.indexOf('h-new-stale') < hTrending.indexOf('h-old-active'), 'trending must rank fresh-creation first (age_tier)');
  const hForYou = await feedIds({ feedType: 'for_you', userId: 'userA' });
  assert.ok(hForYou.indexOf('h-new-stale') < hForYou.indexOf('h-old-active'), 'for_you must keep created_at DESC');
  const hFollowing = await feedIds({ feedType: 'following', userId: 'userA' });
  assert.ok(hFollowing.indexOf('h-new-stale') < hFollowing.indexOf('h-old-active'), 'following must keep created_at DESC');
  console.log(`H passed: trending by activity (${hTrending.join(',')}); for_you / following by created_at`);

  // -------------------------------------------------------------------------
  // I — NULL last_activity_at (pre-migration / not-yet-backfilled rows) ranks
  // by created_at via the COALESCE fallback, and the 0019 migration text is
  // the plain ALTER + backfill (no DEFAULT CURRENT_TIMESTAMP, which SQLite
  // rejects on a non-empty table).
  // -------------------------------------------------------------------------
  await insertRanking({ id: 'i1', user: 'authorA', hashtag: 'ii', createdMod: '-2 hours', lastFixed: null });
  await insertRanking({ id: 'i2', user: 'authorA', hashtag: 'ii', createdMod: '-5 hours', lastFixed: null });
  const iOrder = await feedIds({ hashtag: 'ii' });
  assert.ok(iOrder.indexOf('i1') < iOrder.indexOf('i2'), 'NULL rows rank by created_at via COALESCE');
  const migration = await readFile(new URL('../../migrations-active/0019_add_ranking_last_activity.sql', import.meta.url), 'utf8');
  assert.match(migration, /ALTER TABLE rankings ADD COLUMN last_activity_at DATETIME/i);
  assert.match(migration, /UPDATE rankings SET last_activity_at = created_at WHERE last_activity_at IS NULL/i);
  assert.doesNotMatch(
    migration.split('\n').filter((l) => /ALTER TABLE/.test(l)).join(' '),
    /DEFAULT CURRENT_TIMESTAMP/i,
    '0019 must not add a DEFAULT to the ADD COLUMN (rejected on non-empty tables)',
  );
  console.log('I passed: NULL last_activity falls back to created_at; migration is plain ALTER + backfill');

  // -------------------------------------------------------------------------
  // J — the requirement's test pool A–E. Recency must dominate page 1 even
  // when an old post carries 100 likes, across EVERY freshness gate:
  //   A fresh-create (created 5m, activity 5m, 0/0)
  //   B fresh-like   (created 20d, activity 2m)
  //   C fresh-comment(created 30d, activity 1m)
  //   D medium       (activity 10h)
  //   E stale-popular(created 30d, activity 10d, 100 likes)
  // Page 1 must show A/B/C ahead of E; D (10h) must also outrank E (10d).
  // A refresh (seed>0) must preserve that: bucket shuffle never lifts E above
  // the fresh tier, and the candidate set is unchanged.
  // -------------------------------------------------------------------------
  await insertRanking({ id: 'j-a-fresh', user: 'authorA', hashtag: 'jj', createdMod: '-5 minutes' });
  await insertRanking({ id: 'j-b-like', user: 'authorA', hashtag: 'jj', likes: 1, createdMod: '-20 days', lastMod: '-2 minutes' });
  await insertRanking({ id: 'j-c-comment', user: 'authorA', hashtag: 'jj', likes: 10, createdMod: '-30 days', lastMod: '-1 minutes' });
  await insertRanking({ id: 'j-d-medium', user: 'authorA', hashtag: 'jj', createdMod: '-2 days', lastMod: '-10 hours' });
  await insertRanking({ id: 'j-e-stale', user: 'authorA', hashtag: 'jj', likes: 100, createdMod: '-30 days', lastMod: '-10 days' });
  const freshIds = ['j-a-fresh', 'j-b-like', 'j-c-comment'];
  const jOrders = [];
  for (const seed of [0, 314159]) {
    const order = await feedIds({ hashtag: 'jj', seed, limit: 20 });
    assert.equal(order.length, 5, `J seed ${seed}: all five pool posts must be returned`);
    for (const fresh of freshIds) {
      assert.ok(order.indexOf(fresh) < order.indexOf('j-e-stale'), `J seed ${seed}: ${fresh} must beat stale 100-like post E`);
    }
    assert.ok(order.indexOf('j-d-medium') < order.indexOf('j-e-stale'), `J seed ${seed}: 10h activity D must beat 10d-silent 100-like post E`);
    jOrders.push(order);
  }
  assert.deepEqual([...jOrders[0]].sort(), [...jOrders[1]].sort(), 'J: refresh keeps the same candidate set');
  console.log(`J passed: A/B/C (fresh) and D (10h) rank above E (stale 100-like) on seed0 (${jOrders[0].join(',')}) and refresh (${jOrders[1].join(',')})`);

  // -------------------------------------------------------------------------
  // K — bucket shuffle end to end: with 15 hot (≤1h) + 5 old posts, page 1
  // (12 cards) must be ALL hot for every refresh seed. A refresh rotates the
  // order INSIDE the hot bucket and never lets old fallback posts rise.
  // -------------------------------------------------------------------------
  for (let i = 0; i < 15; i += 1) {
    await insertRanking({ id: `k-hot-${String(i).padStart(2, '0')}`, user: 'authorA', hashtag: 'kk', createdMod: `-${i + 1} minutes` });
  }
  for (let i = 0; i < 5; i += 1) {
    await insertRanking({ id: `k-old-${i}`, user: 'authorA', hashtag: 'kk', createdMod: '-40 days' });
  }
  const hotSet = Array.from({ length: 15 }, (_, i) => `k-hot-${String(i).padStart(2, '0')}`);
  const kOrders = [];
  for (const seed of [1, 2, 3]) {
    const ids = await feedIds({ hashtag: 'kk', seed, limit: 12 });
    assert.equal(ids.length, 12, `K seed ${seed}: page 1 must be full`);
    assert.ok(ids.every((id) => hotSet.includes(id)), `K seed ${seed}: page 1 must be ALL hot, got ${ids.join(',')}`);
    assert.equal(new Set(ids).size, 12, `K seed ${seed}: page 1 must not repeat cards`);
    assert.notDeepEqual(ids, kOrders[0] ?? [], `K seed ${seed}: order must vary across refresh seeds`);
    kOrders.push(ids);
  }
  // The full pool (limit 20 = all 15 hot + 5 old) keeps the SAME candidate set
  // across refresh seeds — only the order inside each bucket differs.
  const fullA = await feedIds({ hashtag: 'kk', seed: 1, limit: 20 });
  const fullB = await feedIds({ hashtag: 'kk', seed: 2, limit: 20 });
  assert.equal(fullA.length, 20, 'K: full pool must include all hot + old posts');
  assert.deepEqual([...fullA].sort(), [...fullB].sort(), 'K: refresh keeps the same candidate set');
  assert.notDeepEqual(fullB, fullA, 'K: refresh reorders inside buckets');
  console.log('K passed: page 1 stays ALL hot across refresh seeds (old posts never rise)');

  // -------------------------------------------------------------------------
  // Migration rehearsal on a pre-0019 shaped rankings table (in-memory),
  // proving ADD COLUMN + backfill succeed on a table that already has rows.
  // -------------------------------------------------------------------------
  {
    const legacy = new DatabaseSync(':memory:');
    legacy.exec(`CREATE TABLE rankings (
      id TEXT PRIMARY KEY, user_id TEXT, likes_count INTEGER DEFAULT 0,
      comments_count INTEGER DEFAULT 0, dislikes_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    legacy.exec("INSERT INTO rankings (id, created_at) VALUES ('old1', '2026-01-01 00:00:00'), ('old2', '2026-02-01 00:00:00')");
    for (const statement of migration.split(/\r?\n/).filter((l) => !l.trimStart().startsWith('--')).join('\n').split(';').map((s) => s.trim()).filter(Boolean)) {
      legacy.exec(statement);
    }
    const columns = legacy.prepare('PRAGMA table_info(rankings)').all().map((c) => c.name);
    assert.ok(columns.includes('last_activity_at'), 'migration must add last_activity_at');
    assert.deepEqual(
      legacy.prepare('SELECT id, last_activity_at FROM rankings ORDER BY id').all().map((row) => ({ ...row })),
      [
        { id: 'old1', last_activity_at: '2026-01-01 00:00:00' },
        { id: 'old2', last_activity_at: '2026-02-01 00:00:00' },
      ],
      '0019 must backfill last_activity_at = created_at',
    );
    legacy.close();
    console.log('Migration rehearsal passed: ADD COLUMN + backfill on a populated table');
  }

  // -------------------------------------------------------------------------
  // EXPLAIN QUERY PLAN on the trending pool: the ORDER BY is a computed
  // expression (freshness CASE + min() + arithmetic) so SQLite must SCAN
  // rankings into a TEMP B-TREE — a last_activity_at index cannot serve this
  // sort, so no new index is justified (it would only add write cost on every
  // like/comment).
  // -------------------------------------------------------------------------
  {
    const { results } = await db.prepare(`
      EXPLAIN QUERY PLAN
      SELECT r.id FROM rankings r
      WHERE 1=1
      ORDER BY (
        CASE
          WHEN COALESCE(r.last_activity_at, r.created_at) >= datetime('now', '-1 hour') THEN 5
          WHEN COALESCE(r.last_activity_at, r.created_at) >= datetime('now', '-6 hours') THEN 4
          WHEN COALESCE(r.last_activity_at, r.created_at) >= datetime('now', '-1 day') THEN 3
          WHEN COALESCE(r.last_activity_at, r.created_at) >= datetime('now', '-3 days') THEN 2
          ELSE 1
        END
      ) DESC,
      (
        min(COALESCE(r.likes_count, 0), 50)
        + min(COALESCE(r.comments_count, 0), 25) * 2
        - COALESCE(r.dislikes_count, 0)
      ) DESC,
      COALESCE(r.last_activity_at, r.created_at) DESC,
      r.created_at DESC, r.id DESC
      LIMIT 600
    `).all();
    const plan = results.map((row) => row.detail).join('\n');
    assert.match(plan, /SCAN rankings|SCAN r$|SCAN r\s/, `expected full SCAN, got:\n${plan}`);
    assert.match(plan, /USE TEMP B-TREE/, `expected temp sort, got:\n${plan}`);
    console.log('EXPLAIN confirmed: computed ORDER BY => SCAN + TEMP B-TREE (no index helps)');
  }

  console.log('Trending recent-activity checks passed against local Miniflare D1.');
} finally {
  if (realCaches === undefined) delete globalThis.caches;
  else globalThis.caches = realCaches;
  await mf.dispose();
}