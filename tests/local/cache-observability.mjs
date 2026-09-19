import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

import { onRequest as rankings } from '../../functions/api/rankings.js';
import { onRequestGet as spotlights } from '../../functions/api/spotlights.js';
import {
  CACHE_METRIC_SAMPLE_RATE,
  emitCacheMetric,
  requestColo,
  shouldSampleMetric,
  spotlightsMetric,
  trendingPoolMetric,
} from '../../functions/lib/pool-cache.js';

const schema = await readFile(new URL('../../schema.sql', import.meta.url), 'utf8');
const schemaStatements = schema
  .split(/\r?\n/)
  .filter((line) => !line.trimStart().startsWith('--'))
  .join('\n')
  .split(';')
  .map((statement) => statement.trim())
  .filter(Boolean);

// --- Unit: entry shape, PII safety, sampling, sink safety -------------------

// Builders emit exactly the allowlisted fields — nothing else, ever.
assert.deepEqual(
  Object.keys(trendingPoolMetric({ l1: 'HIT', l2: 'SKIP', d1Build: false, eligible: true, feedType: 'trending', poolSize: 12, ms: 3, colo: null })).sort(),
  ['component', 'd1_build', 'eligible', 'event', 'feed_type', 'l1', 'l2', 'pool_ms', 'pool_size', 'version'].sort(),
);
assert.deepEqual(
  Object.keys(trendingPoolMetric({ l1: 'MISS', l2: 'MISS', d1Build: true, eligible: true, feedType: 'trending', poolSize: 0, ms: 0, colo: 'BKK' })).sort(),
  ['colo', 'component', 'd1_build', 'eligible', 'event', 'feed_type', 'l1', 'l2', 'pool_ms', 'pool_size', 'version'].sort(),
);
assert.deepEqual(
  Object.keys(spotlightsMetric({ result: 'HIT', colo: null })).sort(),
  ['component', 'event', 'layer', 'result', 'version'].sort(),
);
console.log('shape checks passed: fixed field allowlists');

// Hostile inputs must never surface in serialized logs (ids arrays, users,
// tokens, cookies, URLs are not even parameters — this pins that invariant).
{
  const hostile = JSON.stringify([
    trendingPoolMetric({ l1: 'HIT', l2: 'SKIP', d1Build: false, eligible: true, feedType: 'trending', poolSize: 600, ms: 12, colo: 'BKK' }),
    spotlightsMetric({ result: 'MISS', colo: 'SIN' }),
  ]);
  for (const forbidden of ['user', 'user_id', 'email', 'username', 'cookie', 'session', 'token', 'authorization', 'ids', 'ranking', 'http']) {
    assert.ok(!hostile.includes(`"${forbidden}"`), `log must not contain ${forbidden}`);
  }
  console.log('PII/payload scan passed on builder outputs');
}

// Sampling: single layer, default 1%, env override, deterministic edges.
assert.equal(CACHE_METRIC_SAMPLE_RATE, 0.01);
for (let i = 0; i < 20; i += 1) assert.equal(shouldSampleMetric({}, 1), true);
for (let i = 0; i < 20; i += 1) assert.equal(shouldSampleMetric({}, 0), false);
assert.equal(shouldSampleMetric({ CACHE_METRIC_SAMPLE_RATE: '1' }), true);
assert.equal(shouldSampleMetric({ CACHE_METRIC_SAMPLE_RATE: '0' }), false);
assert.equal(shouldSampleMetric({ CACHE_METRIC_SAMPLE_RATE: 'bogus' }, 1), true);
console.log('sampling checks passed: default 0.01, env override, deterministic edges');

// Throwing sink never breaks the caller.
emitCacheMetric({ log() { throw new Error('sink down'); } }, trendingPoolMetric({ l1: 'HIT', l2: 'SKIP', d1Build: false, eligible: true, feedType: 'trending', poolSize: 1, ms: 0, colo: null }));
console.log('sink-failure check passed');

// colo extraction never throws and omits cleanly.
assert.equal(requestColo({ cf: { colo: 'BKK' } }), 'BKK');
assert.equal(requestColo({}), null);
assert.equal(requestColo(null), null);
assert.equal(requestColo({ get cf() { throw new Error('x'); } }), null);
console.log('colo checks passed');

// --- Handler tests: Miniflare D1 + fake Cache API + captured console --------

// Fake Cache API with production-like fidelity: entries keep the full
// response (body + headers — Cache-Control included) and every match()
// returns a fresh readable copy, like the real Cache API.
function fakeCache({ failMatch = false, failPut = false, seed = null } = {}) {
  const store = new Map();
  if (seed) {
    for (const [url, body] of seed) {
      store.set(url, { text: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
    }
  }
  return {
    store,
    async match(request) {
      if (failMatch) throw new Error('simulated cache outage');
      const found = store.get(request.url);
      if (!found) return null;
      return new Response(found.text, { headers: { ...found.headers } });
    },
    async put(request, response) {
      if (failPut) throw new Error('simulated put failure');
      const headers = {};
      response.headers.forEach((value, key) => { headers[key] = value; });
      store.set(request.url, { text: await response.text(), headers });
    },
  };
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
    db.prepare(`INSERT INTO profiles (id, username, email) VALUES (?, ?, ?)`).bind('author1', 'Author', 'a@local.test'),
    db.prepare(`INSERT INTO profiles (id, username, email) VALUES (?, ?, ?)`).bind('userA', 'User A', 'ua@local.test'),
    db.prepare(`INSERT INTO follows (follower_id, following_id) VALUES (?, ?)`).bind('userA', 'author1'),
    db.prepare(`INSERT INTO templates (id, creator_id, title, tiers) VALUES (?, ?, ?, ?)`).bind('tpl1', 'author1', 'T1', '[]'),
    db.prepare(`INSERT INTO template_items (id, template_id, item_id, position) VALUES (?, ?, ?, ?)`).bind('ti1', 'tpl1', 'ball', 0),
    db.prepare(`INSERT INTO items (id, name) VALUES (?, ?)`).bind('ball', 'Ball'),
    db.prepare(`INSERT INTO rankings (id, title, user_id, category, likes_count, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))`).bind('r1', 'One', 'author1', 'gaming', 5),
    db.prepare(`INSERT INTO rankings (id, title, user_id, category, likes_count, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))`).bind('r2', 'Two', 'author1', 'gaming', 3),
    db.prepare(`INSERT INTO rankings (id, title, user_id, category, likes_count, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))`).bind('r3', 'Three', 'author1', 'food', 1),
  ]);
  return { mf, db };
}

function countingDb(db, counter) {
  return {
    prepare(sql) {
      counter.statements += 1;
      return db.prepare(sql);
    },
    batch(statements) {
      return db.batch(statements);
    },
  };
}

const realLog = console.log;
const realCaches = globalThis.caches;
let captured = [];
const archive = [];
function captureLogs() {
  captured = [];
  console.log = (...args) => { captured.push(args.join(' ')); };
}
function releaseLogs() {
  console.log = realLog;
}
function metricLogs() {
  const out = captured
    .filter((line) => line.startsWith('{"event":"cache_metric"'))
    .map((line) => JSON.parse(line));
  archive.push(...out);
  return out;
}

async function callRankings(db, params, { userId = null, sampleRate = '1' } = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) query.set(key, String(value));
  }
  const response = await rankings({
    request: new Request(`https://local.test/api/rankings?${query.toString()}`, { method: 'GET' }),
    env: { tear_of_god_db: db, APP_ENV: 'local', CACHE_METRIC_SAMPLE_RATE: sampleRate },
    data: userId ? { user: { id: userId } } : {},
  });
  return { response, body: await response.json() };
}

async function callSpotlights(db, { sampleRate = '1' } = {}) {
  const response = await spotlights({
    request: new Request('https://local.test/api/spotlights', { method: 'GET' }),
    env: { tear_of_god_db: db, APP_ENV: 'local', CACHE_METRIC_SAMPLE_RATE: sampleRate },
    data: {},
  });
  return { response, body: await response.json() };
}

const { mf, db: rawDb } = await createSeededD1();
try {
  const counter = { statements: 0 };
  const db = countingDb(rawDb, counter);

  // CASE 1 — L1 MISS + L2 MISS + D1 build: exact summary.
  globalThis.caches = { default: fakeCache() };
  captureLogs();
  const c1 = await callRankings(db, { feed_type: 'trending', seed: 101, limit: 5, page: 1 });
  assert.equal(c1.response.status, 200);
  assert.equal(c1.body.data.length, 3);
  releaseLogs();
  {
    const [entry] = metricLogs();
    assert.deepEqual(entry, {
      event: 'cache_metric', component: 'trending_pool', version: 'v1',
      feed_type: 'trending', eligible: true, l1: 'MISS', l2: 'MISS',
      d1_build: true, pool_size: 3, pool_ms: entry.pool_ms,
    });
    assert.ok(Number.isInteger(entry.pool_ms) && entry.pool_ms >= 0);
    console.log('CASE 1 passed: L1 MISS + L2 MISS + D1 summary');
  }

  // CASE 2 — L1 HIT: single summary, no L2/D1 misattribution.
  captureLogs();
  const c2 = await callRankings(db, { feed_type: 'trending', seed: 101, limit: 5, page: 2 });
  assert.equal(c2.response.status, 200);
  releaseLogs();
  {
    const [entry] = metricLogs();
    assert.equal(entry.l1, 'HIT');
    assert.equal(entry.l2, 'SKIP');
    assert.equal(entry.d1_build, false);
    assert.equal(entry.eligible, true);
    console.log('CASE 2 passed: L1 HIT summary');
  }

  // CASE 3 — L1 MISS + L2 HIT (cross-seed reuse).
  captureLogs();
  await callRankings(db, { feed_type: 'trending', seed: 102, limit: 5, page: 1 });
  releaseLogs();
  {
    const [entry] = metricLogs();
    assert.equal(entry.l1, 'MISS');
    assert.equal(entry.l2, 'HIT');
    assert.equal(entry.d1_build, false);
    console.log('CASE 3 passed: L1 MISS + L2 HIT summary');
  }

  // CASE 4 — filtered trending: eligible=false, never a shared miss.
  captureLogs();
  await callRankings(db, { feed_type: 'trending', seed: 103, limit: 5, page: 1, category: 'gaming' });
  releaseLogs();
  {
    const [entry] = metricLogs();
    assert.equal(entry.eligible, false);
    assert.equal(entry.l2, 'SKIP');
    assert.equal(entry.d1_build, true);
    console.log('CASE 4 passed: filtered eligible=false');
  }

  // CASE 5/6 — for_you / following: eligible=false, never an L2 miss.
  captureLogs();
  await callRankings(db, { feed_type: 'for_you', seed: 104, limit: 5, page: 1 }, { userId: 'userA' });
  await callRankings(db, { feed_type: 'following', seed: 105, limit: 5, page: 1 }, { userId: 'userA' });
  releaseLogs();
  {
    const entries = metricLogs();
    assert.equal(entries.length, 2);
    for (const entry of entries) {
      assert.equal(entry.eligible, false);
      assert.equal(entry.l2, 'SKIP');
      assert.equal(entry.d1_build, false);
    }
    assert.deepEqual(entries.map((e) => e.feed_type).sort(), ['following', 'for_you']);
    console.log('CASE 5/6 passed: for_you/following never L2-miss');
  }

  // CASE 7 — cache outage: still 200, summary shows fallback (MISS + build).
  // Filtered key (fresh for this case) so no warm memory bridge can mask the
  // D1 fallback the same way it would for an unfiltered outage.
  globalThis.caches = { default: fakeCache({ failMatch: true, failPut: true }) };
  captureLogs();
  const outage = await callRankings(db, { feed_type: 'trending', seed: 106, limit: 5, page: 1, category: 'gaming' });
  assert.equal(outage.response.status, 200);
  assert.equal(outage.body.data.length, 2);
  releaseLogs();
  {
    const [entry] = metricLogs();
    assert.equal(entry.eligible, false);
    assert.equal(entry.l1, 'MISS');
    assert.equal(entry.l2, 'SKIP');
    assert.equal(entry.d1_build, true);
    console.log('CASE 7 passed: cache error falls back, summary stays truthful');
  }
  globalThis.caches = { default: fakeCache() };

  // CASE 8/9/10 — spotlights HIT / MISS / ERROR(match).
  {
    const canned = { success: true, data: { canned: true } };
    const hitCache = fakeCache({ seed: [['https://local.test/api/spotlights', canned]] });
    globalThis.caches = { default: hitCache };
    const before = counter.statements;
    captureLogs();
    const hit = await callSpotlights(db);
    assert.equal(hit.response.status, 200);
    assert.deepEqual(hit.body, canned);
    releaseLogs();
    assert.equal(counter.statements, before, 'HIT must not touch D1');
    {
      const [entry] = metricLogs();
      assert.deepEqual(entry, {
        event: 'cache_metric', component: 'spotlights', version: 'v1',
        layer: 'cache_api', result: 'HIT',
      });
    }
    console.log('CASE 8 passed: spotlights HIT, D1 = 0');
  }
  {
    globalThis.caches = { default: fakeCache() };
    captureLogs();
    const miss = await callSpotlights(db);
    assert.equal(miss.response.status, 200);
    assert.equal(miss.body.success, true);
    releaseLogs();
    {
      const [entry] = metricLogs();
      assert.equal(entry.result, 'MISS');
      assert.equal(entry.component, 'spotlights');
    }
    console.log('CASE 9 passed: spotlights MISS summary');
  }
  {
    globalThis.caches = { default: fakeCache({ failMatch: true }) };
    captureLogs();
    const err = await callSpotlights(db);
    assert.equal(err.response.status, 200);
    releaseLogs();
    {
      const [entry] = metricLogs();
      assert.equal(entry.result, 'MISS', 'outage fallback is a MISS, error stays on the warn log');
    }
    globalThis.caches = { default: fakeCache() };
    console.log('CASE 10 passed: spotlights outage falls back, summary truthful');
  }

  // CASE 11/12 — every captured summary is PII-free and payload-free.
  {
    const all = archive.map((e) => JSON.stringify(e)).join('\n');
    assert.ok(archive.length > 0, 'suite must have emitted summaries to scan');
    for (const forbidden of ['user', 'user_id', 'email', 'username', 'cookie', 'session', 'token', 'authorization', 'ids', 'ranking']) {
      assert.ok(!all.includes(`"${forbidden}"`), `no captured log may contain ${forbidden}`);
    }
    console.log('CASE 11/12 passed: captured logs carry no PII or payloads');
  }

  // CASE 13 — no cf on the request: no crash, colo omitted.
  // (All handler calls above already ran without request.cf — reaching here
  // proves it; assert the shape explicitly on one entry.)
  {
    captureLogs();
    await callRankings(db, { feed_type: 'trending', seed: 101, limit: 5, page: 1 });
    releaseLogs();
    const [entry] = metricLogs();
    assert.ok(!('colo' in entry), 'colo omitted when runtime provides none');
    console.log('CASE 13 passed: missing colo degrades cleanly');
  }

  // CASE 14 — even a throwing log sink cannot break the request.
  {
    console.log = (...args) => {
      if (String(args[0]).startsWith('{"event":"cache_metric"')) throw new Error('sink down');
      realLog(...args);
    };
    try {
      const res = await callRankings(db, { feed_type: 'trending', seed: 1401, limit: 5, page: 1 });
      assert.equal(res.response.status, 200);
      assert.equal(res.body.data.length, 3);
    } finally {
      console.log = realLog;
    }
    console.log('CASE 14 passed: throwing sink cannot break requests');
  }

  // Sample rate 0: provable silence.
  {
    captureLogs();
    await callRankings(db, { feed_type: 'trending', seed: 101, limit: 5, page: 1 }, { sampleRate: '0' });
    await callSpotlights(db, { sampleRate: '0' });
    releaseLogs();
    assert.equal(metricLogs().length, 0);
    console.log('rate-0 silence check passed');
  }

  // CASE 15 — response contract untouched: no metric fields leak into bodies,
  // and cache headers keep their pre-existing values.
  {
    const guest = await callRankings(db, { feed_type: 'trending', seed: 101, limit: 5, page: 1 });
    const guestJson = JSON.stringify(guest.body);
    assert.ok(!guestJson.includes('cache_metric'));
    assert.equal(guest.response.headers.get('Cache-Control'), 'public, max-age=30, stale-while-revalidate=120');
    const miss = await callSpotlights(db);
    assert.ok(!JSON.stringify(miss.body).includes('cache_metric'));
    assert.equal(miss.response.headers.get('Cache-Control'), 'public, max-age=30, s-maxage=300');
    console.log('CASE 15 passed: bodies and cache headers unchanged');
  }

  console.log('Cache observability checks passed against local Miniflare D1.');
} finally {
  console.log = realLog;
  if (realCaches === undefined) delete globalThis.caches;
  else globalThis.caches = realCaches;
  await mf.dispose();
}
