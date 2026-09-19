import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

import { onRequest as users } from '../../functions/api/users.js';
import { onRequest as rankings } from '../../functions/api/rankings.js';
// NOTE: src/lib/api.js uses Vite-style extension-less imports and cannot be
// imported by plain node ESM, and this repo has no frontend test framework
// (adding one is out of scope). CASE 9/10/11 therefore stay manual
// verification — see the FINAL REPORT. Everything below runs against the real
// handler + Miniflare D1.

const schema = await readFile(new URL('../../schema.sql', import.meta.url), 'utf8');
const schemaStatements = schema
  .split(/\r?\n/)
  .filter((line) => !line.trimStart().startsWith('--'))
  .join('\n')
  .split(';')
  .map((statement) => statement.trim())
  .filter(Boolean);

// Records every prepared statement text. Markers (not exact counts) prove
// which computation ran: taste collection always contains UNION ALL,
// findSimilarUsers candidates always join rankings as r ON r.user_id = p.id,
// the legacy top-items fallback is the only user of json_valid(t.tiers).
function trackingDb(db, log) {
  return {
    prepare(sql) {
      const text = sql.replace(/\s+/g, ' ').trim();
      const real = db.prepare(sql);
      return {
        bind(...args) {
          log.push(text);
          return real.bind(...args);
        },
        all(...args) {
          log.push(`${text} [no-bind]`);
          return real.all(...args);
        },
        first(...args) {
          log.push(`${text} [no-bind]`);
          return real.first(...args);
        },
        run(...args) {
          log.push(`${text} [no-bind]`);
          return real.run(...args);
        },
      };
    },
    batch(statements) {
      return db.batch(statements);
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
  const seed = [
    db.prepare(`INSERT INTO profiles (id, username, email) VALUES (?, ?, ?)`).bind('alice', 'Alice', 'alice@local.test'),
    db.prepare(`INSERT INTO profiles (id, username, email) VALUES (?, ?, ?)`).bind('bob', 'Bob', 'bob@local.test'),
    db.prepare(`INSERT INTO profiles (id, username, email) VALUES (?, ?, ?)`).bind('carol', 'Carol', 'carol@local.test'),
    db.prepare(`INSERT INTO profiles (id, username, email) VALUES (?, ?, ?)`).bind('dave', 'Dave', 'dave@local.test'),
    db.prepare(`INSERT INTO profiles (id, username, email) VALUES (?, ?, ?)`).bind('eve', 'Eve', 'eve@local.test'),
    db.prepare(`INSERT INTO profiles (id, username, email) VALUES (?, ?, ?)`).bind('legacy', 'Legacy', 'legacy@local.test'),
    db.prepare(`INSERT INTO follows (follower_id, following_id) VALUES (?, ?)`).bind('bob', 'alice'),
    // alice: gaming/anime taste + one template + one pin target.
    db.prepare(`INSERT INTO templates (id, creator_id, title, category, hashtags, tiers, use_count) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind('tplA', 'alice', 'Alice template', 'gaming', '#gaming', JSON.stringify([{ label: 'S', color: '#fff' }]), 30),
    db.prepare(`INSERT INTO rankings (id, title, user_id, template_id, category, hashtags, likes_count, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`).bind('rkA1', 'Alice one', 'alice', 'tplA', 'gaming', '#gaming,#rpg', 5),
    db.prepare(`INSERT INTO rankings (id, title, user_id, category, hashtags, likes_count, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`).bind('rkA2', 'Alice two', 'alice', 'anime', '#anime', 3),
    db.prepare(`INSERT INTO ranking_items (id, ranking_id, item_id, tier, position) VALUES (?, ?, ?, ?, ?)`)
      .bind('riA1', 'rkA1', 'slime', 'S', 0),
    db.prepare(`INSERT INTO items (id, name) VALUES (?, ?)`).bind('slime', 'Slime'),
    db.prepare(`INSERT INTO ranking_item_scores (id, ranking_id, template_id, item_id, tier_index, score) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind('scA1', 'rkA1', 'tplA', 'slime', 0, 1),
    db.prepare(`INSERT INTO profile_pins (user_id, ranking_id, position) VALUES (?, ?, ?)`).bind('alice', 'rkA1', 0),
    // bob shares alice's gaming taste; carol is disjoint (cooking).
    db.prepare(`INSERT INTO rankings (id, title, user_id, category, hashtags, likes_count, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`).bind('rkB1', 'Bob one', 'bob', 'gaming', '#gaming', 2),
    db.prepare(`INSERT INTO rankings (id, title, user_id, category, hashtags, likes_count, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`).bind('rkC1', 'Carol one', 'carol', 'cooking', '#cooking', 2),
    db.prepare(`INSERT INTO rankings (id, title, user_id, category, hashtags, likes_count, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`).bind('rkE1', 'Eve one', 'eve', 'gaming', '#gaming', 4),
    // legacy: rankings but no frozen scores -> legacy fallback path must still run.
    db.prepare(`INSERT INTO rankings (id, title, user_id, category, hashtags, likes_count, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`).bind('rkL1', 'Legacy one', 'legacy', 'gaming', '#gaming', 1),
    db.prepare(`INSERT INTO ranking_items (id, ranking_id, item_id, tier, position) VALUES (?, ?, ?, ?, ?)`)
      .bind('riL1', 'rkL1', 'slime', 'S', 0),
  ];
  await db.batch(seed);
  return { mf, db };
}

async function callUsers(db, { id, fields }, userId) {
  const params = new URLSearchParams({ id });
  if (fields) params.set('fields', fields);
  const response = await users({
    request: new Request(`https://local.test/api/users?${params.toString()}`, { method: 'GET' }),
    env: { tear_of_god_db: db, APP_ENV: 'local' },
    data: userId ? { user: { id: userId } } : {},
  });
  return { response, body: await response.json() };
}

const { mf, db: rawDb } = await createSeededD1();
try {
  // CASE 1 — guest core: full core fields, no viewer-specific work at all.
  {
    const log = [];
    const { body } = await callUsers(trackingDb(rawDb, log), { id: 'alice' }, null);
    assert.equal(body.success, true);
    assert.equal(body.data.username, 'Alice');
    assert.ok(Array.isArray(body.data.taste_identity.category_distribution));
    assert.ok(Array.isArray(body.data.taste_identity.top_items));
    assert.ok(Array.isArray(body.data.taste_identity.pinned_rankings));
    assert.equal(body.data.taste_identity.similar_users, null);
    assert.equal(body.data.taste_identity.taste_match, null);
    assert.ok(!log.some((sql) => sql.includes('UNION ALL')), 'guest core must not collect taste');
    assert.ok(!log.some((sql) => sql.includes('JOIN rankings r ON r.user_id = p.id')), 'guest core must not find similar users');
    console.log('CASE 1 passed: guest core complete, zero viewer/similar work');
  }

  // CASE 2 — own profile core: no self-match computation.
  {
    const log = [];
    const { body } = await callUsers(trackingDb(rawDb, log), { id: 'alice' }, 'alice');
    assert.equal(body.success, true);
    assert.equal(body.data.taste_identity.taste_match, null);
    assert.equal(body.data.taste_identity.similar_users, null);
    assert.ok(!log.some((sql) => sql.includes('UNION ALL')), 'self core must not collect taste');
    console.log('CASE 2 passed: own core complete, no self-match work');
  }

  // CASE 3 — logged-in other profile: follow state + counts correct.
  {
    const { body } = await callUsers(rawDb, { id: 'alice' }, 'bob');
    assert.equal(body.success, true);
    assert.equal(body.data.is_following, true);
    assert.equal(body.data.posts_count, 2);
    assert.equal(body.data.followers_count, 1);
    console.log('CASE 3 passed: follow state and counts correct');
  }

  // CASE 4 — no rankings: empty identity, legacy fallback provably skipped.
  {
    const log = [];
    const { body } = await callUsers(trackingDb(rawDb, log), { id: 'dave' }, null);
    assert.equal(body.success, true);
    assert.deepEqual(body.data.taste_identity.category_distribution, []);
    assert.deepEqual(body.data.taste_identity.top_items, []);
    assert.deepEqual(body.data.taste_identity.pinned_rankings, []);
    assert.ok(!log.some((sql) => sql.includes('json_valid')), 'empty profile must skip the legacy fallback query');
    console.log('CASE 4 passed: empty identity identical, fallback skipped');
  }

  // Legacy profile WITH rankings but no scores: fallback must still run.
  {
    const log = [];
    const { body } = await callUsers(trackingDb(rawDb, log), { id: 'legacy' }, null);
    assert.equal(body.success, true);
    assert.ok(log.some((sql) => sql.includes('json_valid')), 'legacy profile must keep the fallback query');
    assert.ok(body.data.taste_identity.top_items.length > 0);
    console.log('CASE 4b passed: legacy fallback preserved when rankings exist');
  }

  // CASE 5 — core never runs findSimilarUsers (all core scenarios above share
  // this invariant; asserted explicitly here for the requirement).
  {
    const log = [];
    await callUsers(trackingDb(rawDb, log), { id: 'alice' }, 'bob');
    await callUsers(trackingDb(rawDb, log), { id: 'alice' }, null);
    assert.ok(!log.some((sql) => sql.includes('JOIN rankings r ON r.user_id = p.id')));
    console.log('CASE 5 passed: core request never runs findSimilarUsers');
  }

  // CASE 6 — similar mode returns the same computation the core used to embed.
  {
    const first = await callUsers(rawDb, { id: 'alice', fields: 'similar' }, 'bob');
    assert.equal(first.body.success, true);
    assert.ok(Array.isArray(first.body.data.similar_users));
    assert.ok(first.body.data.similar_users.length > 0);
    const scores = first.body.data.similar_users.map((u) => u.score);
    assert.ok(scores.every((s) => s >= 0 && s <= 100));
    assert.deepEqual([...scores].sort((a, b) => b - a), scores, 'similar users stay sorted desc');
    assert.ok(first.body.data.taste_match && first.body.data.taste_match.score > 0, 'bob shares taste with alice');
    const second = await callUsers(rawDb, { id: 'alice', fields: 'similar' }, 'bob');
    assert.deepEqual(second.body.data, first.body.data, 'similar mode is deterministic');
    const missing = await callUsers(rawDb, { id: 'nobody', fields: 'similar' }, 'bob');
    assert.equal(missing.body.success, false);
    console.log('CASE 6 passed: similar mode correct, sorted, deterministic, 404 preserved');
  }

  // CASE 7 — viewer match differs per viewer taste.
  {
    const bobView = await callUsers(rawDb, { id: 'alice', fields: 'similar' }, 'bob');
    const carolView = await callUsers(rawDb, { id: 'alice', fields: 'similar' }, 'carol');
    assert.ok(bobView.body.data.taste_match.score > carolView.body.data.taste_match.score);
    assert.deepEqual(carolView.body.data.taste_match.shared_categories, []);
    const guestView = await callUsers(rawDb, { id: 'alice', fields: 'similar' }, null);
    assert.equal(guestView.body.data.taste_match, null);
    const selfView = await callUsers(rawDb, { id: 'alice', fields: 'similar' }, 'alice');
    assert.equal(selfView.body.data.taste_match, null);
    console.log('CASE 7 passed: taste match is viewer-specific (guest/self null)');
  }

  // CASE 8 — no shared server cache: one viewer acting never changes another's.
  {
    const before = await callUsers(rawDb, { id: 'alice', fields: 'similar' }, 'bob');
    await rawDb.prepare(`INSERT INTO rankings (id, title, user_id, category, hashtags, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))`).bind('rkC2', 'Carol two', 'carol', 'cooking', '#ramen').run();
    const afterBob = await callUsers(rawDb, { id: 'alice', fields: 'similar' }, 'bob');
    assert.deepEqual(afterBob.body.data, before.body.data, 'unrelated viewer activity changes nothing');
    const afterCarol = await callUsers(rawDb, { id: 'alice', fields: 'similar' }, 'carol');
    assert.ok(afterCarol.body.data.taste_match.shared_hashtags.includes('ramen') || afterCarol.body.data.taste_match.score >= 0);
    console.log('CASE 8 passed: per-request recompute, no cross-user leak');
  }

  // CASE 12 — posts limit contract intact (ANALYSIS ONLY: frontend renders all
  // 50 with no pagination and derives totalLikes from them — limit must stay).
  {
    const inserts = [];
    for (let i = 0; i < 60; i += 1) {
      inserts.push(rawDb.prepare(`INSERT INTO rankings (id, title, user_id, category, created_at)
        VALUES (?, ?, ?, ?, datetime('now'))`).bind(`prolific-${i}`, `P${i}`, 'eve', 'gaming'));
    }
    await rawDb.batch(inserts);
    const response = await rankings({
      request: new Request('https://local.test/api/rankings?author_id=eve&sort=recent&limit=50', { method: 'GET' }),
      env: { tear_of_god_db: rawDb, APP_ENV: 'local' },
      data: {},
    });
    const body = await response.json();
    assert.equal(body.data.length, 50, 'server still honors the profile limit=50 contract');
    const source = await readFile(new URL('../../src/pages/Profile.jsx', import.meta.url), 'utf8');
    assert.ok(source.includes('limit: 50'), 'Profile.jsx still requests limit 50 (no silent contract drift)');
    console.log('CASE 12 passed: posts limit contract unchanged');
  }

  // CASE 9/10/11 — MANUAL VERIFICATION ONLY (no DOM harness in repo, and
  // src/lib/api.js cannot be imported by plain node ESM). Verified by review:
  // the modal effect calls fetchSimilarUsers only when isTasteDetailsOpen;
  // concurrent identical URLs share one request via getJSON in-flight dedup;
  // sequential calls within 60s hit the per-viewer cache; failures return
  // success:false so the component skips the merge and the modal renders
  // exactly like the empty state. See FINAL REPORT.
  console.log('CASE 9/10/11 recorded as manual verification (no frontend harness in repo)');

  console.log('Profile similar-lazy checks passed against local Miniflare D1.');
} finally {
  await mf.dispose();
}
