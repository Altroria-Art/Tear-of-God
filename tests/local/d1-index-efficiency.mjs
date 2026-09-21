import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { onRequestGet as templates } from '../../functions/api/templates.js';
import { onRequest as admin } from '../../functions/api/admin/index.js';

const statements = sql => sql.split(/\r?\n/).filter(l=>!l.trimStart().startsWith('--')).join('\n').split(';').map(s=>s.trim()).filter(Boolean);
const oldIndexes = [
  'CREATE INDEX IF NOT EXISTS idx_rankings_user_id ON rankings(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_votes_ranking_id ON votes(ranking_id)',
  'CREATE INDEX IF NOT EXISTS idx_template_items_template_id ON template_items(template_id)',
  'CREATE INDEX IF NOT EXISTS idx_ris_ranking ON ranking_item_scores(ranking_id)',
  'CREATE INDEX IF NOT EXISTS idx_template_reactions_template ON template_reactions(template_id)',
  'CREATE INDEX IF NOT EXISTS idx_templates_use_count ON templates(use_count DESC, created_at DESC, id DESC)',
  'CREATE INDEX IF NOT EXISTS idx_templates_view_count ON templates(view_count DESC, use_count DESC, id DESC)',
  'CREATE INDEX IF NOT EXISTS idx_analytics_user_created ON analytics_events(user_id, created_at DESC)',
];
const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:'export default {fetch(){return new Response("test")}}',compatibilityDate:'2026-01-01',d1Databases:['DB']}));
try {
  const db=await mf.getD1Database('DB');
  const schema = (await readFile(new URL('../../schema.sql',import.meta.url),'utf8'))
    .replace(/(CREATE TABLE IF NOT EXISTS analytics_events[\s\S]*?)\) WITHOUT ROWID;/,'$1);');
  await db.batch(statements(schema).map(s=>db.prepare(s)));
  // Reconstruct the pre-0012 schema independently of git or local snapshots.
  await db.batch(['DROP INDEX idx_analytics_user_created_nonnull','DROP INDEX idx_templates_created',...oldIndexes].map(s=>db.prepare(s)));
  await db.prepare("INSERT INTO profiles(id,username,role) VALUES ('author','Author','user'),('viewer','Viewer','admin')").run();
  await db.prepare(`WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<500)
    INSERT INTO templates(id,title,creator_id,tiers,created_at)
    SELECT printf('t%03d',n),'Template '||n,'author','[]',datetime('2026-01-01','+'||n||' minutes') FROM seq`).run();
  await db.prepare(`WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<10)
    INSERT INTO rankings(id,user_id,template_id) SELECT t.id||':'||n,'author',t.id FROM templates t,seq`).run();
  await db.prepare(`WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<1000)
    INSERT INTO analytics_events(id,event_name,session_id,user_id,created_at)
    SELECT 'e'||n,CASE n%5 WHEN 0 THEN 'feed_view' WHEN 1 THEN 'template_view' WHEN 2 THEN 'ranking_start' WHEN 3 THEN 'ranking_publish' ELSE 'share_complete' END,
    's'||(n/5),CASE WHEN n%3=0 THEN 'viewer' ELSE NULL END,datetime('now','-'||(n%60)||' days') FROM seq`).run();

  async function endpoint(handler,path) {
    let read=0;
    const traced={prepare(sql){
      const wrap=stmt=>({bind:(...args)=>wrap(stmt.bind(...args)),all:async()=>{const r=await stmt.all();read+=r.meta.rows_read;return r;},first:async()=>{const r=await stmt.all();read+=r.meta.rows_read;return r.results[0]??null;}});
      return wrap(db.prepare(sql));
    }};
    const response=await handler({request:new Request('https://test'+path),env:{tear_of_god_db:traced},data:{user:{id:'viewer'}}});
    assert.equal(response.status,200);
    return {body:await response.json(),read};
  }
  async function writes() {
    const probes={
      guest_event:"INSERT INTO analytics_events(id,event_name,session_id) VALUES ('probe-guest','feed_view','probe')",
      authenticated_event:"INSERT INTO analytics_events(id,event_name,session_id,user_id) VALUES ('probe-auth','feed_view','probe','viewer')",
      ranking:"INSERT INTO rankings(id,user_id,template_id) VALUES ('probe-rank','viewer','t001')",
      score:"INSERT INTO ranking_item_scores(id,ranking_id,template_id,item_id,tier_index,score) VALUES ('probe-score','probe-rank','t001','x',0,2)",
      template_item:"INSERT INTO template_items(id,template_id,item_id,position) VALUES ('probe-item','t001','x',0)",
      vote:"INSERT INTO votes(id,ranking_id,user_id,vote_type) VALUES ('probe-vote','probe-rank','viewer','like')",
      reaction:"INSERT INTO template_reactions(id,template_id,user_id,vote_type) VALUES ('probe-reaction','t001','viewer','like')",
      use_counter:"UPDATE templates SET use_count=use_count+1 WHERE id='t001'",
      view_counter:"UPDATE templates SET view_count=view_count+1 WHERE id='t001'",
    };
    const measured={};
    for(const [name,sql] of Object.entries(probes)) measured[name]=(await db.prepare(sql).run()).meta.rows_written;
    await db.batch([
      "DELETE FROM analytics_events WHERE id IN ('probe-guest','probe-auth')",
      "DELETE FROM rankings WHERE id='probe-rank'",
      "DELETE FROM template_items WHERE id='probe-item'",
      "DELETE FROM template_reactions WHERE id='probe-reaction'",
      "UPDATE templates SET use_count=use_count-1,view_count=view_count-1 WHERE id='t001'",
    ].map(s=>db.prepare(s)));
    return measured;
  }
  const beforeWrites=await writes();
  const paths=['/api/templates?sort=recent&limit=12','/api/templates?sort=recent&limit=12&page=2','/api/templates?sort=popular&limit=12','/api/templates?sort=views&limit=12'];
  const before=[];
  for(const path of paths) before.push(await endpoint(templates,path));
  const beforeAnalytics=await endpoint(admin,'/api/admin?action=analytics&days=7');
  const migration=statements(await readFile(new URL('../../migrations-active/0012_d1_index_efficiency.sql',import.meta.url),'utf8'));
  await db.batch(migration.map(s=>db.prepare(s)));
  await db.batch(migration.map(s=>db.prepare(s))); // Idempotent.
  const afterWrites=await writes();
  assert.equal(afterWrites.guest_event,beforeWrites.guest_event-1);
  assert.equal(afterWrites.authenticated_event,beforeWrites.authenticated_event);
  assert.equal(afterWrites.score,beforeWrites.score,'Preserve the ranking lookup on unreconciled production schemas');
  for(const name of ['ranking','template_item','vote','reaction','use_counter','view_counter']) assert.ok(afterWrites[name]<beforeWrites[name],name);
  console.log(JSON.stringify({rows_written_before:beforeWrites,rows_written_after:afterWrites}));
  for(let i=0;i<paths.length;i++) {
    const after=await endpoint(templates,paths[i]);
    assert.deepEqual(after.body,before[i].body,paths[i]);
    if(i===0) assert.ok(after.read<before[i].read/5);
    console.log(`${paths[i]} rows_read ${before[i].read} -> ${after.read}`);
  }
  const afterAnalytics=await endpoint(admin,'/api/admin?action=analytics&days=7');
  assert.deepEqual(afterAnalytics.body,beforeAnalytics.body);
  console.log(`Admin analytics rows_read ${beforeAnalytics.read} -> ${afterAnalytics.read}; exact response preserved`);
  // The partial user index must still support foreign-key SET NULL without losing events.
  const count=(await db.prepare('SELECT COUNT(*) n FROM analytics_events').first()).n;
  await db.prepare("DELETE FROM profiles WHERE id='viewer'").run();
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM analytics_events').first()).n,count);
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM analytics_events WHERE user_id IS NOT NULL').first()).n,0);
  assert.deepEqual((await db.prepare('PRAGMA foreign_key_check').all()).results,[]);
  for(const sql of [
    "SELECT * FROM ranking_item_scores WHERE ranking_id='r'",
    "SELECT * FROM template_items WHERE template_id='t001'",
    "SELECT * FROM votes WHERE ranking_id='r'",
    "SELECT * FROM template_reactions WHERE template_id='t001'",
    "SELECT * FROM rankings WHERE user_id='author' ORDER BY created_at DESC,id DESC LIMIT 12",
    "SELECT * FROM analytics_events WHERE user_id='viewer'",
  ]) {
    const plan=(await db.prepare('EXPLAIN QUERY PLAN '+sql).all()).results.map(r=>r.detail).join('\n');
    assert.match(plan,/SEARCH .*INDEX/);
    assert.doesNotMatch(plan,/SCAN (ranking_item_scores|template_items|votes|template_reactions|rankings|analytics_events)/);
  }
  console.log('Indexed lookups, report equivalence, guest write reduction, FK behavior and migration repeat checks passed');
} finally {await mf.dispose();}
