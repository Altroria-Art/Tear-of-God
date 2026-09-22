import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

// Runs the REAL scheduled handler from workers/notification-cleanup/index.js
// against a real (Miniflare/workerd) local D1, the same execution path as the
// production cron. Requirements under test:
//   A  read_at 23h59m ago, is_read=1  -> survives
//   B  read_at 24h01m ago, is_read=1  -> deleted
//   C  read_at 10 days ago, is_read=0 -> survives (unread never expires)
//   D  expired rows across multiple users -> all deleted (global, not per-user)
//   E  freshly read notification      -> survives
//   F  unread counter unchanged by the cleanup
//   G  second run is idempotent (no more deletes, no error)
// Plus: an unread like_digest (read_at NULL) survives; a read like_digest
// past 24h is deleted like any other read notification.

// SQL splitter (trigger BEGIN/END aware), same as remaining-d1.mjs.
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
const daysAgo=(d)=>dbts(nowMs-d*86400000);
const hmAgo=(h,m)=>dbts(nowMs-(h*3600+m*60)*1000);

const logs=[];
const originalLog=console.log;
console.log=(...a)=>logs.push(a.map(String).join(' '));

const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:'export default {fetch(){return new Response("test")}}',compatibilityDate:'2026-01-01',d1Databases:['tear_of_god_db']}));
try {
  const db=await mf.getD1Database('tear_of_god_db');
  const run=async (database,sql)=>database.batch(statements(sql).map(s=>database.prepare(s)));
  await run(db,await read('schema.sql'));
  await run(db,await read('migrations-active/0015_exact_unread_counts.sql')); // exact counter + triggers
  await db.prepare("INSERT INTO profiles(id) VALUES ('u1'),('u2'),('u3')").run();
  const seed=(id,userId,isRead,readAt,createdAt)=>db.prepare(
    "INSERT INTO notifications(id,user_id,type,is_read,read_at,created_at) VALUES (?,?,?,?,?,?)"
  ).bind(id,userId,'community_average',isRead,readAt,createdAt).run();
  const count=(sql,...bind)=>db.prepare(sql).bind(...bind).first().then(r=>r.n);
  const exists=(id)=>db.prepare('SELECT id FROM notifications WHERE id=?').bind(id).first().then(r=>!!r);
  const counterTotal=()=>db.prepare('SELECT COALESCE(SUM(unread_count),0) AS n FROM notification_unread_counts').first().then(r=>r.n);

  // A/B/C/E + like_digest variants + multi-user (D)
  await seed('a-fresh','u1','1',hmAgo(23,59),dbts(nowMs));              // A  within 24h
  await seed('b-expired','u1','1',hmAgo(24,1),dbts(nowMs));             // B  past 24h
  await seed('c-unread-old','u1','0',null,daysAgo(10));                 // C  unread forever
  await seed('d-expired-u2','u2','1',hmAgo(48,0),dbts(nowMs));          // D  other user, expired
  await seed('e-fresh-read','u2','1',dbts(nowMs),dbts(nowMs));          // E  just read
  await seed('g-digest-unread-old','u3','0',null,daysAgo(10));          // unread digest, NULL read_at
  await seed('h-digest-read-expired','u3','1',hmAgo(30,0),dbts(nowMs)); // read digest past 24h
  const counterBefore=await counterTotal();
  assert.equal(counterBefore,2,'seed: c-unread-old + g-digest-unread-old are the only unread rows');

  // Trigger the real scheduled handler once.
  const worker=(await import('../../workers/notification-cleanup/index.js')).default;
  let driven;
  const handlerResult=worker.scheduled(null,{tear_of_god_db:db},{waitUntil:(p)=>{driven=p;}});
  if (driven) await driven; else await handlerResult;

  assert.equal(await exists('a-fresh'),true,'A: read 23h59m ago must survive');
  assert.equal(await exists('b-expired'),false,'B: read 24h01m ago must be deleted');
  assert.equal(await exists('c-unread-old'),true,'C: 10-day-old unread must survive');
  assert.equal(await exists('d-expired-u2'),false,'D: expired rows of other users must be deleted too');
  assert.equal(await exists('e-fresh-read'),true,'E: freshly read notification must survive');
  assert.equal(await exists('g-digest-unread-old'),true,'unread like_digest (read_at NULL) must survive');
  assert.equal(await exists('h-digest-read-expired'),false,'read like_digest past 24h must be deleted');
  assert.equal(await counterTotal(),counterBefore,'F: unread counter must be unchanged by the cron cleanup');
  assert.equal(await count('SELECT COUNT(*) n FROM notifications WHERE user_id=? AND is_read=0','u1'),1,'counter matches exact unread count for u1');
  assert.equal(await count('SELECT COUNT(*) n FROM notifications WHERE user_id=? AND is_read=0','u3'),1,'counter matches exact unread count for u3');

  const firstLog=logs.find(l=>l.includes('notification-cleanup'))||'';
  assert.ok(firstLog.includes('"deleted"'),'observability log includes deleted count');
  assert.ok(!firstLog.includes('u1') && !firstLog.includes('u2') && !firstLog.includes('u3'),'log must not include user IDs');

  // G: re-run — idempotent, nothing left to delete, no error.
  logs.length=0;
  const rerun=worker.scheduled(null,{tear_of_god_db:db},{waitUntil:(p)=>{driven=p;}});
  if (driven) await driven; else await rerun;
  const secondLog=logs.find(l=>l.includes('notification-cleanup'))||'';
  assert.ok(secondLog.includes('"deleted":0'),'G: second run must delete 0 rows');
  assert.equal(await count('SELECT COUNT(*) n FROM notifications'),4,'G: row set unchanged after the second run');

  originalLog('Notification cleanup Worker checks passed (A-G: retention boundary, multi-user global purge, unread safety, counter stability, idempotency).');
  originalLog('captured worker logs:', JSON.stringify(logs));
} finally {
  console.log=originalLog;
  await mf.dispose();
}