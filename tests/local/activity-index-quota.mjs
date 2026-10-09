import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { SQL_SCRIPT_SEPARATOR } from './helpers/sql.mjs';
import { onRequest } from '../../functions/api/activity.js';

const mf = new Miniflare(convertV4MiniflareOptions({ modules: true,
  script: 'export default {fetch(){return new Response("test")}}',
  compatibilityDate: '2026-01-01', d1Databases: ['DB'] }));
try {
  const db = await mf.getD1Database('DB');
  const schema = await readFile(new URL('../../schema.sql', import.meta.url), 'utf8');
  await db.batch(schema.split(SQL_SCRIPT_SEPARATOR).map(sql => db.prepare(sql)));
  await db.prepare("INSERT INTO profiles(id,username) VALUES ('viewer','Viewer'),('dense','Dense'),('sparse','Sparse'),('none','None')").run();
  await db.prepare("INSERT INTO follows(follower_id,following_id) VALUES ('viewer','dense'),('viewer','sparse'),('sparse','dense')").run();
  await db.prepare(`WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<2000)
    INSERT INTO rankings(id,title,user_id,created_at)
    SELECT printf('r%04d',n),'Rank '||n,'dense',datetime('now','-'||n||' minutes') FROM seq`).run();
  await db.prepare("INSERT INTO votes(id,ranking_id,user_id,vote_type,created_at) SELECT 'v'||id,id,'dense','like',created_at FROM rankings").run();
  const insertRanking = db.prepare('INSERT INTO rankings(id,title,user_id,created_at) VALUES (?,?,?,?)');
  const now = new Date();
  const stamp = now.toISOString().replace('T',' ').slice(0,19);
  await db.batch([
    insertRanking.bind('sparse-new','Sparse new','sparse',stamp),
    insertRanking.bind('legacy-iso','Legacy ISO','sparse',now.toISOString()),
    insertRanking.bind('old','Old','sparse','2020-01-01 00:00:00'),
    insertRanking.bind('outsider','Private to follows','none',stamp),
  ]);
  await db.prepare("INSERT INTO votes(id,ranking_id,user_id,vote_type,created_at) VALUES ('tie','sparse-new','sparse','like',?),('disliked','outsider','sparse','dislike',?)").bind(stamp,stamp).run();
  let reads = 0;
  const traced = { prepare(sql) {
    const wrap = stmt => ({ bind: (...args) => wrap(stmt.bind(...args)), all: async () => {
      const result = await stmt.all(); reads += result.meta.rows_read; return result;
    } });
    return wrap(db.prepare(sql));
  } };
  async function check(user, limit) {
    // Unbounded reference query expresses the original contract independently
    // of the per-person candidate selection used by the optimized handler.
    const oracle = await db.prepare(`WITH events AS (
      SELECT CASE WHEN r.template_id IS NULL THEN 'ranking_created' ELSE 'template_used' END AS type,
        r.id AS ranking_id,r.user_id AS actor_id,r.created_at AS occurred_at
      FROM rankings r JOIN follows f ON f.following_id=r.user_id
      WHERE f.follower_id=?1 AND r.created_at>=datetime('now','-90 days')
      UNION ALL
      SELECT 'liked_ranking',r.id,v.user_id,v.created_at FROM votes v
      JOIN follows f ON f.following_id=v.user_id JOIN rankings r ON r.id=v.ranking_id
      WHERE f.follower_id=?1 AND v.vote_type='like' AND v.created_at>=datetime('now','-90 days')
    ) SELECT * FROM events ORDER BY datetime(occurred_at) DESC,ranking_id DESC,type ASC LIMIT ?2`).bind(user,limit).all();
    reads = 0;
    const response = await onRequest({ request: new Request(`https://test/api/activity?limit=${limit}`),
      env: { tear_of_god_db: traced }, data: { user: { id: user } } });
    assert.equal(response.status,200);
    assert.equal(response.headers.get('Cache-Control'),'private, no-store');
    const result = await response.json();
    assert.deepEqual(result.data.map(e => ({ type:e.type,ranking_id:e.ranking.id,actor_id:e.actor.id,occurred_at:e.occurred_at })),oracle.results);
    return { before:oracle.meta.rows_read,after:reads };
  }
  const dense = await check('sparse',20);
  assert(dense.after < 500 && dense.after < dense.before/10,JSON.stringify(dense));
  for (const user of ['viewer','sparse','none']) for (const limit of [1,12,20,50]) await check(user,limit);
  const indexes = ['idx_rankings_template_created','idx_rankings_activity_user_time','idx_votes_activity_user_time'];
  for (const name of indexes) await db.prepare(`DROP INDEX ${name}`).run();
  for (const user of ['viewer','sparse','none']) await check(user,20);
  const beforeWrite = (await db.prepare("INSERT INTO rankings(id,user_id) VALUES ('write-before','dense')").run()).meta.rows_written;
  const migration = await readFile(new URL('../../migrations-active/0028_quota_read_indexes.sql',import.meta.url),'utf8');
  for (let pass=0;pass<2;pass++) await db.batch(migration.split(SQL_SCRIPT_SEPARATOR).map(sql => db.prepare(sql)));
  const afterWrite = (await db.prepare("INSERT INTO rankings(id,user_id) VALUES ('write-after','dense')").run()).meta.rows_written;
  await check('viewer',50);
  assert.deepEqual((await db.prepare('PRAGMA foreign_key_check').all()).results,[]);
  console.log(JSON.stringify({ denseFollowHistory:dense,rankingInsertRowsWritten:{before:beforeWrite,after:afterWrite} }));
  console.log('Activity ordering, mixed timestamps, ties, sparse/no follows, old schema and additive migration checks passed.');
} finally { await mf.dispose(); }
