import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { onRequest as notifications } from '../../functions/api/notifications.js';
import { onRequest as admin } from '../../functions/api/admin/index.js';

// SQL here has one statement terminator per line, plus trigger BEGIN/END blocks.
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
const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:'export default {fetch(){return new Response("test")}}',compatibilityDate:'2026-01-01',d1Databases:['DB','GUARDS']}));
try {
  const db=await mf.getD1Database('DB');
  const schema=await read('schema.sql');
  const oldSchema=schema.replace(/(CREATE TABLE IF NOT EXISTS analytics_events[\s\S]*?)\) WITHOUT ROWID;/,'$1);');
  const run=async (database,sql)=>database.batch(statements(sql).map(s=>database.prepare(s)));
  await run(db,oldSchema);
  await db.prepare("INSERT INTO profiles(id,username,role) VALUES ('viewer','Viewer','admin'),('other','Other','user')").run();
  await db.prepare(`WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<1000)
    INSERT INTO analytics_events(id,event_name,session_id,user_id,created_at)
    SELECT 'e'||n,CASE n%5 WHEN 0 THEN 'feed_view' WHEN 1 THEN 'template_view' WHEN 2 THEN 'ranking_start' WHEN 3 THEN 'ranking_publish' ELSE 'share_complete' END,
    's'||(n/5),CASE WHEN n%3=0 THEN NULL ELSE 'viewer' END,datetime('now','-12 hours','-'||(n%40)||' days') FROM seq`).run();
  async function endpoint(handler,path,enabled=false) {
    let reads=0;
    const traced={prepare(sql){const wrap=s=>({bind:(...args)=>wrap(s.bind(...args)),all:async()=>{const r=await s.all();reads+=r.meta.rows_read;return r;},first:async()=>{const r=await s.all();reads+=r.meta.rows_read;return r.results[0]??null;},run:async()=>s.run()});return wrap(db.prepare(sql));}};
    const response=await handler({request:new Request('https://test'+path),env:{tear_of_god_db:traced,NOTIFICATION_UNREAD_COUNTS:enabled?'true':'false'},data:{user:{id:'viewer'}}});
    assert.equal(response.status,200);return {body:await response.json(),reads};
  }
  async function eventWrites() {
    const a=await db.prepare("INSERT OR IGNORE INTO analytics_events(id,event_name,session_id,user_id) VALUES ('probe','feed_view','probe','viewer')").run();
    const duplicate=await db.prepare("INSERT OR IGNORE INTO analytics_events(id,event_name,session_id,user_id) VALUES ('probe','feed_view','probe','viewer')").run();
    assert.equal(duplicate.meta.changes,0);assert.equal(duplicate.meta.rows_written,0);
    await db.prepare("DELETE FROM analytics_events WHERE id='probe'").run();return a.meta.rows_written;
  }
  const analyticsBefore=await endpoint(admin,'/api/admin?action=analytics&days=7');
  const eventsBefore=(await db.prepare('SELECT * FROM analytics_events ORDER BY id').all()).results;
  const writesBefore=await eventWrites();
  const migrated=await run(db,await read('migrations-active/0014_analytics_primary_storage.sql'));
  const migrationWrites=migrated.reduce((n,r)=>n+r.meta.rows_written,0);
  const writesAfter=await eventWrites();
  assert.equal(writesAfter,writesBefore-1);
  assert.deepEqual((await db.prepare('SELECT * FROM analytics_events ORDER BY id').all()).results,eventsBefore);
  const analyticsAfter=await endpoint(admin,'/api/admin?action=analytics&days=7');
  assert.deepEqual(analyticsAfter.body,analyticsBefore.body);
  console.log(`Authenticated event writes ${writesBefore} -> ${writesAfter}; duplicate 0 -> 0; report reads ${analyticsBefore.reads} -> ${analyticsAfter.reads}; rebuild writes for 1,000 events: ${migrationWrites}`);

  await db.prepare(`WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<1000)
    INSERT INTO notifications(id,user_id,type,is_read) SELECT 'n'||n,'viewer','community_average',n%2 FROM seq`).run();
  const unreadBefore=await endpoint(notifications,'/api/notifications?limit=20');
  const insertProbe=()=>db.prepare("INSERT OR IGNORE INTO notifications(id,user_id,type) VALUES ('probe','viewer','community_average')").run();
  const notificationWritesBefore=(await insertProbe()).meta.rows_written;
  await db.prepare("DELETE FROM notifications WHERE id='probe'").run();
  const counterMigration=await read('migrations-active/0015_exact_unread_counts.sql');
  await run(db,counterMigration);
  const unreadAfter=await endpoint(notifications,'/api/notifications?limit=20',true);
  assert.deepEqual(unreadAfter.body,unreadBefore.body);
  assert.ok(unreadAfter.reads<unreadBefore.reads/5);
  const notificationWritesAfter=(await insertProbe()).meta.rows_written;
  assert.equal(notificationWritesAfter,notificationWritesBefore+1);
  console.log(`Notification GET reads ${unreadBefore.reads} -> ${unreadAfter.reads}; unread insertion writes ${notificationWritesBefore} -> ${notificationWritesAfter}`);
  async function exact() {
    const expected=(await db.prepare('SELECT user_id,COUNT(*) n FROM notifications WHERE is_read=0 GROUP BY user_id ORDER BY user_id').all()).results;
    const actual=(await db.prepare('SELECT user_id,unread_count n FROM notification_unread_counts WHERE unread_count>0 ORDER BY user_id').all()).results;
    assert.deepEqual(actual,expected);
  }
  await exact();assert.equal((await insertProbe()).meta.rows_written,0);await exact();
  for(const sql of [
    "UPDATE notifications SET is_read=1 WHERE id='probe' AND is_read=0",
    "UPDATE notifications SET is_read=1 WHERE id='probe' AND is_read=0",
    "UPDATE notifications SET is_read=0 WHERE id='probe'",
    "UPDATE notifications SET user_id='other' WHERE id='probe'",
    "UPDATE notifications SET is_read=1 WHERE user_id='viewer' AND is_read=0",
    "DELETE FROM notifications WHERE id='probe'",
    "INSERT INTO notifications(id,user_id,type,digest_key) VALUES ('digest','viewer','like_digest','key')",
    "UPDATE notifications SET is_read=1 WHERE id='digest'",
    "INSERT INTO notifications(id,user_id,type,digest_key) VALUES ('digest2','viewer','like_digest','key') ON CONFLICT(digest_key) DO UPDATE SET is_read=0,aggregate_count=aggregate_count+1",
    "INSERT INTO notifications(id,user_id,type,digest_key) VALUES ('digest3','viewer','like_digest','key') ON CONFLICT(digest_key) DO UPDATE SET is_read=0,aggregate_count=aggregate_count+1",
  ]) {await db.prepare(sql).run();await exact();}
  await assert.rejects(db.batch([db.prepare("INSERT INTO notifications(id,user_id,type) VALUES ('rollback','viewer','community_average')"),db.prepare('INSERT INTO missing_table VALUES (1)')]));
  await exact();assert.equal(await db.prepare("SELECT id FROM notifications WHERE id='rollback'").first(),null);
  await assert.rejects(run(db,counterMigration));await exact();
  await db.prepare("INSERT INTO rankings(id,user_id) VALUES ('cascade','other')").run();
  await db.prepare("INSERT INTO notifications(id,user_id,type,ranking_id) VALUES ('cascade','viewer','community_average','cascade')").run();
  await db.prepare("DELETE FROM rankings WHERE id='cascade'").run();await exact();
  await db.prepare("DELETE FROM profiles WHERE id='viewer'").run();await exact();
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM analytics_events').first()).n,1000);
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM analytics_events WHERE user_id IS NOT NULL').first()).n,0);
  assert.deepEqual((await db.prepare('PRAGMA foreign_key_check').all()).results,[]);

  // Fail closed on schema drift, with batch rollback retaining existing indexes.
  const guard=await mf.getD1Database('GUARDS');await run(guard,oldSchema);
  await guard.prepare('DROP INDEX idx_rankings_user_created').run();
  await guard.prepare('CREATE INDEX idx_rankings_user_created ON rankings(title)').run();
  await guard.prepare('CREATE INDEX idx_rankings_user_id ON rankings(user_id)').run();
  await assert.rejects(run(guard,await read('migrations-active/0012_d1_index_efficiency.sql')));
  assert.ok(await guard.prepare("SELECT name FROM sqlite_schema WHERE name='idx_rankings_user_id'").first());
  await guard.prepare('DROP INDEX idx_rankings_user_created').run();
  await guard.prepare('CREATE INDEX idx_rankings_user_created ON rankings(user_id,created_at DESC,id DESC)').run();
  await guard.prepare('CREATE INDEX idx_ris_ranking ON ranking_item_scores(ranking_id)').run();
  await guard.prepare('CREATE TABLE scores_legacy AS SELECT * FROM ranking_item_scores').run();
  await guard.prepare('DROP TABLE ranking_item_scores').run();
  await guard.prepare('ALTER TABLE scores_legacy RENAME TO ranking_item_scores').run();
  await guard.prepare('CREATE INDEX idx_ris_ranking ON ranking_item_scores(ranking_id)').run();
  await run(guard,await read('migrations-active/0012_d1_index_efficiency.sql'));
  assert.ok(await guard.prepare("SELECT name FROM sqlite_schema WHERE name='idx_ris_ranking'").first());
  assert.equal(await guard.prepare("SELECT name FROM sqlite_schema WHERE name='__quota_0012_guard'").first(),null);
  await guard.prepare('DROP INDEX idx_ranking_items_ranking_tier').run();
  await guard.prepare('CREATE INDEX idx_ranking_items_ranking_id ON ranking_items(ranking_id)').run();
  await guard.prepare('CREATE INDEX idx_ranking_items_ranking_tier ON ranking_items(item_id)').run();
  await assert.rejects(run(guard,await read('migrations-active/0013_placement_tier_index.sql')));
  assert.ok(await guard.prepare("SELECT name FROM sqlite_schema WHERE name='idx_ranking_items_ranking_id'").first());
  const analyticsMigration=await read('migrations-active/0014_analytics_primary_storage.sql');
  await guard.prepare("INSERT INTO analytics_events(id,event_name,session_id) VALUES (NULL,'feed_view','legacy')").run();
  await assert.rejects(run(guard,analyticsMigration));
  assert.equal((await guard.prepare('SELECT COUNT(*) n FROM analytics_events WHERE id IS NULL').first()).n,1);
  await guard.prepare('DELETE FROM analytics_events WHERE id IS NULL').run();
  await guard.prepare("INSERT INTO analytics_events(id,event_name,session_id) VALUES ('legacy','feed_view','legacy')").run();
  await guard.prepare('CREATE TABLE acfa_event_ref (event_id TEXT REFERENCES analytics_events(id) ON DELETE CASCADE)').run();
  await guard.prepare("INSERT INTO acfa_event_ref VALUES ('legacy')").run();
  await assert.rejects(run(guard,analyticsMigration));
  assert.equal((await guard.prepare('SELECT COUNT(*) n FROM acfa_event_ref').first()).n,1);
  await guard.prepare('DROP TABLE acfa_event_ref').run();
  await guard.prepare('CREATE INDEX custom_analytics ON analytics_events(entity_id)').run();
  await assert.rejects(run(guard,analyticsMigration));
  assert.equal((await guard.prepare('SELECT COUNT(*) n FROM analytics_events').first()).n,1);
  assert.equal(await guard.prepare("SELECT name FROM sqlite_schema WHERE name='__quota_0014_guard'").first(),null);
  console.log('Exact reports/counts, retries, digests, state transfers, read-all, rollback, cascades and migration safety checks passed (ephemeral DBs only).');
} finally {await mf.dispose();}

