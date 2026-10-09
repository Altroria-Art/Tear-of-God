import { SQL_SCRIPT_SEPARATOR } from './helpers/sql.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { onRequestGet } from '../../functions/api/discover-pulse.js';
import { onRequest as middleware } from '../../functions/api/_middleware.js';

const mf = new Miniflare(convertV4MiniflareOptions({ modules: true,
  script: 'export default {fetch(){return new Response("test")}}',
  compatibilityDate: '2026-01-01', d1Databases: ['DB'] }));
const dbTime = date => date.toISOString().slice(0, 19).replace('T', ' ');
const hoursAgo = hours => dbTime(new Date(Date.now() - hours * 3600000));
let reads = 0;
let queries = 0;
try {
  const db = await mf.getD1Database('DB');
  const schema = await readFile(new URL('../../schema.sql', import.meta.url), 'utf8');
  await db.batch(schema.split(/\r?\n/).filter(line => !line.trimStart().startsWith('--')).join('\n')
    .split(SQL_SCRIPT_SEPARATOR).map(sql => sql.trim()).filter(Boolean).map(sql => db.prepare(sql)));
  // Rehearse the additive migration against the previous index layout.
  await db.prepare('DROP INDEX idx_votes_ranking_created').run();
  await db.prepare('DROP INDEX idx_comments_ranking_created').run();
  await db.prepare('DROP INDEX idx_rankings_feed_activity').run();
  await db.prepare('CREATE INDEX idx_comments_ranking_id ON comments(ranking_id)').run();
  const migration = await readFile(new URL('../../migrations-active/0026_discover_pulse_activity_indexes.sql', import.meta.url), 'utf8');
  await db.batch(migration.split(/\r?\n/).filter(line => !line.trimStart().startsWith('--')).join('\n')
    .split(SQL_SCRIPT_SEPARATOR).map(sql => sql.trim()).filter(Boolean).map(sql => db.prepare(sql)));
  const activityMigration = await readFile(new URL('../../migrations-active/0027_discover_pulse_activity_window_index.sql', import.meta.url), 'utf8');
  await db.batch(activityMigration.split(/\r?\n/).filter(line => !line.trimStart().startsWith('--')).join('\n')
    .split(SQL_SCRIPT_SEPARATOR).map(sql => sql.trim()).filter(Boolean).map(sql => db.prepare(sql)));
  const commentIndexes = (await db.prepare("PRAGMA index_list('comments')").all()).results.map(row => row.name);
  const voteIndexes = (await db.prepare("PRAGMA index_list('votes')").all()).results.map(row => row.name);
  assert(commentIndexes.includes('idx_comments_ranking_created') && !commentIndexes.includes('idx_comments_ranking_id'));
  assert(voteIndexes.includes('idx_votes_ranking_created'));
  const activityPlan = await db.prepare(`EXPLAIN QUERY PLAN SELECT id FROM rankings
    WHERE COALESCE(last_activity_at, created_at) >= ? AND COALESCE(last_activity_at, created_at) < ?
    ORDER BY COALESCE(last_activity_at, created_at) DESC, id DESC LIMIT 40`).bind(hoursAgo(6), hoursAgo(0)).all();
  assert(activityPlan.results.some(row => row.detail.includes('idx_rankings_feed_activity')),
    'Recent-activity candidate lookup must use its expression index');
  await db.prepare("INSERT INTO profiles(id,username) VALUES ('a','Alice'),('b','Bob')").run();
  await db.prepare("INSERT INTO templates(id,title,hashtags,creator_id,tiers) VALUES ('food','Food takes','#Food','a','[]'),('game','Game takes','#Games','b','[]'),('old','Old topic','#Old','a','[]')").run();
  await db.prepare("INSERT INTO items(id,name) VALUES ('named','Ramen'),('unnamed',NULL)").run();
  await db.prepare("INSERT INTO template_items(id,template_id,item_id,position) VALUES ('preview-named','food','named',0),('preview-unnamed','food','unnamed',1)").run();
  for (const [id, templateId, created, activity, hashtags] of [
    ['now', 'food', hoursAgo(1), null, '#Food'],
    ['today', 'game', hoursAgo(12), null, '#Games'],
    ['week', 'food', hoursAgo(72), hoursAgo(.5), '#Food'],
    ['last', 'old', hoursAgo(240), null, '#Old'],
    ['revived', 'food', hoursAgo(480), hoursAgo(2), '#Food'],
  ]) await db.prepare('INSERT INTO rankings(id,title,user_id,template_id,hashtags,created_at,last_activity_at) VALUES (?,?,?,?,?,?,?)')
    .bind(id, `Take ${id}`, 'a', templateId, hashtags, created, activity).run();
  await db.prepare("INSERT INTO comments(id,ranking_id,user_id,content,created_at) VALUES ('c','week','b','A real comment',?)").bind(hoursAgo(.5)).run();
  await db.prepare("INSERT INTO votes(id,ranking_id,user_id,vote_type,created_at) VALUES ('v','revived','b','like',?)").bind(hoursAgo(2)).run();

  const traced = { prepare(sql) {
    const wrap = statement => ({ bind: (...args) => wrap(statement.bind(...args)),
      all: async () => { const result = await statement.all(); reads += result.meta.rows_read; queries++; return result; } });
    return wrap(db.prepare(sql));
  } };
  const entries = new Map();
  globalThis.caches = { default: {
    match: async key => entries.get(key.url)?.clone(),
    put: async (key, response) => { entries.set(key.url, response.clone()); },
  } };
  async function measure(window, headers = {}) {
    reads = 0; queries = 0;
    const response = await onRequestGet({ request: new Request(`https://example.test/api/discover-pulse?window=${window}`, { headers }),
      env: { tear_of_god_db: traced } });
    return { status: response.status, body: await response.json(), reads, queries,
      cacheControl: response.headers.get('Cache-Control') };
  }

  const now = await measure('now');
  assert.equal(now.status, 200);
  assert.equal(now.body.window, 'now');
  assert.equal(now.body.active_rankings, 3);
  assert.equal(now.body.topics[0].label, '#food');
  assert.equal(now.body.topics[0].ranking_count, 1);
  assert.equal(now.body.topics[0].comments, 1);
  assert.equal(now.body.topics[0].reactions, 1);
  assert.equal(now.body.discussions[0].id, 'week');
  assert.deepEqual(now.body.templates.find(template => template.id === 'food').preview_items.map(item => item.name), ['Ramen']);
  assert.equal(now.cacheControl, 'public, max-age=120');
  const warm = await measure('now');
  assert.equal(warm.reads, 0, 'Public cache prevents repeat D1 reads');
  assert.deepEqual(warm.body, now.body);
  assert((await measure('now', { 'Cache-Control': 'no-cache' })).reads > 0, 'Explicit bypass refreshes Pulse');
  const today = await measure('today');
  assert.equal(today.body.active_rankings, 4);
  assert.equal(today.cacheControl, 'public, max-age=300');
  const week = await measure('week');
  assert.equal(week.body.active_rankings, 4);
  assert.equal(week.cacheControl, 'public, max-age=600');
  const lastWeek = await measure('last_week');
  assert.equal(lastWeek.body.active_rankings, 1);
  assert.equal(lastWeek.body.topics[0].label, '#old');
  assert.equal(lastWeek.cacheControl, 'public, max-age=1800');
  assert.equal((await measure('wrong')).status, 400);

  const publicResponse = await middleware({
    request: new Request('https://example.test/api/discover-pulse?window=now', { headers: { Cookie: 'session=ignored' } }),
    env: { tear_of_god_db: { prepare() { throw new Error('Pulse must not read sessions'); } } },
    data: {}, next: async () => Response.json({ success: true }, { headers: { 'Cache-Control': 'public, max-age=120' } }),
  });
  assert.equal(publicResponse.status, 200);
  assert.equal(publicResponse.headers.get('Cache-Control'), 'public, max-age=120');
  assert.equal(publicResponse.headers.get('Vary'), null);

  await db.prepare(`WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<1000)
    INSERT INTO profiles(id,username) SELECT 'old-user-'||n,'Old user '||n FROM seq`).run();
  await db.prepare(`WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<1000)
    INSERT INTO comments(id,ranking_id,user_id,content,created_at)
    SELECT 'old-comment-'||n,'now','old-user-'||n,'Historic comment',datetime('now','-30 days') FROM seq`).run();
  await db.prepare(`WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<1000)
    INSERT INTO votes(id,ranking_id,user_id,vote_type,created_at)
    SELECT 'old-vote-'||n,'now','old-user-'||n,'like',datetime('now','-30 days') FROM seq`).run();
  const historic = await measure('now', { 'Cache-Control': 'no-cache' });
  assert.equal(historic.body.topics[0].comments, 1);
  assert.equal(historic.body.topics[0].reactions, 1);
  assert(historic.reads < 250, `Time-range indexes must skip 2,000 historic interactions (${historic.reads} reads)`);

  await db.prepare('DELETE FROM comments').run();
  await db.prepare('DELETE FROM votes').run();
  await db.prepare('DELETE FROM rankings').run();
  await db.prepare('INSERT INTO rankings(id,title,user_id,template_id,hashtags,created_at) VALUES (?,?,?,?,?,?)')
    .bind('quiet-today', 'Today only', 'a', 'food', '#Food', hoursAgo(12)).run();
  const fallbackToday = await measure('now', { 'Cache-Control': 'no-cache' });
  assert.equal(fallbackToday.body.window, 'today');
  assert.equal(fallbackToday.body.fallback_from, 'now');
  await db.prepare('DELETE FROM rankings').run();
  await db.prepare('INSERT INTO rankings(id,title,user_id,template_id,hashtags,created_at) VALUES (?,?,?,?,?,?)')
    .bind('quiet-week', 'Week only', 'a', 'food', '#Food', hoursAgo(72)).run();
  const fallbackWeek = await measure('today', { 'Cache-Control': 'no-cache' });
  assert.equal(fallbackWeek.body.window, 'week');
  assert.equal(fallbackWeek.body.fallback_from, 'today');
  await db.prepare('DELETE FROM rankings').run();
  const empty = await measure('now', { 'Cache-Control': 'no-cache' });
  assert.equal(empty.body.window, 'week');
  assert.equal(empty.body.active_rankings, 0);
  assert.deepEqual(empty.body.topics, []);

  await db.prepare(`WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<2000)
    INSERT INTO rankings(id,title,user_id,template_id,hashtags,created_at)
    SELECT printf('bulk%04d',n),'Bulk '||n,'a','food','#Food',datetime('now','-'||n||' minutes') FROM seq`).run();
  const bounded = await measure('now', { 'Cache-Control': 'no-cache' });
  assert.equal(bounded.body.sampled, true);
  assert(bounded.body.active_rankings <= 80);
  assert(bounded.reads < 1000, `Index-backed bounded query read ${bounded.reads} rows from 2,000 rankings`);
  console.log(JSON.stringify({ windows: ['now', 'today', 'week', 'last_week'],
    fallback: ['today', 'week', 'empty'], cache: 'warm 0 D1 reads',
    historicalInteractions: { fixtureRows: 2000, rowsRead: historic.reads },
    bounded: { fixtureRankings: 2000, selected: bounded.body.active_rankings, rowsRead: bounded.reads, queries: bounded.queries } }, null, 2));
} finally { delete globalThis.caches; await mf.dispose(); }
