import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { onRequest } from '../../functions/api/rankings.js';
import { onRequest as vote } from '../../functions/api/votes.js';

const mf = new Miniflare(convertV4MiniflareOptions({ modules:true, script:'export default {fetch(){return new Response("test")}}', compatibilityDate:'2026-01-01', d1Databases:['DB'] }));
try {
  const db = await mf.getD1Database('DB');
  const schema = await readFile(new URL('../../schema.sql',import.meta.url),'utf8');
  await db.batch(schema.split(/\r?\n/).filter(line=>!line.trimStart().startsWith('--')).join('\n').split(';').map(sql=>sql.trim()).filter(Boolean).map(sql=>db.prepare(sql)));
  await db.prepare("INSERT INTO profiles(id,username) VALUES ('viewer','Viewer'),('other','Other'),('author','Author')").run();
  await db.prepare(`INSERT INTO templates(id,title,creator_id,tiers) VALUES ('tpl','Template','author','[{"label":"ดี","color":"bg-[#123456]"}]')`).run();
  await db.prepare("INSERT INTO follows(follower_id,following_id) VALUES ('viewer','author')").run();
  await db.prepare(`WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<123)
    INSERT INTO rankings(id,title,user_id,template_id,created_at) SELECT printf('r%03d',n),'Card','author','tpl',datetime('now','-'||n||' minutes') FROM seq`).run();
  await db.prepare(`WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<20)
    INSERT INTO ranking_items(id,ranking_id,item_id,tier,position) SELECT r.id||':'||n,r.id,'Item '||n,'ดี',n FROM rankings r,seq`).run();
  const entries = new Map();
  globalThis.caches = {default:{match:async key=>entries.get(key.url)?.clone(),put:async(key,response)=>entries.set(key.url,response.clone())}};
  let queries = [];
  const traced = {prepare(sql) {
    const wrap = statement=>({ bind:(...args)=>wrap(statement.bind(...args)),
      all:async()=>{const result=await statement.all();queries.push({sql,rows:result.meta.rows_read});return result},
      first:async()=>{const result=await statement.all();queries.push({sql,rows:result.meta.rows_read});return result.results[0]||null},
    });return wrap(db.prepare(sql));
  }};
  async function feed(mode,user='viewer',cursor=null,extra={}) {
    const params=new URLSearchParams({feed_type:mode,limit:'12',...extra});if(cursor)params.set('cursor',cursor);
    const response=await onRequest({request:new Request('https://cursor.test/api/rankings?'+params),env:{tear_of_god_db:traced,CACHE_METRIC_SAMPLE_RATE:'0'},data:{user:user?{id:user}:null}});
    return {status:response.status,...await response.json()};
  }
  for(const mode of ['trending','for_you','following']) {
    entries.clear();queries=[];
    let result=await feed(mode);
    assert.equal(result.status,200);assert.equal(result.data.length,12);assert(result.nextCursor);
    assert(result.data.every(card=>card.preview && card.ranking_items.length===12 && card.tiers[0].label==='ดี'));
    const ids=result.data.map(card=>card.id);
    const firstCursor=result.nextCursor;
    queries=[];
    result=await feed(mode,'viewer',firstCursor);
    assert.equal(result.data.length,12);
    if(mode!=='following')assert(!queries.some(q=>/FROM rankings\s+(WHERE.*)?\s*ORDER BY (COALESCE|created_at)/s.test(q.sql)||q.sql.includes('FROM topic_follows')),'next page reuses candidate snapshot and interests');
    ids.push(...result.data.map(card=>card.id));
    let pages=2;
    while(result.hasMore){assert(pages++<20);result=await feed(mode,'viewer',result.nextCursor);assert.equal(result.status,200);ids.push(...result.data.map(card=>card.id));}
    assert.equal(ids.length,123,mode+' must continue beyond the first 48 candidates');
    assert.equal(new Set(ids).size,123,mode+' must not repeat cards');
    assert(!queries.some(q=>/\bOFFSET\b|GROUP BY.*ri\.item_id|COUNT\(\*\).*placements/s.test(q.sql)));
    assert.equal((await feed(mode,'other',firstCursor)).status,400,'cursor is scoped to identity');
  }
  entries.clear();queries=[];
  const guest=await feed('trending',null,null,{seed:'1'});
  assert.equal(guest.data[0].stats.templateUses,123,'unmigrated mirror counters must not show synthetic usage');
  assert.equal(queries.filter(q=>q.sql.includes('COUNT(*) AS uses')).length,1,'cards sharing a template coalesce its cached indexed count');
  const cold=queries.reduce((sum,q)=>sum+q.rows,0);assert(cold<1000,'cold preview read budget');
  queries=[];
  const warm=await feed('trending',null,null,{seed:'999999',fresh:'1'});
  assert.deepEqual(warm.data,guest.data);assert.equal(queries.length,0,'different guest seeds share the whole response');
  queries=[];entries.clear();
  const burst=await Promise.all(Array.from({length:10},()=>feed('trending',null)));
  assert(burst.every(result=>result.status===200));
  assert.equal(queries.filter(q=>q.sql.includes('FROM rankings')&&q.sql.includes('LIMIT ?')).length,1,'cold concurrent requests coalesce candidate work');
  assert.equal(queries.filter(q=>q.sql.includes('AS preview_items')).length,12,'cold concurrent requests coalesce preview cards');
  const id=guest.data[0].id;
  const voted=await vote({request:new Request('https://cursor.test/api/votes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({rankingId:id,voteType:'like'})}),env:{tear_of_god_db:db},data:{user:{id:'viewer'}}});
  assert.equal(voted.status,200);
  assert.equal((await feed('trending')).data.find(card=>card.id===id).user_vote,'like');
  assert.equal((await feed('trending','other')).data.find(card=>card.id===id).user_vote,null);
  assert.equal((await feed('trending',null)).data.find(card=>card.id===id).user_vote,null);
  const detail=await onRequest({request:new Request('https://cursor.test/api/rankings?id='+id),env:{tear_of_god_db:db},data:{user:null}});
  assert.equal((await detail.json()).data.ranking_items.length,20,'Post Detail retains full placements');
  assert.equal((await feed('trending','viewer','invalid')).status,400);
  assert.equal((await feed('trending','viewer',null,{page:'999'})).status,400,'deep OFFSET pagination is rejected');
  assert.equal((await feed('following',null)).feedLocked,true);
  // A cursor carries its remaining IDs through cache expiry, deletion and a
  // concurrent insert; neither change should regenerate the candidate window.
  for (const mode of ['trending','for_you']) {
    entries.clear();
    const first = await feed(mode);
    const state = JSON.parse(decodeURIComponent(escape(atob(first.nextCursor.replaceAll('-','+').replaceAll('_','/')))));
    const removed = state.ids[0];
    await db.prepare('DELETE FROM rankings WHERE id = ?').bind(removed).run();
    await db.prepare("INSERT INTO rankings(id,title,user_id,template_id) VALUES (?, 'Concurrent insert', 'author', 'tpl')").bind('new-'+mode).run();
    entries.clear();queries=[];
    const next = await feed(mode,'viewer',first.nextCursor);
    assert.deepEqual(next.data.map(row=>row.id),state.ids.slice(1,12));
    assert(next.hasMore && next.nextCursor);
    assert(!queries.some(q=>q.sql.includes('FROM topic_follows') || q.sql.includes('LIMIT ?')),'expired cache must not rebuild a saved candidate pool');
  }
  await db.prepare(`WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<8000)
    INSERT INTO rankings(id,title,user_id,created_at,last_activity_at)
    SELECT printf('tie%05d',n),'Tied timestamp','author',datetime('now'),datetime('now') FROM seq`).run();
  const timestamp = (await db.prepare("SELECT created_at FROM rankings WHERE id='tie00001'").first()).created_at;
  const deepCursor = btoa(JSON.stringify({v:1,mode:'trending',viewer:'viewer',ids:[],after:[timestamp,'tie00100'],more:true,page:600})).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
  entries.clear();queries=[];
  const deep = await feed('trending','viewer',deepCursor);
  assert.equal(deep.data.length,12);
  assert(queries.reduce((sum,q)=>sum+q.rows,0)<500,'deep activity cursor must seek even within 8,000 tied timestamps');
  assert(deep.data.every(row=>row.id<'tie00100'));
  await db.prepare("INSERT INTO votes(id,ranking_id,user_id,vote_type) SELECT 'v:'||id,id,'viewer','dislike' FROM rankings WHERE id LIKE 'tie%'").run();
  queries=[];
  await feed('trending','viewer',deepCursor);
  assert(queries.reduce((sum,q)=>sum+q.rows,0)<100,'per-card votes seek unique ranking/user pairs rather than scanning 8,000 viewer votes');
  console.log('Home cursor/cache passed: 123 cards in each mode, preview/full detail, no duplicates or aggregates, shared guest cache, concurrent cold coalescing, private votes, invalid cursors.');
} finally {delete globalThis.caches;await mf.dispose();}
