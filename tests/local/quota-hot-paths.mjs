import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { onRequest as rankings } from '../../functions/api/rankings.js';
import { onRequestGet as templates } from '../../functions/api/templates.js';
import { onRequest as notifications } from '../../functions/api/notifications.js';
import { onRequestPost as analytics } from '../../functions/api/analytics.js';
import { build } from 'esbuild';

const cpuMode = process.argv.includes('--cpu');
const bundled = cpuMode ? await build({ stdin: { contents: `
  import { onRequest } from './functions/api/rankings.js';
  export default { fetch(request, env, ctx) {
    return onRequest({ request, env: { tear_of_god_db: env.DB, CACHE_METRIC_SAMPLE_RATE: '0' },
      data: { user: { id: 'viewer' } }, waitUntil: p => ctx.waitUntil(p) });
  } };`, resolveDir: process.cwd() }, bundle:true, write:false,format:'esm',platform:'browser' }) : null;

const mf = new Miniflare(convertV4MiniflareOptions({ modules: true,
  script: bundled?.outputFiles[0].text || 'export default { fetch() { return new Response("test"); } }',
  ...(cpuMode ? { inspectorPort: 0 } : {}),
  compatibilityDate: '2026-01-01', d1Databases: ['DB'],
}));
try {
  const db = await mf.getD1Database('DB');
  const schema = await readFile(new URL('../../schema.sql', import.meta.url), 'utf8');
  await db.batch(schema.split(/\r?\n/).filter(l => !l.trimStart().startsWith('--')).join('\n').split(';').map(s => s.trim()).filter(Boolean).map(s => db.prepare(s)));
  await db.prepare("INSERT INTO profiles(id,username) VALUES ('viewer','Viewer'),('author','Author')").run();
  await db.prepare(`WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<10)
    INSERT INTO templates(id,title,creator_id,tiers) SELECT 't'||n,'Template '||n,'author','[{"label":"S","color":"#ff0000"},{"label":"A","color":"#00ff00"}]' FROM seq`).run();
  await db.prepare(`WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<2000)
    INSERT INTO rankings(id,title,user_id,template_id,hashtags,created_at)
    SELECT printf('r%04d',n),'Rank '||n,'author','t'||(n%10+1),'#tag'||(n%15)||',#shared',datetime('now','-'||n||' minutes') FROM seq`).run();
  await db.prepare(`WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<20)
    INSERT INTO ranking_items(id,ranking_id,item_id,tier,position)
    SELECT r.id||':'||n,r.id,'item'||n,CASE WHEN n%2=0 THEN 'S' ELSE 'A' END,n FROM rankings r,seq`).run();
  await db.prepare("INSERT INTO votes(id,ranking_id,user_id,vote_type) SELECT 'v'||id,id,'viewer','like' FROM rankings WHERE id IN ('r0001','r0002','r0003')").run();
  await db.prepare("INSERT INTO follows VALUES ('viewer','author',CURRENT_TIMESTAMP)").run();
  await db.prepare("INSERT INTO topic_follows(user_id,topic_type,topic_key) VALUES ('viewer','hashtag','tag7')").run();
  await db.prepare(`WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<1000)
    INSERT INTO notifications(id,user_id,type,is_read) SELECT 'n'||n,'viewer','community_average',n%2 FROM seq`).run();

  if (cpuMode) {
    const inspector = await mf.getInspectorURL();
    const http = new URL('/json',inspector); http.protocol='http:';
    const targets = await fetch(http).then(r=>r.json());
    const target = targets.find(t=>t.webSocketDebuggerUrl);
    assert.ok(target,'Worker inspector target');
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
    let id=0; const pending=new Map();
    socket.onmessage=e=>{const m=JSON.parse(e.data); if(pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);if(m.error) p.reject(m.error); else p.resolve(m.result);}};
    const send=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});socket.send(JSON.stringify({id:key,method,params}));});
    try {
      await send('Profiler.enable');
      await send('Profiler.setSamplingInterval',{interval:100});
      const runs=40;
      const path='https://test/api/rankings?feed_type=for_you&seed=9&limit=12';
      for(const [label,url] of [['fresh',path+'&pin=force-fresh'],['cached',path]]) {
        await (await mf.dispatchFetch(url)).arrayBuffer();
        await send('Profiler.start');
        for(let i=0;i<runs;i++) await (await mf.dispatchFetch(url)).arrayBuffer();
        const {profile}=await send('Profiler.stop');
        const nodes=new Map(profile.nodes.map(n=>[n.id,n.callFrame.functionName]));
        let active=0;
        profile.samples.forEach((sample,index)=>{
          if(!['(idle)','(program)','(root)'].includes(nodes.get(sample))) active+=profile.timeDeltas[index];
        });
        console.log(`Local workerd sampled active CPU ${label}: ${(active/1000/runs).toFixed(3)} ms/request (${runs} requests); not production billing`);
      }
    } finally { socket.close(); }
  }

  async function measure(handler, path, body, userId = 'viewer') {
    const queries = [];
    const traced = { prepare(sql) {
      const wrap = stmt => ({ bind: (...args) => wrap(stmt.bind(...args)),
        all: async () => { const r = await stmt.all(); queries.push({ sql: sql.trim().replace(/\s+/g,' ').slice(0,110), read: r.meta.rows_read, written: r.meta.rows_written }); return r; },
        first: async () => { const r = await stmt.all(); queries.push({ sql: sql.trim().replace(/\s+/g,' ').slice(0,110), read:r.meta.rows_read,written:r.meta.rows_written }); return r.results[0] ?? null; },
        run: async () => { const r = await stmt.run(); queries.push({ sql:sql.trim().replace(/\s+/g,' ').slice(0,110),read:r.meta.rows_read,written:r.meta.rows_written }); return r; },
      }); return wrap(db.prepare(sql));
    } };
    const tasks = [];
    const response = await handler({ request:new Request('https://test'+path,body ? {method:'POST',body:JSON.stringify(body),headers:{'Content-Type':'application/json'}} : {}), env:{tear_of_god_db:traced,CACHE_METRIC_SAMPLE_RATE:'0'},data:{user:{id:userId}},waitUntil:p=>tasks.push(p) });
    assert.equal(response.status < 400,true,await response.clone().text());
    await Promise.all(tasks);
    const summary = {path,read:queries.reduce((a,q)=>a+q.read,0),written:queries.reduce((a,q)=>a+q.written,0),queries:queries.length,top:queries.sort((a,b)=>b.read-a.read).slice(0,2)};
    console.log(JSON.stringify(summary));
    return {body:await response.json(),summary};
  }
  for (const type of ['for_you','following','trending']) await measure(rankings,`/api/rankings?feed_type=${type}&seed=9&limit=12`);
  await measure(templates,'/api/templates?limit=12');
  await measure(notifications,'/api/notifications?limit=20');
  await measure(analytics,'/api/analytics',{event_id:'event-test',session_id:'session-test',event_name:'feed_view',entity_type:'feed',entity_id:'home'});

  const cacheEntries = new Map();
  globalThis.caches = { default: {
    match: async key => cacheEntries.get(key.url)?.clone(),
    put: async (key, response) => { cacheEntries.set(key.url,response.clone()); },
  } };
  const path = '/api/rankings?feed_type=for_you&seed=9&limit=12';
  const cold = await measure(rankings,path);
  const warm = await measure(rankings,path);
  assert.deepEqual(warm.body,cold.body);
  assert.ok(warm.summary.read < cold.summary.read / 4);
  console.log(`Warm For You: ${cold.summary.read} -> ${warm.summary.read} rows`);
  // Overlapping pages share template entries, not viewer data or whole responses.
  await measure(rankings,path+'&page=2');
  const otherCached = await measure(rankings,path,undefined,'author');
  const otherFresh = await measure(rankings,path+'&pin=force-fresh',undefined,'author');
  assert.deepEqual(otherCached.body,otherFresh.body,'Public aggregate reuse cannot leak viewer votes/follows');
  const fresh = await measure(rankings,path+'&pin=r0001');
  assert.deepEqual(fresh.body,cold.body);
  assert.equal(fresh.summary.read,cold.summary.read);
  for (const [key,response] of cacheEntries) {
    const data = await response.clone().json(); data.expiresAt=0;
    cacheEntries.set(key,Response.json(data));
  }
  assert.deepEqual((await measure(rankings,path)).body,cold.body);
  globalThis.caches.default.match = async () => { throw new Error('cache down'); };
  globalThis.caches.default.put = async () => { throw new Error('cache down'); };
  assert.deepEqual((await measure(rankings,path)).body,cold.body);
  delete globalThis.caches;

  // Optional baseline captured before this pass. Relative imports resolve against
  // the real handler path; the snapshot is never placed in the Functions router.
  if (process.argv.includes('--compare')) {
    const source = await readFile(new URL('../../.wrangler/quota-rankings-baseline.js',import.meta.url),'utf8');
    const rewritten = source.replace(/from '([^']+)'/g,(_,specifier)=>`from '${new URL(specifier,new URL('../../functions/api/rankings.js',import.meta.url)).href}'`);
    const baseline = (await import('data:text/javascript;base64,'+Buffer.from(rewritten).toString('base64'))).onRequest;
    for (const suffix of ['', '&page=2', '&hashtag=tag7', '&author_id=author', '&template_id=t2']) {
      const path = '/api/rankings?feed_type=for_you&seed=9&limit=12'+suffix;
      const before = await measure(baseline,path);
      const after = await measure(rankings,path);
      assert.deepEqual(after.body,before.body);
      console.log(`For You ${suffix || 'page 1'}: ${before.summary.read} -> ${after.summary.read}`);
    }
  }
} finally { delete globalThis.caches; await mf.dispose(); }
