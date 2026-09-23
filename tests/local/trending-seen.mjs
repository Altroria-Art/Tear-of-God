import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

import * as seenLib from '../../src/lib/trendingSeen.js';
import { markLastPublished, takeLastPublished } from '../../src/lib/lastPublished.js';
import { onRequest as rankings } from '../../functions/api/rankings.js';

// Gone-F5-remembered Trending seen history. Verifies the localStorage module
// (per-viewer key, 7-day TTL, complete history, dedup, exclude builder, storage-failure
// safety) and the backend exclude integration: seen ids supplied via `exclude`
// must push unseen posts to the front and never re-show seen ones while unseen
// candidates remain.

const schema = await readFile(new URL('../../schema.sql', import.meta.url), 'utf8');
const schemaStatements = schema
  .split(/\r?\n/)
  .filter((line) => !line.trimStart().startsWith('--'))
  .join('\n')
  .split(';')
  .map((statement) => statement.trim())
  .filter(Boolean);

function makeMemoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    _map: map,
  };
}

function makeFakeCache() {
  const store = new Map();
  let now = Date.now();
  return {
    store,
    async match(request) {
      const key = new URL(request.url).search;
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
      const body = await response.json();
      const maxAge = /max-age=(\d+)/.exec(response.headers.get('Cache-Control') || '');
      store.set(key, { ids: body.ids, tiers: body.tiers, expiresAt: now + (maxAge ? Number(maxAge[1]) * 1000 : 60000) });
    },
  };
}

const realLocalStorage = globalThis.localStorage;
const storage = makeMemoryStorage();
globalThis.localStorage = storage;

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();

try {
  // ---------------------------------------------------------------------------
  // Module unit checks.
  // ---------------------------------------------------------------------------
  const TTL = seenLib.TRENDING_SEEN_TTL_MS;

  // A — persist then load keeps ids + seenAt.
  seenLib.persistTrendingSeen('uA', [
    { id: 'A', seenAt: now - 60000 },
    { id: 'B', seenAt: now - 30000 },
    { id: 'C', seenAt: now },
  ]);
  const loaded = seenLib.loadTrendingSeen('uA');
  assert.deepEqual(loaded.map((e) => e.id), ['A', 'B', 'C'], 'A/B/C must survive a reload');
  assert.equal(loaded[2].seenAt, now, 'seenAt must persist');
  assert.ok(storage._map.has(seenLib.trendingSeenKey('uA')), 'storage must hold the ids');
  console.log('A passed: seen A/B/C survive reload with timestamps');

  // G — guest key separates from user keys.
  assert.equal(seenLib.trendingSeenKey(null), 'tog:trending-seen:guest');
  assert.equal(seenLib.trendingSeenKey('uA'), 'tog:trending-seen:uA');
  assert.notEqual(seenLib.trendingSeenKey('uA'), seenLib.trendingSeenKey(null));

  // H — a different account must never see another account's history.
  assert.deepEqual(seenLib.loadTrendingSeen('uB'), [], 'uB starts empty');
  assert.deepEqual(seenLib.loadTrendingSeen(null), [], 'guest starts empty');
  seenLib.persistTrendingSeen('uB', [{ id: 'X', seenAt: now }]);
  seenLib.persistTrendingSeen(null, [{ id: 'G1', seenAt: now }]);
  assert.deepEqual(seenLib.loadTrendingSeen('uA').map((e) => e.id), ['A', 'B', 'C'], 'uA must not inherit uB/guest history');
  assert.deepEqual(seenLib.loadTrendingSeen('uB').map((e) => e.id), ['X'], 'uB keeps its own history');
  assert.deepEqual(seenLib.loadTrendingSeen(null).map((e) => e.id), ['G1'], 'guest keeps its own history');
  console.log('G/H passed: guest and per-account state are isolated');

  // E — entries older than the 7-day TTL are dropped (eligible again).
  assert.deepEqual(
    seenLib.pruneTrendingSeen([{ id: 'k', seenAt: now - TTL }], now).map((e) => e.id),
    ['k'],
    'exactly at the TTL cutoff must be kept',
  );
  assert.deepEqual(
    seenLib.pruneTrendingSeen([{ id: 'd', seenAt: now - TTL - 1 }], now),
    [],
    'one ms past the TTL must be pruned',
  );
  seenLib.persistTrendingSeen('uE', [
    { id: 'k', seenAt: now - 600000 },
    { id: 'expired', seenAt: now - (8 * DAY) },
  ]);
  const eLoaded = seenLib.loadTrendingSeen('uE');
  assert.deepEqual(eLoaded.map((e) => e.id), ['k'], '8-day-old entry must be gone after load');
  console.log('E passed: >7-day entries are pruned and become eligible again');

  // F — never evict unexpired entries, even beyond the former 256-entry cap.
  const many = Array.from({ length: 300 }, (_, i) => ({ id: `r${String(i).padStart(3, '0')}`, seenAt: now - (300 - i) * 1000 }));
  const capped = seenLib.pruneTrendingSeen(many, now);
  assert.equal(capped.length, 300, 'all unexpired entries must survive');
  assert.equal(capped[0].id, 'r000', 'oldest unexpired id must stay hidden');
  console.log('F passed: history beyond 256 remains hidden until TTL');

  // Dedup: re-seeing an id updates seenAt instead of duplicating.
  seenLib.persistTrendingSeen('uDup', [
    { id: 'A', seenAt: now - 200000 },
    { id: 'A', seenAt: now },
  ]);
  const dup = seenLib.loadTrendingSeen('uDup');
  assert.deepEqual(dup.map((e) => e.id), ['A'], 'duplicate id must collapse');
  assert.equal(dup[0].seenAt, now, 'latest seenAt must win');
  console.log('Dedup passed: duplicate ids collapse, latest seenAt wins');

  // Exclude builder: emits only the most recent 100 ids, comma-separated.
  const many120 = Array.from({ length: 120 }, (_, i) => ({ id: `x${i}`, seenAt: now + i }));
  seenLib.persistTrendingSeen('uEx', many120);
  const exclIds = seenLib.trendingSeenExclude('uEx').split(',');
  assert.equal(exclIds.length, 100, 'exclude must never exceed 100 ids');
  assert.equal(exclIds[0], 'x20', 'oldest 20 ids must be omitted');
  assert.equal(exclIds[99], 'x119', 'most recent ids must be included');
  assert.ok(!exclIds.includes('x0'), 'x0 must not be sent');
  console.log('Exclude builder passed: sends the most recent 100 only');

  const cards = ['A', 'B', 'C'].map(id => ({ id }));
  const reloadSeen = () => seenLib.loadTrendingSeen('uA');
  assert.deepEqual(seenLib.filterUnseenTrending(cards, reloadSeen()), [], 'F5 must hide A/B/C even when backend repeats them');
  assert.deepEqual(seenLib.filterUnseenTrending([...cards, { id: 'D' }, { id: 'D' }], reloadSeen()), [{ id: 'D' }], 'new D appears once');
  assert.deepEqual(seenLib.filterUnseenTrending(cards.map(p => ({ ...p, likes_count: 999, comments_count: 999, last_activity_at: new Date().toISOString() })), reloadSeen()), [], 'new activity cannot revive a seen id');
  assert.deepEqual(seenLib.filterUnseenTrending([{ id: 'r000' }], capped), [], 'client filters ids outside the URL exclude window');
  const pages = [];
  const next = await seenLib.fetchUnseenTrendingPage(async page => {
    pages.push(page);
    return { data: page === 1 ? cards : [{ id: 'D' }] };
  }, { limit: 3, getSeen: reloadSeen });
  assert.deepEqual(pages, [1, 2], 'skip a full seen page to find D');
  assert.deepEqual(next.data, [{ id: 'D' }]);
  assert.equal(next.hasMore, false);
  const exhausted = await seenLib.fetchUnseenTrendingPage(async () => ({ data: cards }), { limit: 3, getSeen: reloadSeen });
  assert.deepEqual(exhausted.data, [], 'repeating backend cannot recycle seen cards');
  assert.equal(exhausted.hasMore, false, 'fully seen repeated pages terminate');
  const append = await seenLib.fetchUnseenTrendingPage(async page => ({ data: page === 2 ? [{ id: 'D' }, { id: 'D' }, { id: 'A' }] : [{ id: 'E' }] }), { page: 2, limit: 3, getSeen: reloadSeen, existingIds: ['D'] });
  assert.deepEqual(append.data, [{ id: 'E' }], 'infinite scroll skips both seen and already rendered ids');
  const expired = seenLib.filterUnseenTrending(cards, reloadSeen(), [], now + TTL + 1);
  assert.equal(expired.length, 3, 'TTL expiry makes A/B/C eligible');
  console.log('Client passed: F5, new D, activity, infinite scroll, exhausted pool and TTL');
  markLastPublished('D', 'uA');
  assert.equal(takeLastPublished('uA'), 'D', 'publish pins once');
  assert.equal(takeLastPublished('uA'), null, 'pin is consumed');
  seenLib.persistTrendingSeen('uPin', [{ id: 'D', seenAt: now }]);
  assert.deepEqual(seenLib.filterUnseenTrending([{ id: 'D' }], seenLib.loadTrendingSeen('uPin')), [], 'seen publish stays hidden after reload even if backend pins it');

  // Storage safety: read errors and corrupt JSON must degrade to empty lists.
  const broken = makeMemoryStorage();
  broken.getItem = () => { throw new Error('storage denied'); };
  globalThis.localStorage = broken;
  assert.deepEqual(seenLib.loadTrendingSeen('uA'), [], 'storage read failure must not throw');
  assert.deepEqual(seenLib.persistTrendingSeen('uA2', [{ id: 'A', seenAt: now }]), [{ id: 'A', seenAt: now }], 'storage write failure must not throw');
  globalThis.localStorage = storage;
  storage._map.set('tog:trending-seen:uBad', '{not json');
  assert.deepEqual(seenLib.loadTrendingSeen('uBad'), [], 'corrupt JSON must not throw');
  console.log('Storage safety passed: read/write/corrupt failures degrade gracefully');

  // ---------------------------------------------------------------------------
  // Backend integration: `exclude` from the persisted seen pushes unseen first.
  // ---------------------------------------------------------------------------
  const mf = new Miniflare(convertV4MiniflareOptions({
    modules: true,
    script: 'export default { fetch() { return new Response("trending seen test"); } }',
    compatibilityDate: '2026-01-01',
    d1Databases: ['DB'],
  }));
  const db = await mf.getD1Database('DB');
  const realCaches = globalThis.caches;
  try {
    await db.batch(schemaStatements.map((statement) => db.prepare(statement)));
    globalThis.caches = { default: makeFakeCache() };

    await db.prepare("INSERT INTO profiles (id, username, email) VALUES ('viewer', 'Viewer', 'viewer@local.test')").run();
    await db.batch([
      db.prepare(`INSERT INTO rankings (id, title, user_id, hashtags, likes_count, created_at, last_activity_at)
        VALUES ('seen-a', 'A', 'viewer', '#sa', 10, datetime('now', '-2 days'), datetime('now', '-2 days'))`),
      db.prepare(`INSERT INTO rankings (id, title, user_id, hashtags, likes_count, created_at, last_activity_at)
        VALUES ('seen-b', 'B', 'viewer', '#sa', 10, datetime('now', '-2 days'), datetime('now', '-2 days'))`),
      db.prepare(`INSERT INTO rankings (id, title, user_id, hashtags, likes_count, created_at, last_activity_at)
        VALUES ('seen-c', 'C', 'viewer', '#sa', 10, datetime('now', '-2 days'), datetime('now', '-2 days'))`),
      db.prepare(`INSERT INTO rankings (id, title, user_id, hashtags, likes_count, created_at, last_activity_at)
        VALUES ('unseen-d', 'D', 'viewer', '#sa', 3, datetime('now', '-2 hours'), datetime('now', '-2 hours'))`),
      db.prepare(`INSERT INTO rankings (id, title, user_id, hashtags, likes_count, created_at, last_activity_at)
        VALUES ('unseen-e', 'E', 'viewer', '#sa', 3, datetime('now', '-2 hours'), datetime('now', '-2 hours'))`),
      db.prepare(`INSERT INTO rankings (id, title, user_id, hashtags, likes_count, created_at, last_activity_at)
        VALUES ('unseen-f', 'F', 'viewer', '#sa', 3, datetime('now', '-2 hours'), datetime('now', '-2 hours'))`),
      db.prepare(`INSERT INTO rankings (id, title, user_id, hashtags, likes_count, created_at, last_activity_at)
        VALUES ('fresh-g', 'G', 'viewer', '#sa', 0, datetime('now', '-1 minutes'), datetime('now', '-1 minutes'))`),
    ]);

    const ALL = ['seen-a', 'seen-b', 'seen-c', 'unseen-d', 'unseen-e', 'unseen-f', 'fresh-g'];

    async function feedIds({ hashtag, exclude, fresh = false }) {
      const query = new URLSearchParams({ feed_type: 'trending', seed: '0', limit: '50' });
      if (hashtag) query.set('hashtag', hashtag);
      if (exclude) query.set('exclude', exclude);
      if (fresh) query.set('fresh', '1');
      const response = await rankings({
        request: new Request(`https://local.test/api/rankings?${query.toString()}`, { method: 'GET' }),
        env: { tear_of_god_db: db, APP_ENV: 'local' },
        data: { user: { id: 'viewer' } },
      });
      const body = await response.json();
      assert.equal(response.status, 200, JSON.stringify(body));
      assert.equal(body.success, true, JSON.stringify(body));
      return body.data.map((row) => row.id);
    }

    // Baseline (nothing seen): fresh G leads, all candidates present.
    const full = await feedIds({ hashtag: 'sa' });
    assert.deepEqual([...full].sort(), [...ALL].sort(), 'no seen history must return every candidate');
    assert.equal(full[0], 'fresh-g', 'unseen + fresh must rank first');
    console.log(`Backend baseline passed: fresh G leads (${full.join(',')})`);

    // B/C/D — seen A/B/C, unseen D/E/F remain: only unseen returned, G still first.
    const afterSeen = await feedIds({ hashtag: 'sa', exclude: ['seen-a', 'seen-b', 'seen-c'].join(',') });
    assert.deepEqual([...afterSeen].sort(), [...['unseen-d', 'unseen-e', 'unseen-f', 'fresh-g']].sort(), 'seen A/B/C must not reappear while unseen remain');
    assert.ok(!afterSeen.some((id) => ['seen-a', 'seen-b', 'seen-c'].includes(id)), 'A/B/C must be absent');
    assert.equal(afterSeen[0], 'fresh-g', 'fresh unseen G must still lead');
    console.log(`B/C/D passed: unseen D/E/F come before seen A/B/C (${afterSeen.join(',')})`);

    // Exhaustion is terminal until a new ranking arrives or history expires.
    const fellBack = await feedIds({ hashtag: 'sa', exclude: ALL.join(',') });
    assert.deepEqual(fellBack, [], 'fully-seen pool must not recycle');
    await db.prepare("UPDATE rankings SET likes_count = 999, last_activity_at = datetime('now') WHERE id = 'seen-a'").run();
    assert.deepEqual(await feedIds({ hashtag: 'sa', exclude: ALL.join(',') }), [], 'new activity cannot revive seen A');
    await db.prepare("INSERT INTO rankings (id, title, user_id, hashtags) VALUES ('new-after-exhaustion', 'New', 'viewer', '#sa')").run();
    assert.deepEqual(await feedIds({ hashtag: 'sa', exclude: ALL.join(','), fresh: true }), ['new-after-exhaustion'], 'new ranking appears after exhaustion despite cached pool');
    await db.prepare("DELETE FROM rankings WHERE id = 'new-after-exhaustion'").run();
    await db.prepare("UPDATE rankings SET likes_count = 10, last_activity_at = datetime('now', '-2 days') WHERE id = 'seen-a'").run();
    console.log('Exhaustion passed: empty stays empty after activity; newly inserted ranking appears');

    // E — an expired entry is no longer sent, so its ranking is eligible again.
    seenLib.persistTrendingSeen('viewer', [{ id: 'seen-a', seenAt: now - (8 * DAY) }]);
    const expiredExclude = seenLib.trendingSeenExclude('viewer');
    assert.equal(expiredExclude, '', 'expired entry must produce an empty exclude');
    const afterExpiry = await feedIds({ hashtag: 'sa', exclude: expiredExclude || undefined, fresh: true });
    assert.equal(afterExpiry.length, 7, 'expired seen must be eligible again');
    assert.equal(afterExpiry[0], 'fresh-g');
    console.log('E (backend) passed: TTL-expired seen is eligible again');
  } finally {
    if (realCaches === undefined) delete globalThis.caches;
    else globalThis.caches = realCaches;
    await mf.dispose();
  }

  console.log('Trending seen persistence checks passed.');
} finally {
  if (realLocalStorage === undefined) delete globalThis.localStorage;
  else globalThis.localStorage = realLocalStorage;
}
