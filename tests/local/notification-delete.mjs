import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { onRequest as notifications } from '../../functions/api/notifications.js';

// SQL splitter (trigger BEGIN/END aware), same as notification-read-expiry.mjs.
function statements(sql) {
  const out=[]; let pending='', trigger=false;
  for(const line of sql.split(/\r?\n/).filter(l=>!l.trimStart().startsWith('--'))) {
    pending+=line+'\n';
    if(/^CREATE TRIGGER/i.test(line.trim())) trigger=true;
    if(line.trim().endsWith(';') && (!trigger || line.trim()==='END;')) {
      out.push(pending.trim().replace(/;$/,''));pending='';trigger=false;
    }
  }
  assert.equal(pending.trim(),''); return out;
}
const read = path=>readFile(new URL('../../'+path,import.meta.url),'utf8');
const nowMs=Date.now();
const dbts=(ms)=>new Date(ms).toISOString().replace('T',' ').slice(0,19);

// Requirements under test:
//  A  user deletes own notification        -> success, row physically gone from D1
//  B  user A cannot delete user B's row    -> user_id scope; owner delete still works
//  C  delete unread                        -> notification_unread_counts decremented BY THE TRIGGER
//  D  delete read                          -> counter unchanged (trigger WHEN OLD.is_read = 0)
//  E  repeat delete of a missing id        -> idempotent success, no 404, counter untouched
//  F  unread -> read -> delete             -> decrements exactly once (no double-decrement)
//  G  GET/cron cleanup after user delete   -> consistent, no error (cron run succeeds)

const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:'export default {fetch(){return new Response("test")}}',compatibilityDate:'2026-01-01',d1Databases:['DB']}));
try {
  const db=await mf.getD1Database('DB');
  const run=async (database,sql)=>database.batch(statements(sql).map(s=>database.prepare(s)));
  await run(db,await read('schema.sql'));
  await run(db,await read('migrations-active/0015_exact_unread_counts.sql')); // exact counter + triggers
  await db.prepare("INSERT INTO profiles(id,username) VALUES ('viewer','Viewer'),('other','Other')").run();

  const env={tear_of_god_db:db,NOTIFICATION_UNREAD_COUNTS:'true'};
  const seed=(id,userId,isRead,readAt)=>db.prepare(
    "INSERT INTO notifications(id,user_id,type,is_read,read_at) VALUES (?,?,'community_average',?,?)"
  ).bind(id,userId,isRead,readAt).run();
  const counter=(u)=>db.prepare('SELECT unread_count AS n FROM notification_unread_counts WHERE user_id=?').bind(u).first().then(r=>r?.n??0);
  const row=(id)=>db.prepare('SELECT * FROM notifications WHERE id=?').bind(id).first();
  const post=(body,actor='viewer')=>notifications({request:new Request('https://test/api/notifications',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),env,data:{user:{id:actor}}});
  const get=(actor='viewer')=>notifications({request:new Request('https://test/api/notifications?limit=50'),env,data:{user:{id:actor}}}).then(r=>r.json());
  const del=(id,actor='viewer')=>post({action:'delete',id},actor);

  await seed('own-unread','viewer',0,null);
  await seed('own-read','viewer',1,dbts(nowMs));
  await seed('other-unread','other',0,null);
  await seed('other-read','other',1,dbts(nowMs));
  assert.equal(await counter('viewer'),1);
  assert.equal(await counter('other'),1);

  // --- A + C: delete own unread -> row gone, trigger decrements ---
  const delOwn=await del('own-unread');
  assert.equal(delOwn.status,200);
  assert.deepEqual(await delOwn.json(),{success:true});
  assert.equal(await row('own-unread'),null,'A: row must be physically deleted from D1');
  assert.equal(await counter('viewer'),0,'C: unread delete must decrement via trigger');
  console.log('A/C pass: own unread deleted from D1; unread_count decremented by trigger');

  // --- E: repeat delete of the same (now missing) id is idempotent ---
  const again=await del('own-unread');
  assert.equal(again.status,200);
  assert.deepEqual(await again.json(),{success:true},'E: repeat delete of a missing id is success');
  assert.equal(await counter('viewer'),0,'E: repeat delete must not touch the counter');
  console.log('E pass: repeat delete of a missing id is idempotent success');

  // --- D: delete own read -> row gone, counter unchanged ---
  assert.ok(await row('own-read'),'precondition: own-read exists');
  assert.deepEqual(await (await del('own-read')).json(),{success:true});
  assert.equal(await row('own-read'),null);
  assert.equal(await counter('viewer'),0,'D: read delete must not touch the counter');
  console.log('D pass: read delete leaves unread counter unchanged');

  // --- B: cross-user delete must not remove the row ---
  const cross=await del('other-unread','viewer');
  assert.equal(cross.status,200);
  assert.ok(await row('other-unread'),'B: user A must not delete user B row');
  assert.equal(await counter('other'),1,'B: other user counter untouched');
  assert.deepEqual(await (await del('other-unread','other')).json(),{success:true});
  assert.equal(await row('other-unread'),null,'B: owner delete works');
  assert.equal(await counter('other'),0);
  console.log('B pass: cross-user delete rejected by user_id scope; owner delete works');

  // --- F: unread -> read -> delete decrements exactly once ---
  await seed('f-unread','viewer',0,null);
  assert.equal(await counter('viewer'),1);
  await post({action:'read',id:'f-unread'});
  assert.equal(await counter('viewer'),0,'F: read decrements via the update trigger');
  await del('f-unread');
  assert.equal(await counter('viewer'),0,'F: deleting an already-read row must not decrement again');
  assert.equal(await row('f-unread'),null);
  console.log('F pass: read-then-delete decrements exactly once (trigger owns the counter)');

  // --- G: GET consistent after deletes; cron cleanup run succeeds (idempotent) ---
  await seed('g-expired-read','viewer',1,dbts(nowMs-72*3600000));
  await del('other-read');
  const list=(await get()).data;
  const ids=list.map(n=>n.id);
  assert.ok(!ids.includes('own-unread'),'G: user-deleted row must not reappear in GET');
  assert.ok(!ids.includes('g-expired-read'),'G: 72h-old read row still purged by lazy cleanup');
  assert.equal((await get()).unreadCount,0);
  const worker=(await import('../../workers/notification-cleanup/index.js')).default;
  let driven;
  const cronResult=worker.scheduled(null,{tear_of_god_db:db},{waitUntil:(p)=>{driven=p;}});
  if (driven) await driven; else await cronResult; // must not throw after user deletes
  console.log('G pass: GET consistent after delete; cron cleanup still runs without error');

  // Final reconciliation: counter table == exact unread rows per user.
  const expected=await db.prepare('SELECT user_id,COUNT(*) n FROM notifications WHERE is_read=0 GROUP BY user_id ORDER BY user_id').all();
  const actual=await db.prepare('SELECT user_id,unread_count n FROM notification_unread_counts WHERE unread_count>0 ORDER BY user_id').all();
  assert.deepEqual(actual.results,expected.results);
  console.log('Notification delete checks passed (ownership, trigger-owned counter, idempotency).');
} finally {await mf.dispose();}