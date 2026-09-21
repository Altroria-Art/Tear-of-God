import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { feedCommunityStats } from '../../functions/lib/community-cache.js';

const mf = new Miniflare(convertV4MiniflareOptions({modules:true,script:'export default {fetch(){return new Response("test")}}',compatibilityDate:'2026-01-01',d1Databases:['DB']}));
try {
  const db = await mf.getD1Database('DB');
  const schema = await readFile(new URL('../../schema.sql',import.meta.url),'utf8');
  await db.batch(schema.split(/\r?\n/).filter(l=>!l.trimStart().startsWith('--')).join('\n').split(';').map(s=>s.trim()).filter(Boolean).map(s=>db.prepare(s)));
  await db.prepare("INSERT INTO profiles(id,username) VALUES ('author','Author')").run();
  await db.prepare("INSERT INTO templates(id,title,creator_id) VALUES ('t1','One','author'),('t2','Two','author')").run();
  await db.prepare(`WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<200)
    INSERT INTO rankings(id,user_id,template_id) SELECT 'r'||n,'author',CASE WHEN n%2=0 THEN 't1' ELSE 't2' END FROM seq`).run();
  await db.prepare(`WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<20)
    INSERT INTO ranking_items(id,ranking_id,item_id,tier) SELECT r.id||':'||n,r.id,'item'||n,CASE n%3 WHEN 0 THEN NULL WHEN 1 THEN 'S' ELSE 'Custom ไทย' END FROM rankings r,seq`).run();
  let reads=0, queries=0, writes=0, fail=false, gate=Promise.resolve();
  const traced={prepare(sql){return {bind(...args){return {async all(){
    queries++;
    await gate;
    if(fail) throw new Error('injected D1 failure');
    const r=await db.prepare(sql).bind(...args).all(); reads+=r.meta.rows_read; writes+=r.meta.rows_written; return r;
  }}}}}};
  const context=origin=>({request:new Request(origin+'/api/rankings')});
  const call=(ids=['t1','t2'],fresh=false,origin='https://test')=>feedCommunityStats(context(origin),traced,ids,{fresh});
  const expected=await call();
  const oneRead=reads;
  reads=queries=writes=0;
  let release;
  gate=new Promise(resolve=>{release=resolve;});
  const burst=Promise.all(Array.from({length:10},()=>call()));
  // Each call yields for cache lookups, then registers its pending work.
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(queries,2);
  release();
  for(const result of await burst) assert.deepEqual(result,expected);
  assert.equal(reads,oneRead);
  assert.equal(writes,0);
  console.log(`10 concurrent cold requests: aggregate queries 20 -> ${queries}; rows read ${oneRead*10} -> ${reads}; writes 0 -> ${writes}`);

  // Partial overlap queries only the as-yet-unclaimed template.
  queries=reads=0;
  const overlap=await Promise.all([call(['t1']),call(['t1','t2'])]);
  assert.deepEqual(overlap[1],expected);
  assert.equal(queries,4);
  // Pinned requests never consume an older in-flight result; origins stay isolated.
  queries=0;
  await Promise.all([call(),call(undefined,true),call(undefined,false,'https://other')]);
  assert.equal(queries,6);
  // No persistent memoization: a later request observes new contributions.
  await db.prepare("INSERT INTO rankings(id,user_id,template_id) VALUES ('new','author','t1')").run();
  assert.equal((await call()).templateUseRows[0].uses,101);
  fail=true;
  const failed=await Promise.allSettled([call(),call()]);
  assert.ok(failed.every(r=>r.status==='rejected'));
  fail=false;
  assert.equal((await call()).templateUseRows[0].uses,101);
  console.log('Exact counts/histograms, overlapping batches, fresh bypass, origin isolation, later writes and failure recovery passed.');
} finally {await mf.dispose();}
