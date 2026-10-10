import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { SQL_SCRIPT_SEPARATOR } from './helpers/sql.mjs';
import { seedLatestContributions } from './helpers/contributions.mjs';
import { buildCommunityAverage } from '../../functions/lib/community-average.js';
import { buildDiscoverCommunityBoard } from '../../src/lib/discoverCommunityBoard.js';
import { onRequestGet as templateGet } from '../../functions/api/templates.js';
import { onRequestGet } from '../../functions/api/discover-boards.js';
import { onRequest as middleware } from '../../functions/api/_middleware.js';

const mf = new Miniflare(convertV4MiniflareOptions({ modules: true, script: 'export default {fetch(){return new Response("test")}}', compatibilityDate: '2026-01-01', d1Databases: ['DB'] }));
try {
  const db = await mf.getD1Database('DB');
  const schema = await readFile(new URL('../../schema.sql', import.meta.url), 'utf8');
  await db.batch(schema.split(/\r?\n/).filter(line => !line.trimStart().startsWith('--')).join('\n').split(SQL_SCRIPT_SEPARATOR).map(sql => sql.trim()).filter(Boolean).map(sql => db.prepare(sql)));
  await db.prepare("INSERT INTO profiles(id,username,email) VALUES ('creator','Topic creator','private@example.test'),('author','Latest author','author@example.test'),('viewer','Viewer','viewer@example.test')").run();
  const tiers = [{ label: 'S', color: '#123456' }, { label: 'แนะนำสำหรับเด็กมหาลัย', color: 'bg-[#abcdef]' }, { label: 'ว่าง', color: '#987654' }];
  for (const count of [0, 12, 13, 100, 500]) {
    const id = `topic-${count}`;
    await db.prepare('INSERT INTO templates(id,title,creator_id,tiers) VALUES (?,?,?,?)').bind(id, `Topic ${count}`, 'creator', JSON.stringify(tiers)).run();
    await db.prepare("INSERT INTO rankings(id,template_id,title,user_id,created_at,comments_count) VALUES (?,?,?,'creator','2026-01-01 00:00:00',1),(?,?,?,'author','2026-01-02 00:00:00',3)")
      .bind(`old-${count}`, id, 'Old post', `new-${count}`, id, 'Latest post').run();
    const statements = [];
    await db.prepare("INSERT INTO rankings(id,template_id,title,user_id,created_at) VALUES (?,?,?,'author','2025-12-31 00:00:00')").bind(`superseded-${count}`, id, 'Superseded vote').run();
    await db.prepare('INSERT INTO template_comments(id,template_id,user_id,content) VALUES (?,?,?,?)').bind(`comment-${count}`, id, 'viewer', 'Community discussion').run();
    for (let item = 0; item < count; item++) {
      const itemId = `${id}-${item}`;
      statements.push(db.prepare('INSERT INTO items(id,name,image_url) VALUES (?,?,?)').bind(itemId, `รายการที่ ${item} ${'ชื่อภาษาไทยยาว'.repeat(6)}`, item === 0 ? '/broken-qa-image.png' : null));
      statements.push(db.prepare('INSERT INTO ranking_items(id,ranking_id,item_id,tier,position) VALUES (?,?,?,?,?)').bind(itemId, `new-${count}`, itemId, tiers[item % 2].label, item));
      statements.push(db.prepare('INSERT INTO template_items(id,template_id,item_id,position) VALUES (?,?,?,?)').bind(itemId, id, itemId, item));
      // Unscored items stay visible; historical votes cannot inflate the mean.
      if (item === count - 1) continue;
      for (const [post, score] of [[`old-${count}`, 1], [`superseded-${count}`, 1], [`new-${count}`, 3]]) {
        statements.push(db.prepare('INSERT INTO ranking_item_scores(id,ranking_id,template_id,item_id,tier_index,score,created_at) VALUES (?,?,?,?,?,?,?)')
          .bind(`${post}-${item}`, post, id, itemId, 3 - score, score, '2026-01-01 00:00:00'));
      }
    }
    if (statements.length) await db.batch(statements);
  }
  await db.prepare("INSERT INTO templates(id,title,creator_id,tiers) VALUES ('unposted','Not posted','creator','[]'),('legacy','Legacy','creator','[]')").run();
  await db.batch(Array.from({ length: 13 }, (_, n) => db.prepare('INSERT INTO template_items(id,template_id,item_id,tier,position) VALUES (?,\'unposted\',?,\'S\',?)').bind(`pool-${n}`, `Legacy name ${n}`, n)));
  await db.prepare("INSERT INTO rankings(id,template_id,title,user_id,created_at) VALUES ('tie-a','legacy','Lower ID','creator','2026-01-03 00:00:00'),('tie-z','legacy','Tie winner','author','2026-01-03 00:00:00')").run();
  await db.prepare("INSERT INTO ranking_items(id,ranking_id,item_id,tier,position) VALUES ('legacy-item','tie-z','Legacy name','Custom tier',0),('unranked-item','tie-z','Unranked name',NULL,1)").run();
  await db.prepare("UPDATE templates SET tiers=? WHERE id='legacy'").bind(JSON.stringify(tiers)).run();
  await db.prepare("INSERT INTO ranking_item_scores(id,ranking_id,template_id,item_id,tier_index,score) VALUES ('legacy-score','tie-z','legacy','Legacy name',0,3)").run();
  await seedLatestContributions(db);
  const entries = new Map();
  globalThis.caches = { default: { match: async key => entries.get(key.url)?.clone(), put: async (key, response) => entries.set(key.url, response.clone()) } };
  let queries = 0, reads = 0;
  const traced = { prepare(sql) { const wrap = statement => ({ bind: (...args) => wrap(statement.bind(...args)), all: async () => { const result = await statement.all(); queries++; reads += result.meta.rows_read; return result; } }); return wrap(db.prepare(sql)); } };
  async function request(ids, { user, fresh = false, counters = false } = {}) {
    const context = { request: new Request('https://test/api/discover-boards?ids=' + encodeURIComponent(ids), { headers: { ...(user ? { Cookie: `session=${user}` } : {}), ...(fresh ? { 'Cache-Control': 'no-cache' } : {}) } }), env: { tear_of_god_db: traced, TEMPLATE_USAGE_COUNTERS: counters ? 'true' : 'false' }, data: { user: user ? { id: user } : null } };
    context.next = () => onRequestGet(context);
    const response = await middleware(context);
    return { status: response.status, body: await response.json(), headers: response.headers };
  }
  const ids = 'topic-0,topic-12,topic-13,topic-100,topic-500,unposted,legacy,deleted-topic';
  const cold = await request(ids, { user: 'viewer' });
  assert.equal(cold.status, 200);
  assert.equal(queries, 3, 'One metadata, one complete pool and one histogram query per batch');
  const coldReads = reads;
  assert(coldReads < 7500, 'Aggregate batch stays below the measured 8,329-row unoptimized query on this fixture');
  for (const count of [0, 12, 13, 100, 500]) {
    const board = cold.body.data.find(board => board.template.id === `topic-${count}`);
    const result = buildDiscoverCommunityBoard(board);
    assert.equal(result.itemCount, count);
    assert.equal(result.unranked.length, count ? 1 : 0);
    assert.equal(result.rows[0].items.length, 0, 'Community differs from latest personal S ranking');
    assert.equal(result.rows[1].items.length, Math.max(0, count - 1));
    assert(result.rows[1].items.every(item => item.avg === 2 && item.votes === 2), 'One current vote per user, not historical repeat votes');
    assert.equal(board.participant_count, 2); assert.equal(board.template.use_count, 3);
    assert.equal(board.stats.comments, 1, 'Community comments, not latest-post comments');
    assert.equal(board.community_average.updated_at, '2026-01-02 00:00:00');
    assert.deepEqual(board.template.tiers, tiers);
    const detail = await (await templateGet({ request: new Request(`https://test/api/templates?id=topic-${count}`), env: { tear_of_god_db: db }, data: {} })).json();
    assert.deepEqual(board.community_average, detail.data.community_average, 'Discover and existing community detail agree');
  }
  const boundary = buildCommunityAverage(tiers, [{ item_id: '__proto__', score: 2, n: 501 }, { item_id: '__proto__', score: 3, n: 499 }], null);
  assert.equal(boundary.tiers[1].items[0].avg, 2.5, 'Assign tier before rounding the displayed mean');
  assert.equal(boundary.tiers[1].items[0].votes, 1000);
  assert(!cold.body.data.some(board => board.template.id === 'deleted-topic'));
  const pool = cold.body.data.find(board => board.template.id === 'unposted');
  assert.equal(pool.participant_count, 0); assert.equal(buildDiscoverCommunityBoard(pool).unranked.length, 13);
  assert(pool.community_average.tiers.every(tier => !tier.items.length), 'Assigned template tiers are not invented community votes');
  assert.equal(pool.template_items[12].item.name, 'Legacy name 12');
  const legacy = cold.body.data.find(board => board.template.id === 'legacy');
  assert.equal(buildDiscoverCommunityBoard(legacy).rows[0].items[0].name, 'Legacy name', 'Scored items removed from pool retain identity');
  assert(!/email|profile|username|ranking_id|is_saved|user_vote|is_following|private@example|session/.test(JSON.stringify(cold.body)), 'No identities or viewer-specific fields in public community boards');
  assert.match(cold.headers.get('Cache-Control'), /^public/); assert.equal(cold.headers.get('Vary'), null);
  assert.deepEqual((await request(ids, { fresh: true, counters: true })).body, cold.body, 'Exact usage counters and COUNT fallback agree');
  assert.equal(buildDiscoverCommunityBoard((await request(Array.from({ length: 12 }, (_, n) => n ? `missing-${n}` : 'topic-500').join(','))).body.data[0]).itemCount, 500, 'Maximum batch size includes full boards');
  queries = 0; reads = 0;
  const warm = await request(ids.split(',').reverse().join(','), { user: 'other' });
  assert.equal(queries, 0, 'Authenticated shared cache hit skips D1 and session lookup');
  assert.deepEqual(warm.body, cold.body);
  for (const invalid of ['', 'good,', "x');DELETE", Array.from({ length: 13 }, (_, n) => `t${n}`).join(',')]) assert.equal((await request(invalid)).status, 400);
  entries.clear(); queries = 0;
  await Promise.all(Array.from({ length: 8 }, () => request(ids)));
  assert.equal(queries, 3, 'Concurrent cold requests share the batch');
  await db.prepare("DELETE FROM rankings WHERE id='tie-z'").run();
  assert.equal((await request('legacy', { fresh: true })).body.data[0].participant_count, 1, 'Deleted current contribution no longer participates');
  await db.prepare("DELETE FROM rankings WHERE id='new-13'").run();
  const deleted = (await request('topic-13', { fresh: true })).body.data[0];
  assert.equal(deleted.participant_count, 1);
  assert(buildDiscoverCommunityBoard(deleted).rows[2].items.every(item => item.avg === 1 && item.votes === 1), 'Deleted contribution does not restore a superseded vote');
  await db.prepare("DELETE FROM rankings WHERE template_id='legacy'").run();
  assert.equal((await request('legacy', { fresh: true })).body.data[0].template.use_count, 0);
  await db.prepare("DELETE FROM templates WHERE id='legacy'").run();
  assert.deepEqual((await request('legacy', { fresh: true })).body.data, []);
  for (const response of entries.values()) response.headers.set('X-Public-Expires', '0');
  queries = 0; await request(ids); assert.equal(queries, 3, 'Expired board snapshot reloads');
  globalThis.caches.default.match = async () => { throw Error('Cache outage'); };
  globalThis.caches.default.put = async () => { throw Error('Cache outage'); };
  assert.equal(buildDiscoverCommunityBoard((await request('topic-500')).body.data[0]).itemCount, 500);
  console.log(JSON.stringify({ scenarios: 'community/detail parity, two voters vs latest post, one current vote per person, boundary before rounding, complete 0/12/13/100/500 items, empty/custom tiers, unranked pool, deleted contributions/topics, public privacy, validation, cache/expiry/outage/burst', coldQueries: 3, coldReads, cachedQueries: 0 }));
} finally { delete globalThis.caches; await mf.dispose(); }
