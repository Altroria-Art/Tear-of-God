import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { SQL_SCRIPT_SEPARATOR } from './helpers/sql.mjs';
import { onRequestGet as templates } from '../../functions/api/templates.js';
import { onRequest as rankings } from '../../functions/api/rankings.js';
import { onRequestGet as spotlights } from '../../functions/api/spotlights.js';
import { onRequest as admin } from '../../functions/api/admin/index.js';
import { onRequest as adminTemplates } from '../../functions/api/admin/templates.js';
import { onRequestGet as templateMeta } from '../../functions/template/[id].js';
import { onRequestGet as communityMeta } from '../../functions/template/[id]/community.js';

const mf = new Miniflare(convertV4MiniflareOptions({ modules:true,
  script:'export default {fetch(){return new Response("test")}}',
  compatibilityDate:'2026-01-01',d1Databases:['DB'] }));
try {
  const db = await mf.getD1Database('DB');
  const schema = await readFile(new URL('../../schema.sql',import.meta.url),'utf8');
  const run = sql => db.batch(sql.split(SQL_SCRIPT_SEPARATOR).map(s=>db.prepare(s)));
  await run(schema.split('-- Exact template usage counters')[0]);
  await db.prepare("INSERT INTO profiles(id,username,role) VALUES ('author','Author','user'),('viewer','Viewer','admin')").run();
  await db.prepare(`WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<10)
    INSERT INTO templates(id,title,creator_id,tiers,hashtags,use_count)
    SELECT 't'||n,'Topic '||n,'viewer','[]','#campus',999 FROM seq`).run();
  await db.prepare(`WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<2000)
    INSERT INTO rankings(id,title,user_id,template_id,created_at)
    SELECT printf('r%04d',n),'Post '||n,'author','t'||(n%10+1),datetime('now','-'||n||' seconds') FROM seq`).run();
  let reads=0;
  const traced={prepare(sql){const wrap=s=>({bind:(...args)=>wrap(s.bind(...args)),
    all:async()=>{const r=await s.all();reads+=r.meta.rows_read;return r;},
    first:async()=>{const r=await s.all();reads+=r.meta.rows_read;return r.results[0]??null;}});return wrap(db.prepare(sql));}};
  async function call(handler,path,enabled=false){
    reads=0;
    const response=await handler({request:new Request('https://test'+path),
      env:{tear_of_god_db:traced,TEMPLATE_USAGE_COUNTERS:enabled?'true':'false',CACHE_METRIC_SAMPLE_RATE:'0'},data:{user:{id:'viewer'}}});
    assert.equal(response.status,200);
    return {body:await response.json(),reads};
  }
  const migration=await readFile(new URL('../../migrations-active/0029_exact_template_usage_counts.sql',import.meta.url),'utf8');
  const legacy=await call(templates,'/api/templates?limit=12');
  const insert=db.prepare('INSERT INTO rankings(id,user_id,template_id) VALUES (?,\'author\',\'t1\')');
  const beforeWrite=(await insert.bind('write-before').run()).meta.rows_written;
  await db.prepare("DELETE FROM rankings WHERE id='write-before'").run();
  const rehearsal=await run(migration);
  const after=await call(templates,'/api/templates?limit=12',true);
  assert.deepEqual(after.body,legacy.body,'Exact counters match live COUNT despite corrupt legacy mirrors');
  assert(after.reads<legacy.reads/5,JSON.stringify({before:legacy.reads,after:after.reads}));
  const homeBefore=await call(rankings,'/api/rankings?feed_type=for_you&seed=9&limit=12');
  const homeAfter=await call(rankings,'/api/rankings?feed_type=for_you&seed=9&limit=12',true);
  assert.deepEqual(homeAfter.body,homeBefore.body);
  assert(homeAfter.reads<homeBefore.reads/5);
  for(const path of ['/api/templates?sort=recent','/api/templates?suggest=1&q=Topic','/api/templates?q=missing','/api/templates?id=t1&fields=meta','/api/templates?id=t1']) {
    assert.deepEqual((await call(templates,path,true)).body,(await call(templates,path)).body,path);
  }
  for (const [handler,path] of [[spotlights,'/api/spotlights'],[admin,'/api/admin?action=stats'],[adminTemplates,'/api/admin/templates']]) {
    assert.deepEqual((await call(handler,path,true)).body,(await call(handler,path)).body,path);
  }
  for (const handler of [templateMeta,communityMeta]) {
    const context={request:new Request('https://test/template/t1'),params:{id:'t1'},
      next:async()=>new Response('<html><head><title>App</title></head></html>',{headers:{'Content-Type':'text/html'}})};
    const old=await handler({...context,env:{tear_of_god_db:db}});
    const exact=await handler({...context,env:{tear_of_god_db:db,TEMPLATE_USAGE_COUNTERS:'true'}});
    assert.equal(await exact.text(),await old.text(),'Share metadata keeps exact ranking totals');
  }
  const afterWrite=(await insert.bind('write-after').run()).meta.rows_written;
  async function consistent(){
    const result=await db.prepare(`SELECT t.id FROM templates t WHERE
      COALESCE((SELECT ranking_count FROM template_usage_counts WHERE template_id=t.id),0)
      !=(SELECT COUNT(*) FROM rankings r WHERE r.template_id=t.id)`).all();
    assert.deepEqual(result.results,[]);
  }
  await consistent();
  await db.prepare("UPDATE rankings SET template_id='t2' WHERE id='write-after'").run();await consistent();
  await db.prepare("UPDATE rankings SET template_id=NULL WHERE id='write-after'").run();await consistent();
  await db.prepare("UPDATE rankings SET template_id='t3' WHERE id='write-after'").run();await consistent();
  await Promise.all([db.prepare("DELETE FROM rankings WHERE id='write-after'").run(),db.prepare("DELETE FROM rankings WHERE id='write-after'").run()]);await consistent();
  await assert.rejects(db.batch([insert.bind('rollback'),insert.bind('rollback')]));
  assert.equal(await db.prepare("SELECT id FROM rankings WHERE id='rollback'").first(),null);await consistent();
  await db.prepare("DELETE FROM templates WHERE id='t4'").run();await consistent();
  assert.equal(await db.prepare("SELECT template_id FROM template_usage_counts WHERE template_id='t4'").first(),null);
  await db.prepare("DELETE FROM profiles WHERE id='author'").run();await consistent();
  assert.deepEqual((await db.prepare('PRAGMA foreign_key_check').all()).results,[]);
  await run(migration);await consistent();
  console.log(JSON.stringify({catalog:{before:legacy.reads,after:after.reads},home:{before:homeBefore.reads,after:homeAfter.reads},
    rankingInsertRowsWritten:{before:beforeWrite,after:afterWrite},backfill:{reads:rehearsal.reduce((n,r)=>n+r.meta.rows_read,0),writes:rehearsal.reduce((n,r)=>n+r.meta.rows_written,0)}}));
  console.log('Exact template counts: legacy compatibility, cold quota, all catalog modes, insert/move/delete/cascades, concurrency, rollback and migration replay passed.');
} finally {await mf.dispose();}
