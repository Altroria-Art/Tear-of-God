import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { onRequest as notifications } from '../../functions/api/notifications.js';
import { recordLikeDigest } from '../../functions/lib/notifications.js';

// SQL here has one statement terminator per line, plus trigger BEGIN/END blocks
// (copied from remaining-d1.mjs so schema.sql + 0015 triggers apply cleanly).
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

// SQLite stores timestamps as 'YYYY-MM-DD HH:MM:SS' (UTC). Compute them in JS
// and bind as parameters so the comparison uses real values, not string
// expressions passed as literals.
const nowMs=Date.now();
const dbts=(ms)=>new Date(ms).toISOString().replace('T',' ').slice(0,19);
const daysAgo=(d)=>dbts(nowMs-d*86400000);
const hoursAgo=(h)=>dbts(nowMs-h*3600000);
const hmAgo=(h,m)=>dbts(nowMs-(h*3600+m*60)*1000);

// Requirements under test:
//  A  unread, 5 days old            -> still shown, never deleted (unread never expires)
//  B  read 23h59m ago                -> still shown, still in D1
//  C  read 72h ago                   -> not shown, physically deleted from D1
//  D  mark single read               -> read_at stamped (countdown starts at read time)
//  E  re-open an already-read one    -> read_at NOT extended
//  F  mark all read                  -> every unread gets read_at
//  G  like_digest read then new like -> is_read flips 0, read_at back to NULL
//  H  cleanup of read rows           -> unread counter unchanged
// Plus: the 24h clock runs from read_at, not created_at (B uses a 30-day-old
// created_at yet stays visible; C uses a fresh created_at yet is hidden).

const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:'export default {fetch(){return new Response("test")}}',compatibilityDate:'2026-01-01',d1Databases:['DB']}));
try {
  const db=await mf.getD1Database('DB');
  const run=async (database,sql)=>database.batch(statements(sql).map(s=>database.prepare(s)));
  await run(db,await read('schema.sql'));           // includes read_at column + idx_notifications_user_read_at
  await run(db,await read('migrations-active/0015_exact_unread_counts.sql')); // exact counter + triggers
  await db.prepare("INSERT INTO profiles(id,username) VALUES ('viewer','Viewer')").run();

  const env={tear_of_god_db:db,NOTIFICATION_UNREAD_COUNTS:'true'};
  const data={user:{id:'viewer'}};
  const seed=(id,isRead,readAt,createdAt)=>db.prepare(
    "INSERT INTO notifications(id,user_id,type,is_read,read_at,created_at) VALUES (?,?,'community_average',?,?,?)"
  ).bind(id,'viewer',isRead,readAt,createdAt).run();
  const counter=()=>db.prepare('SELECT unread_count AS n FROM notification_unread_counts WHERE user_id=?').bind('viewer').first().then(r=>r?.n??0);
  const exactUnread=()=>db.prepare('SELECT COUNT(*) AS n FROM notifications WHERE user_id=? AND is_read=0').bind('viewer').first().then(r=>r.n);
  const get=async (limit=20)=>{
    const response=await notifications({request:new Request(`https://test/api/notifications?limit=${limit}`),env,data});
    assert.equal(response.status,200);
    return response.json();
  };
  const post=(action,body)=>notifications({request:new Request('https://test/api/notifications',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...body})}),env,data});
  const row=(id)=>db.prepare('SELECT * FROM notifications WHERE id=?').bind(id).first();

  // Seeds: contrast created_at vs read_at to prove the clock starts at read time.
  await seed('unread-old','0',null,daysAgo(5));              // A  created 5d ago, never read
  await seed('read-fresh','1',hmAgo(23,59),daysAgo(30));     // B  created 30d ago but read 23h59m ago
  await seed('read-expired','1',hoursAgo(72),dbts(nowMs));   // C  created just now but read 72h ago
  await seed('read-null','1',null,daysAgo(30));              // legacy read row with NULL window -> keep visible
  const counterBefore=await counter();
  assert.equal(counterBefore,1); // only unread-old is unread

  // --- GET 1: A/B shown, C hidden AND deleted from D1 (lazy cleanup); H: counter untouched ---
  const list1=(await get()).data;
  const present=list1.map(n=>n.id);
  assert.ok(present.includes('unread-old'),'A: 5-day-old unread must be shown');
  assert.ok(present.includes('read-fresh'),'B: read 23h59m ago must be shown');
  assert.ok(!present.includes('read-expired'),'C: read 72h ago must not be shown');
  assert.ok(present.includes('read-null'),'legacy read row with NULL read_at stays visible');
  assert.equal((await row('read-expired')),null,'C: expired row must be physically deleted from D1');
  assert.ok(await row('read-fresh'),'B: recent read row must survive cleanup');
  assert.ok(await row('unread-old'),'A: unread row must never be cleaned');
  assert.equal(await counter(),counterBefore,'H: cleanup of read rows must not touch unread counter');
  assert.equal(await exactUnread(),counterBefore);
  assert.equal((await get()).unreadCount,1);
  console.log('A/B/C/H pass: unread never expires; 24h counts from read_at (not created_at); expired read rows deleted; counter stable');

  // --- D: mark single read stamps read_at once ---
  assert.equal((await post('read',{id:'unread-old'})).status,200);
  const afterD=await row('unread-old');
  assert.equal(afterD.is_read,1);
  assert.ok(afterD.read_at,'D: first read must stamp read_at');
  assert.equal(await counter(),0);
  const readAt=afterD.read_at;
  console.log('D pass: reading stamps read_at and decrements the exact counter');

  // --- E: re-opening an already-read notification must not extend read_at ---
  assert.equal((await post('read',{id:'unread-old'})).status,200);
  assert.equal((await row('unread-old')).read_at,readAt,'E: read_at must not move when re-opened');
  assert.equal(await counter(),0);
  console.log('E pass: re-opening an already-read notification keeps the original read_at');

  // --- F: mark all read stamps every unread row ---
  await seed('unread-x','0',null,dbts(nowMs));
  await seed('unread-y','0',null,dbts(nowMs));
  assert.equal(await counter(),2);
  assert.equal((await post('read_all',{})).status,200);
  const fx=await row('unread-x');const fy=await row('unread-y');
  assert.equal(fx.is_read,1);assert.ok(fx.read_at,'F: read_all stamps read_at on each row');
  assert.equal(fy.is_read,1);assert.ok(fy.read_at);
  assert.equal(await counter(),0);
  assert.equal((await get()).unreadCount,0);
  console.log('F pass: mark-all-read stamps read_at on every unread notification');

  // --- G: like_digest read, then a new like on the same bangkok day ---
  const digestKey=`viewer:${new Date(Date.now()+7*60*60*1000).toISOString().slice(0,10)}`;
  await db.prepare("INSERT INTO rankings(id,user_id) VALUES ('r-d','viewer')").run();
  await db.prepare("INSERT INTO notifications(id,user_id,type,digest_key,is_read,read_at) VALUES ('digest','viewer','like_digest',?,1,datetime('now','-72 hours'))").bind(digestKey).run();
  const before=await row('digest');
  await recordLikeDigest(db,'r-d','some-other-user'); // same day -> ON CONFLICT(digest_key)
  const after=await row('digest');
  assert.equal(after.is_read,0,'G: new like must flip the digest back to unread');
  assert.equal(after.read_at,null,'G: reused digest must clear read_at so it cannot be cleaned by the old window');
  assert.equal(after.aggregate_count,before.aggregate_count+1);
  assert.equal(await counter(),1,'G: digest flip read(1) -> unread(0) must +1 the counter');
  assert.equal(await exactUnread(),1);
  const libSource=await readFile(new URL('../../functions/lib/notifications.js',import.meta.url),'utf8');
  assert.ok(libSource.includes('read_at = NULL,'),'G: ON CONFLICT insert must reset read_at = NULL in lib');
  console.log('G pass: like_digest re-activation clears read_at and returns to unread');

  // --- Final exact-counter reconciliation (H revisited) after digest + cleanup ---
  const expected=await db.prepare('SELECT user_id,COUNT(*) n FROM notifications WHERE is_read=0 GROUP BY user_id ORDER BY user_id').all();
  const actual=await db.prepare('SELECT user_id,unread_count n FROM notification_unread_counts WHERE unread_count>0 ORDER BY user_id').all();
  assert.deepEqual(actual.results,expected.results);
  console.log('Exact unread counter reconciles with the table after all A-H operations.');

  console.log('Notification read-at retention checks passed.');
} finally {await mf.dispose();}