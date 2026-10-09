import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { SQL_SCRIPT_SEPARATOR } from './helpers/sql.mjs';
import { onRequest as comments } from '../../functions/api/comments.js';
import { onRequest as templateComments } from '../../functions/api/template-comments.js';

const mf = new Miniflare(convertV4MiniflareOptions({ modules: true,
  script: 'export default {fetch(){return new Response("test")}}',
  compatibilityDate: '2026-01-01', d1Databases: ['DB'] }));
const entries = new Map();
const cache = { match: async key => entries.get(key.url)?.clone(),
  put: async (key,response) => { entries.set(key.url,response.clone()); } };
try {
  const db = await mf.getD1Database('DB');
  const schema = await readFile(new URL('../../schema.sql',import.meta.url),'utf8');
  await db.batch(schema.split(SQL_SCRIPT_SEPARATOR).map(sql => db.prepare(sql)));
  await db.prepare("INSERT INTO profiles(id,username) VALUES ('author','Author'),('reader','Reader'),('other','Other')").run();
  await db.prepare("INSERT INTO templates(id,creator_id) VALUES ('topic','author')").run();
  await db.prepare("INSERT INTO rankings(id,user_id,comments_count) VALUES ('post','author',250)").run();
  await db.prepare(`WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<250)
    INSERT INTO comments(id,ranking_id,user_id,content) SELECT 'c'||n,'post','reader','Comment '||n FROM seq`).run();
  await db.prepare("INSERT INTO template_comments(id,template_id,user_id,content) SELECT id,'topic',user_id,content FROM comments").run();
  await db.prepare("INSERT INTO votes(id,ranking_id,user_id,vote_type) VALUES ('vp','post','reader','like')").run();
  await db.prepare("INSERT INTO template_reactions(id,template_id,user_id,vote_type) VALUES ('v1','topic','reader','like'),('v2','topic','other','dislike')").run();
  let reads=0,queries=0;
  const traced = { prepare(sql) {
    const wrap = stmt => ({ bind: (...args) => wrap(stmt.bind(...args)),
      all: async () => { const r=await stmt.all(); reads+=r.meta.rows_read; queries++; return r; },
      first: async () => { const r=await stmt.all(); reads+=r.meta.rows_read; queries++; return r.results[0]??null; } });
    return wrap(db.prepare(sql));
  } };
  async function call(handler,path,user='reader',headers={}) {
    reads=0;queries=0;
    const response=await handler({request:new Request('https://test/api/'+path,{headers}),
      env:{tear_of_god_db:traced},data:{user:user?{id:user}:null}});
    assert.equal(response.status,200);
    assert.equal(response.headers.get('Cache-Control'),'private, no-store');
    return {body:await response.json(),reads,queries};
  }
  globalThis.caches={default:cache};
  const measurements=[];
  for (const [handler,path] of [[comments,'comments?ranking_id=post'],[templateComments,'template-comments?template_id=topic&include_reactions=1']]) {
    const cold=await call(handler,path+'&shared_snapshot=1');
    const warm=await call(handler,path+'&shared_snapshot=1&user_id=reader','other');
    assert.deepEqual(warm.body.data,cold.body.data);
    assert.equal(warm.body.data.length,200,'Existing display limit stays bounded');
    assert(warm.reads<=4 && warm.reads<cold.reads/10,JSON.stringify(warm));
    assert.equal(handler===comments?warm.body.stats.user_vote:warm.body.reactionResult.userVote,handler===comments?null:'dislike');
    const guest=await call(handler,path+'&shared_snapshot=1',null);
    assert.equal(handler===comments?guest.body.stats.user_vote:guest.body.reactionResult.userVote,null);
    assert.equal((await call(handler,path)).body.data.length,200);
    assert((await call(handler,path+'&shared_snapshot=1','reader',{'Cache-Control':'no-cache'})).reads>200,'Explicit bypass remains fresh');
    measurements.push({endpoint:path,cold:cold.reads,warm:warm.reads});
  }
  for (const [url,response] of entries) {
    const payload=await response.clone().json();
    assert(!Object.hasOwn(payload,'stats')&&!Object.hasOwn(payload.reactions||{},'userVote'));
    assert(!url.includes('reader')&&!url.includes('other'),'No session identity in cache keys');
  }
  // Simulate writes from another account while shared responses remain warm.
  await db.prepare("DELETE FROM template_comments WHERE id='c1'").run();
  await db.prepare("UPDATE profiles SET username='Renamed' WHERE id='reader'").run();
  await db.prepare("UPDATE template_reactions SET vote_type='like' WHERE user_id='other'").run();
  const fresh=await call(templateComments,'template-comments?template_id=topic&include_reactions=1','other');
  assert.equal(fresh.body.comments_count,249);
  assert(fresh.body.data.every(c=>c.username==='Renamed'));
  assert.equal(fresh.body.reactionResult.likes,2);
  const ownVote=await call(templateComments,'template-comments?template_id=topic&include_reactions=1&shared_snapshot=1','other');
  assert.equal(ownVote.body.reactionResult.userVote,'like','Private vote is always fresh');
  for (const response of entries.values()) response.headers.set('X-Public-Expires','0');
  const expired=await call(templateComments,'template-comments?template_id=topic&include_reactions=1&shared_snapshot=1','other');
  assert.deepEqual(expired.body,fresh.body,'Expiry reloads comments, names, exact total and reactions');
  cache.match=async()=>{throw new Error('outage');};
  cache.put=async()=>{throw new Error('outage');};
  assert.deepEqual((await call(templateComments,'template-comments?template_id=topic&include_reactions=1&shared_snapshot=1','other')).body,fresh.body);
  console.log(JSON.stringify(measurements));
  console.log('Discussion shared-cache quota, private votes, limits, deletion/profile changes, fresh bypass, expiry and cache outage passed.');
} finally { delete globalThis.caches; await mf.dispose(); }
