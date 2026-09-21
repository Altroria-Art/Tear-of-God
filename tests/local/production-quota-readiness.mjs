import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';

// Inputs contain production DDL and aggregate counts only, never user records.
const read = path=>readFile(new URL('../../'+path,import.meta.url),'utf8');
const snapshot=JSON.parse((await read('.wrangler/production-readiness-schema.json')).replace(/^\uFEFF/,''));
const counts=JSON.parse((await read('.wrangler/production-readiness-counts.json')).replace(/^\uFEFF/,''));
const ddl=snapshot[1].results.map(r=>r.sql).filter(Boolean);
const aggregate=Object.fromEntries(counts.flatMap(r=>r.results).filter(r=>r.object).map(r=>[r.object,r]));
function split(sql) {
  let buffer='',trigger=false; const out=[];
  for(const line of sql.split(/\r?\n/).filter(l=>!l.trimStart().startsWith('--'))) {
    buffer+=line+'\n';if(/^CREATE TRIGGER/i.test(line.trim()))trigger=true;
    if(line.trim().endsWith(';')&&(!trigger||line.trim()==='END;')) {out.push(buffer.trim().replace(/;$/,''));buffer='';trigger=false;}
  }
  assert.equal(buffer.trim(),'');return out;
}
const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:'export default {fetch(){return new Response("test")}}',compatibilityDate:'2026-01-01',d1Databases:['DB']}));
try {
  const db=await mf.getD1Database('DB');await db.batch(ddl.map(sql=>db.prepare(sql)));
  const seed = async (n,sql)=>{if(n)await db.prepare(`WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<?) ${sql}`).bind(n).run();};
  await seed(9,"INSERT INTO profiles(id,username) SELECT 'u'||n,'User '||n FROM seq");
  await seed(aggregate.templates.rows,"INSERT INTO templates(id,title,creator_id) SELECT 't'||n,'Template '||n,'u1' FROM seq");
  await db.prepare("INSERT INTO rankings(id,user_id,template_id) VALUES ('r1','u1','t1')").run();
  await seed(aggregate.placements.rows,"INSERT INTO ranking_items(id,ranking_id,item_id,tier) SELECT 'i'||n,'r1','item'||n,'S' FROM seq");
  await seed(aggregate.analytics.rows,`INSERT INTO analytics_events(id,event_name,session_id,user_id)
    SELECT 'e'||n,'feed_view','session'||n,CASE WHEN n<=${aggregate.analytics.authenticated} THEN 'u1' ELSE NULL END FROM seq`);
  await seed(aggregate.notifications.rows,`INSERT INTO notifications(id,user_id,type,is_read)
    SELECT 'n'||n,'u'||(n%9+1),'community_average',CASE WHEN n<=${aggregate.notifications.unread} THEN 0 ELSE 1 END FROM seq`);
  const events=(await db.prepare('SELECT * FROM analytics_events ORDER BY id').all()).results;
  let totalReads=0,totalWrites=0;
  for(const name of ['0012_d1_index_efficiency.sql','0013_placement_tier_index.sql','0014_analytics_primary_storage.sql','0015_exact_unread_counts.sql']) {
    const stmts=split(await read('migrations-active/'+name));
    const result=await db.batch(stmts.map(sql=>db.prepare(sql)));
    const reads=result.reduce((n,r)=>n+r.meta.rows_read,0),writes=result.reduce((n,r)=>n+r.meta.rows_written,0);
    totalReads+=reads;totalWrites+=writes;console.log(JSON.stringify({name,reads,writes}));
  }
  assert.deepEqual((await db.prepare('SELECT * FROM analytics_events ORDER BY id').all()).results,events);
  assert.ok(await db.prepare("SELECT name FROM sqlite_schema WHERE name='idx_ris_ranking'").first());
  assert.equal((await db.prepare('SELECT SUM(unread_count) n FROM notification_unread_counts').first()).n,aggregate.notifications.unread);
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM ranking_items').first()).n,aggregate.placements.rows);
  assert.deepEqual((await db.prepare('PRAGMA foreign_key_check').all()).results,[]);
  const verification=await db.batch(split(await read('scripts/sql/verify-quota-0012-0015.sql')).map(sql=>db.prepare(sql)));
  for(const [index,value] of [1,4,1,0,0].entries()) assert.equal(Object.values(verification[index].results[0])[0],value);
  await db.batch(split(await read('scripts/sql/rollback-unread-counters.sql')).map(sql=>db.prepare(sql)));
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM notifications').first()).n,aggregate.notifications.rows);
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM analytics_events').first()).n,aggregate.analytics.rows);
  assert.equal(await db.prepare("SELECT name FROM sqlite_schema WHERE name='notification_unread_counts'").first(),null);
  console.log(JSON.stringify({totalReads,totalWrites,note:'Production DDL and row counts; synthetic values. Excludes migration ledger writes and live traffic.'}));
} finally {await mf.dispose();}
