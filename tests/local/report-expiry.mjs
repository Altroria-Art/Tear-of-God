import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { SQL_SCRIPT_SEPARATOR } from './helpers/sql.mjs';
import { onRequest as adminReports } from '../../functions/api/admin/reports.js';
import { onRequest as reportEndpoint } from '../../functions/api/report.js';
import { onRequest as deleteAdminUser } from '../../functions/api/admin/users.js';
import { templateDeleteStatements } from '../../functions/lib/templateDelete.js';

// Permanent retention, original text, action history, migration and atomic moderation.
const schema = await readFile(new URL('../../schema.sql', import.meta.url), 'utf8');
const migration = await readFile(new URL('../../migrations/0019_report_retention.sql', import.meta.url), 'utf8');
const oldCaches = globalThis.caches;
globalThis.caches = { default: { delete: async () => true } };
const oldTable = `CREATE TABLE IF NOT EXISTS reports (
 id TEXT PRIMARY KEY, template_id TEXT REFERENCES templates(id) ON DELETE CASCADE,
 ranking_id TEXT REFERENCES rankings(id) ON DELETE CASCADE,
 comment_id TEXT REFERENCES comments(id) ON DELETE CASCADE,
 template_comment_id TEXT REFERENCES template_comments(id) ON DELETE CASCADE,
 reporter_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
 reason TEXT, status TEXT DEFAULT 'pending', closed_at DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);`;
const resources = [];
const realNow = Date.now;
let testClock = realNow();
Date.now = () => testClock;
async function world(legacy = false) {
 // Each independent database fixture uses a separate report rate-limit window.
 testClock += 3600001;
 const mf = new Miniflare(convertV4MiniflareOptions({ modules: true, script: 'export default { fetch() { return new Response("retention test"); } }', compatibilityDate: '2026-01-01', d1Databases: ['DB'] }));
 resources.push(mf);const db = await mf.getD1Database('DB');
 const sql = legacy ? schema.split('-- Report snapshots and permanent moderation history.')[0].replace(/CREATE TABLE IF NOT EXISTS reports \([\s\S]*?\n\);/, oldTable) : schema;
 await db.batch(sql.split(SQL_SCRIPT_SEPARATOR).map(s => db.prepare(s)));
 await db.prepare("INSERT INTO profiles(id,username,role) VALUES ('admin','QA admin','admin'), ('owner','Owner','user'),('reporter','Reporter','user'),('reporter2','Other reporter','user')").run();
 await db.prepare("INSERT INTO templates(id,creator_id,title,description,hashtags,tiers,use_count) VALUES ('topic','owner','Original topic','Original topic text','#UP','[]',1)").run();
 await db.prepare("INSERT INTO rankings(id,user_id,template_id,title,description,hashtags,comments_count) VALUES ('post','owner','topic','Original post','Original post text','#UP',3)").run();
 await db.prepare("INSERT INTO comments(id,ranking_id,user_id,content,parent_id) VALUES ('comment','post','owner','Original comment <script>test</script>',NULL),('reply','post','owner','Original reply','comment'),('nested','post','owner','Original nested reply','reply')").run();
 await db.prepare("INSERT INTO template_comments(id,template_id,user_id,content) VALUES ('tc','topic','owner','Original topic comment')").run();
 return db;
}
function request(body, get = '') { return new Request('https://retention.test/api/admin/reports' + get, body ? { method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body) } : {}); }
async function call(db, body, get = '', user = 'admin') { const response = await adminReports({request:request(body,get),env:{tear_of_god_db:db},data:{user:{id:user}}});return {status:response.status,body:await response.json()}; }
const row = (db,id) => db.prepare('SELECT * FROM reports WHERE id = ?').bind(id).first();
const history = async (db,id) => (await db.prepare('SELECT action, status, actor_name FROM report_actions WHERE report_id = ? ORDER BY id').bind(id).all()).results;
async function create(db, column, id, reporter = 'reporter') {
 const response = await reportEndpoint({ request: request({[column]:id,reporter_id:'owner',reason:'Synthetic QA report'}), env:{tear_of_god_db:db},data:{user:{id:reporter}} });
 assert.equal(response.status,201);return (await response.json()).data.id;
}
try {
 const db = await world();
 const id = await create(db,'comment_id','comment');
 assert.equal((await row(db,id)).reporter_id,'reporter');
 assert.equal((await row(db,id)).content_text,'Original comment <script>test</script>');
 await db.prepare("UPDATE comments SET content='Edited after report' WHERE id='comment'").run();
 assert.equal((await row(db,id)).content_text,'Original comment <script>test</script>','Original snapshot does not follow edits');
 let result = await call(db,{action:'set_status',target_id:id,status:'resolved'});assert.equal(result.status,200);
 assert.equal((await row(db,id)).moderation_action,'kept');assert.equal((await row(db,id)).moderated_by,'admin');
 await db.prepare("UPDATE reports SET closed_at=datetime('now','-100 years') WHERE id=?").bind(id).run();
 result=await call(db,null,'?status=resolved');assert.equal(result.body.total,1);assert.equal(result.body.data[0].snapshot.text,'Original comment <script>test</script>');
 await call(db,null,'?count=pending');assert(await row(db,id),'GET never purges old records');
 assert.equal((await call(db,{action:'set_status',target_id:id,status:'pending'})).status,200,'Reopen after any age');
 assert.deepEqual((await history(db,id)).map(h=>h.action),['pending','kept','reopened']);
 await call(db,{action:'set_status',target_id:id,status:'resolved'});
 const count=(await history(db,id)).length;await call(db,{action:'set_status',target_id:id,status:'resolved'});assert.equal((await history(db,id)).length,count,'Repeated decision is idempotent');
 const duplicate=await create(db,'comment_id','comment','reporter2');
 const child=await create(db,'comment_id','nested','reporter2');
 result=await call(db,{action:'delete_content',target_id:id});assert.equal(result.status,200);
 assert.equal(await db.prepare("SELECT id FROM comments WHERE id='comment'").first(),null);
 assert.equal((await db.prepare("SELECT comments_count FROM rankings WHERE id='post'").first()).comments_count,0);
 for(const rid of [id,duplicate,child]){const kept=await row(db,rid);assert(kept);assert.equal(kept.status,'resolved');assert(kept.target_removed_at);assert.equal(kept.comment_id,null);}
 assert.equal((await row(db,id)).moderation_action,'deleted');assert.equal((await row(db,child)).moderation_action,'removed');
 assert.equal((await call(db,{action:'set_status',target_id:id,status:'pending'})).status,409,'Cannot reopen missing content');
 const events=(await history(db,id)).length;await call(db,{action:'delete_content',target_id:id});assert.equal((await history(db,id)).length,events,'Repeated deletion has one decision');
 assert.equal((await call(db,{action:'delete',target_id:id})).status,400,'Cannot erase report via old action');
 assert.equal((await call(db,null,'?status=all','owner')).status,403,'Archive restricted to admins');
 result=await call(db,null,'?status=resolved');assert.equal(result.body.total,3);assert(result.body.data.some(r=>r.id===id&&r.kind==='comment'&&r.history.some(h=>h.actor_name==='QA admin')));
 // Target cascades, including account deletion, retain every reported kind.
 const cascadeDb=await world();const all=[];
 for(const [col,key] of [['template_id','topic'],['ranking_id','post'],['comment_id','comment'],['template_comment_id','tc']])all.push(await create(cascadeDb,col,key,'reporter2'));
 await cascadeDb.batch(templateDeleteStatements(cascadeDb,'topic'));
 assert.equal((await call(cascadeDb,null,'?status=resolved')).body.total,4);
 for(const rid of all){const saved=await row(cascadeDb,rid);assert(saved.content_title||saved.content_text);assert(saved.target_removed_at);}
 const response=await deleteAdminUser({request:request({action:'delete',target_id:'reporter2'}),env:{tear_of_god_db:cascadeDb},data:{user:{id:'admin'}}});assert.equal(response.status,200);
 for(const rid of all)assert.equal((await row(cascadeDb,rid)).reporter_id,null);
 // A failed transaction cannot mark content deleted or add a decision.
 const atomic=await world();const atomicId=await create(atomic,'ranking_id','post','reporter2');
 const broken={prepare:sql=>atomic.prepare(sql),batch:stmts=>atomic.batch([...stmts,atomic.prepare('INSERT INTO missing_qa_table VALUES (1)')])};
 assert.equal((await call(broken,{action:'delete_content',target_id:atomicId})).status,500);
 assert.equal((await row(atomic,atomicId)).status,'pending');assert.equal((await history(atomic,atomicId)).length,1);assert(await atomic.prepare("SELECT id FROM rankings WHERE id='post'").first());
 const outcomes=await Promise.all([call(atomic,{action:'delete_content',target_id:atomicId}),call(atomic,{action:'set_status',target_id:atomicId,status:'resolved'})]);
 assert(outcomes.every(r=>[200,409].includes(r.status)));assert.equal((await row(atomic,atomicId)).moderation_action,'deleted');
 for(const [column,key,table] of [['template_id','topic','templates'],['template_comment_id','tc','template_comments']]){
  const direct=await world();const directId=await create(direct,column,key);
  assert.equal((await call(direct,{action:'delete_content',target_id:directId})).status,200);
  assert.equal(await direct.prepare(`SELECT id FROM ${table} WHERE id = ?`).bind(key).first(),null);
  assert.equal((await row(direct,directId)).moderation_action,'deleted');
  assert.equal((await history(direct,directId)).at(-1).actor_name,'QA admin');
 }
 const concurrent=await world();const concurrentId=await create(concurrent,'ranking_id','post');
 const repeated=await Promise.all([call(concurrent,{action:'delete_content',target_id:concurrentId}),call(concurrent,{action:'delete_content',target_id:concurrentId})]);
 assert(repeated.every(r=>r.status===200));assert.equal((await history(concurrent,concurrentId)).filter(h=>h.action==='deleted').length,1);
 assert.equal((await concurrent.prepare("SELECT use_count FROM templates WHERE id='topic'").first()).use_count,0);
 // Existing schema migration preserves IDs and backfills surviving text only.
 const legacy=await world(true);
 await legacy.prepare("INSERT INTO reports(id,comment_id,reporter_id,reason,status,closed_at) VALUES ('old','comment','reporter','Old reason','resolved',datetime('now','-2 years'))").run();
 await legacy.batch(migration.split(SQL_SCRIPT_SEPARATOR).map(s=>legacy.prepare(s)));
 assert.equal((await row(legacy,'old')).moderation_action,'legacy');assert.equal((await row(legacy,'old')).content_text,'Original comment <script>test</script>');
 await legacy.prepare("DELETE FROM comments WHERE id='comment'").run();assert(await row(legacy,'old'));assert.equal((await row(legacy,'old')).comment_id,null);
 assert.deepEqual((await legacy.prepare('PRAGMA foreign_key_check').all()).results,[]);
 console.log('PASS: permanent reports, immutable text, decisions/history, all target/account cascades, admin access, atomic rollback, concurrent moderation and migration 0019.');
} finally { Date.now=realNow;globalThis.caches=oldCaches;await Promise.all(resources.map(mf=>mf.dispose())); }
