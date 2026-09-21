import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { onRequestPost } from '../../functions/api/analytics.js';
import { createPollActivity, watchPollActivity, POLL_IDLE_MS } from '../../src/lib/pollActivity.js';

let now = 0;
const activity = createPollActivity(() => now);
assert.equal(activity.active(),true);
now = POLL_IDLE_MS;
assert.equal(activity.active(),false);
let resumes=0;
const target=new EventTarget();
const stop=watchPollActivity(target,activity,()=>resumes++);
target.dispatchEvent(new Event('keydown'));
assert.equal(resumes,1);
target.dispatchEvent(new Event('scroll'));
assert.equal(resumes,1);
stop(); now+=POLL_IDLE_MS;
target.dispatchEvent(new Event('pointerdown'));
assert.equal(activity.active(),false);
for (const cadence of [60000,300000]) {
  now=0; const gate=createPollActivity(()=>now); let polls=0;
  for(now=cadence;now<=3600000;now+=cadence) if(gate.active()) polls++;
  console.log(`Idle foreground hour (${cadence/60000} min cadence): ${3600000/cadence} -> ${polls} periodic requests, excluding initial load`);
}

const requests=[]; let ok=true;
const storage=new Map();
globalThis.sessionStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)};
const originalFetch=globalThis.fetch;
globalThis.fetch=async (url,options)=>{requests.push(JSON.parse(options.body));return {ok};};
const {trackEvent}=await import('../../src/lib/analytics.js');
const drain=()=>new Promise(resolve=>setImmediate(resolve));
try {
  trackEvent('ranking_start',{entityType:'template',entityId:'t',onceKey:'start'});
  trackEvent('challenge_start',{entityType:'challenge',entityId:'r',onceKey:'challenge'});
  await drain();
  assert.equal(requests.length,1);
  assert.equal(requests[0].events.length,2);
  trackEvent('ranking_start',{entityType:'template',entityId:'t',onceKey:'start'});
  await drain(); assert.equal(requests.length,1);
  ok=false;
  trackEvent('feed_view',{onceKey:'retry'}); await drain();
  ok=true;
  trackEvent('feed_view',{onceKey:'retry'}); await drain();
  assert.equal(requests.length,3,'Failed batch/single event can be retried');
  for(let i=0;i<21;i++) trackEvent('share_complete');
  await drain();
  assert.equal(requests[3].events.length,20);
  assert.equal(requests[4].event_name,'share_complete');
  console.log('Paired analytics: 2 -> 1 HTTP requests, both events retained; dedup/retry/cap passed');
} finally {globalThis.fetch=originalFetch;delete globalThis.sessionStorage;}

const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:'export default {fetch(){return new Response("test")}}',compatibilityDate:'2026-01-01',d1Databases:['DB']}));
try {
  const db=await mf.getD1Database('DB');
  const schema=await readFile(new URL('../../schema.sql',import.meta.url),'utf8');
  await db.batch(schema.split(/\r?\n/).filter(l=>!l.trimStart().startsWith('--')).join('\n').split(';').map(s=>s.trim()).filter(Boolean).map(s=>db.prepare(s)));
  await db.prepare("INSERT INTO profiles(id) VALUES ('viewer')").run();
  const event=(id)=>({event_id:id,session_id:'session',event_name:'feed_view',user_id:'forged'});
  const call=async body=>{
    const pending=[];
    const response=await onRequestPost({request:new Request('https://test/api/analytics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),env:{tear_of_god_db:db},data:{user:{id:'viewer'}},waitUntil:p=>pending.push(p)});
    await Promise.all(pending);return response;
  };
  assert.equal((await call({events:[event('a'),event('b')]})).status,202);
  assert.equal((await call(event('a'))).status,202);
  assert.deepEqual((await db.prepare('SELECT id,user_id FROM analytics_events ORDER BY id').all()).results,[{id:'a',user_id:'viewer'},{id:'b',user_id:'viewer'}]);
  assert.equal((await call({events:[event('c'),{...event('d'),event_name:'invalid'}]})).status,400);
  assert.equal((await call({events:Array.from({length:21},(_,i)=>event('large'+i))})).status,400);
  assert.equal((await call({events:[event('c'),{...event('d'),session_id:'other'}]})).status,400);
  assert.equal((await db.prepare('SELECT count(*) n FROM analytics_events').first()).n,2);
  for(let i=0;i<11;i++) assert.equal((await call({events:Array.from({length:20},(_,j)=>event(`rate-${i}-${j}`))})).status,202);
  assert.equal((await call({events:Array.from({length:20},(_,j)=>event(`over-${j}`))})).status,429);
  console.log('Server: atomic validation, legacy format, idempotency, trusted user attribution and per-event limits passed');
} finally {await mf.dispose();}
