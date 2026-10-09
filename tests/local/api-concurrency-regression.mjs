import { SQL_SCRIPT_SEPARATOR } from './helpers/sql.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { onRequest as vote } from '../../functions/api/votes.js';
import { onRequest as templateVote } from '../../functions/api/template-votes.js';
import { onRequestPost as pin } from '../../functions/api/profile-pins.js';
import { onRequestPost as duel } from '../../functions/api/duels.js';
import { onRequest as rankings } from '../../functions/api/rankings.js';
import { onRequest as users } from '../../functions/api/users.js';
import { onRequest as report } from '../../functions/api/report.js';
import { onRequestGet as template, onRequestPost as view } from '../../functions/api/templates.js';

const mf = new Miniflare(convertV4MiniflareOptions({
  modules: true, script: 'export default { fetch() { return new Response("audit"); } }',
  compatibilityDate: '2026-01-01', d1Databases: ['DB'],
}));
const schema = await readFile(new URL('../../schema.sql', import.meta.url), 'utf8');
const splitSql = sql => sql.split(/\r?\n/).filter(line => !line.trimStart().startsWith('--')).join('\n').split(SQL_SCRIPT_SEPARATOR).map(sql => sql.trim()).filter(Boolean);
async function call(db, handler, path, userId, body) {
  const response = await handler({
    request: new Request(`https://audit.test/api/${path}`, body === undefined ? {} : {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }),
    env: { tear_of_god_db: db, CACHE_METRIC_SAMPLE_RATE: '0' }, data: { user: userId ? { id: userId } : null },
  });
  return { status: response.status, body: await response.json() };
}

// Both requests finish their preflight before either can commit. This makes
// the race deterministic rather than depending on Miniflare/network timing.
function synchronizedCooldown(db) {
  let arrived = 0;
  let release;
  const barrier = new Promise(resolve => { release = resolve; });
  return {
    prepare(sql) {
      const statement = db.prepare(sql);
      if (!sql.includes('AS remaining_seconds')) return statement;
      return { bind(...args) {
        const bound = statement.bind(...args);
        return { async first() {
          const result = await bound.first();
          arrived += 1;
          if (arrived === 2) release();
          await barrier;
          return result;
        } };
      } };
    },
    batch: statements => db.batch(statements),
  };
}

try {
  const db = await mf.getD1Database('DB');
  await db.batch(splitSql(schema).map(sql => db.prepare(sql)));
  await db.prepare(`INSERT INTO profiles (id, username) VALUES
    ('owner', 'Owner'), ('voter', 'Voter'), ('challenger', 'Challenger'),
    ('pin-user', 'Pins'), ('custom-user', 'Custom'), ('invalid-user', 'Invalid'), ('reporter', 'Reporter')`).run();
  const tiers = [{ label: '__proto__', color: '#ffffff' }, { label: 'constructor', color: '#000000' }];
  await db.prepare('INSERT INTO templates (id, creator_id, title, tiers) VALUES (?, ?, ?, ?)')
    .bind('template', 'owner', 'Audit template', JSON.stringify(tiers)).run();
  await db.prepare("INSERT INTO rankings (id, user_id, template_id, likes_count) VALUES ('ranking', 'owner', 'template', 0)").run();
  await db.prepare("INSERT INTO template_items (id, template_id, item_id, tier, position) VALUES ('item', 'template', '__proto__', '__proto__', 0)").run();
  await db.prepare("INSERT INTO ranking_items (id, ranking_id, item_id, tier, position) VALUES ('placement', 'ranking', '__proto__', '__proto__', 0)").run();

  for (const state of ['like', 'dislike', null]) {
    const responses = await Promise.all(Array.from({ length: 6 }, () => call(db, vote, 'votes', 'voter', { rankingId: 'ranking', voteType: state })));
    responses.forEach(result => assert.equal(result.status, 200, JSON.stringify(result.body)));
    assert.deepEqual(await db.prepare("SELECT likes_count, dislikes_count FROM rankings WHERE id = 'ranking'").first(), {
      likes_count: Number(state === 'like'), dislikes_count: Number(state === 'dislike'),
    });
    assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM votes WHERE ranking_id = 'ranking'").first()).n, state === null ? 0 : 1);
  }
  assert.equal((await call(db, vote, 'votes', 'voter', { rankingId: 'missing', voteType: 'like' })).status, 404);
  for (const state of ['like', 'like', 'dislike', null]) {
    const results = await Promise.all(Array.from({ length: 4 }, () => call(db, templateVote, 'template-votes', 'voter', { template_id: 'template', voteType: state })));
    results.forEach(result => assert.deepEqual(result.body, { success: true, userVote: state, likes: Number(state === 'like'), dislikes: Number(state === 'dislike') }));
  }
  console.log('Concurrent ranking/template votes preserve exact counts and desired state; missing targets return 404.');

  await db.batch(Array.from({ length: 5 }, (_, index) => db.prepare('INSERT INTO rankings (id, user_id) VALUES (?, ?)').bind(`pin-${index}`, 'pin-user')));
  const pinned = await Promise.all(Array.from({ length: 5 }, (_, index) => call(db, pin, 'profile-pins', 'pin-user', { action: 'pin', ranking_id: `pin-${index}`, position: index % 3 })));
  assert.equal(pinned.filter(result => result.status === 200).length, 3);
  assert.equal(pinned.filter(result => result.status === 409).length, 2);
  const savedPin = await db.prepare("SELECT ranking_id FROM profile_pins WHERE user_id = 'pin-user' LIMIT 1").first();
  assert.equal((await call(db, pin, 'profile-pins', 'pin-user', { action: 'pin', ranking_id: savedPin.ranking_id, position: 2 })).status, 200);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM profile_pins WHERE user_id = 'pin-user'").first()).n, 3);
  console.log('Concurrent profile pins enforce cap while allowing existing pins to move.');

  const items = [{ item_id: '__proto__', tier: '__proto__', position: 0 }];
  const raceDb = synchronizedCooldown(db);
  const published = await Promise.all([
    call(raceDb, rankings, 'rankings', 'challenger', { payload: { title: 'Race', template_id: 'template' }, items }),
    call(raceDb, duel, 'duels', 'challenger', { template_id: 'template', items }),
  ]);
  assert.deepEqual(published.map(result => result.status).sort(), [201, 409]);
  assert.equal(published.find(result => result.status === 409).body.code, 'TEMPLATE_COOLDOWN_ACTIVE');
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM rankings WHERE user_id = 'challenger'").first()).n, 1);
  assert.equal((await db.prepare("SELECT use_count FROM templates WHERE id = 'template'").first()).use_count, 1);
  console.log('Fresh-schema ranking/duel cooldown race commits exactly once with HTTP 409 and no partial rows.');

  const custom = await call(db, rankings, 'rankings', 'custom-user', { payload: { title: 'Custom labels', template_id: 'template' }, items });
  assert.equal(custom.status, 201, JSON.stringify(custom.body));
  const aggregate = await call(db, template, 'templates?id=template', null);
  const customAverage = aggregate.body.data.community_average.tiers.find(tier => tier.label === '__proto__');
  assert.deepEqual(customAverage.items, [{ name: '__proto__', avg: 2, votes: 2 }]);
  for (const invalidItems of [items.concat(items), [{ ...items[0], position: -1 }], [{ ...items[0], item_id: {} }], Array.from({ length: 501 }, (_, i) => ({ ...items[0], item_id: `item-${i}` }))]) {
    assert.equal((await call(db, duel, 'duels', 'invalid-user', { template_id: 'template', items: invalidItems })).status, 400);
  }
  const both = await call(db, rankings, 'rankings', 'invalid-user', { payload: { template_id: 'template' }, template: {}, items });
  assert.equal(both.status, 400);
  const missingView = await call(db, view, 'templates', 'voter', { template_id: 'missing-template' });
  assert.equal(missingView.status, 404);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM template_views WHERE template_id = 'missing-template'").first()).n, 0);
  console.log('Prototype-named labels/items aggregate correctly; malformed duels and missing views leave no rows.');

  const reports = await Promise.all(Array.from({ length: 3 }, () => call(db, report, 'report', 'reporter', { ranking_id: 'ranking', reason: 'Audit report' })));
  assert.deepEqual(reports.map(result => result.status).sort(), [201, 409, 409]);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM reports WHERE ranking_id = 'ranking'").first()).n, 1);

  await db.prepare("UPDATE rankings SET hashtags = '#shared', likes_count = 2 WHERE id = 'ranking'").run();
  await db.prepare(`WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<60)
    INSERT INTO profiles(id,username) SELECT 'similar-'||n,'Similar '||n FROM seq`).run();
  await db.prepare(`WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<60)
    INSERT INTO rankings(id,user_id,hashtags) SELECT 'similar-ranking-'||n,'similar-'||n,'#shared' FROM seq`).run();
  let largestBind = 0;
  const checkedDb = { prepare(sql) { const statement = db.prepare(sql); return { bind(...args) {
    largestBind = Math.max(largestBind, args.length);
    assert.ok(args.length <= 100, `D1 binding limit exceeded: ${args.length}`);
    return statement.bind(...args);
  } }; } };
  const similar = await call(checkedDb, users, 'users?id=owner&fields=similar', null);
  assert.equal(similar.status, 200, JSON.stringify(similar.body));
  assert.equal(similar.body.data.similar_users.length, 3);
  assert.equal(largestBind, 60);
  const profile = await call(db, users, 'users?id=owner', null);
  assert.equal(profile.body.data.likes_received, 2);
  assert.deepEqual((await db.prepare('PRAGMA foreign_key_check').all()).results, []);
  console.log('Pending reports deduplicate atomically; 60-user taste comparison stays within D1 binding limits; profile reports total received likes.');
} finally {
  await mf.dispose();
}
