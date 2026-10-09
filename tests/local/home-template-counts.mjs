import { SQL_SCRIPT_SEPARATOR } from './helpers/sql.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { onRequest as rankings } from '../../functions/api/rankings.js';
import { onRequest as adminRankings } from '../../functions/api/admin/rankings.js';
const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:'export default {fetch(){return new Response("test")}}',compatibilityDate:'2026-01-01',d1Databases:['DB']}));
try {
 const db=await mf.getD1Database('DB');
 const run=async text=>db.batch(text.split(/\r?\n/).filter(line=>!line.trimStart().startsWith('--')).join('\n').split(SQL_SCRIPT_SEPARATOR).map(s=>s.trim()).filter(Boolean).map(sql=>db.prepare(sql)));
 await run(await readFile(new URL('../../schema.sql',import.meta.url),'utf8'));
 await db.prepare("INSERT INTO profiles(id,username,role) VALUES ('author','Author','user'),('admin','Admin','admin')").run();
 await db.prepare("INSERT INTO templates(id,creator_id,use_count) VALUES ('tpl','admin',999)").run();
 await db.prepare("INSERT INTO rankings(id,user_id,template_id) VALUES ('a','author','tpl'),('b','author','tpl'),('c','author','tpl')").run();
 await run(await readFile(new URL('../../migrations-active/0025_home_template_use_counts.sql',import.meta.url),'utf8'));
 const count=async()=> (await db.prepare("SELECT use_count FROM templates WHERE id='tpl'").first()).use_count;
 assert.equal(await count(),3,'one-time reconciliation repairs historical counter drift');
 const call=async(handler,method,user,body)=>handler({request:new Request('https://counts.test/api/rankings',{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),env:{tear_of_god_db:db},data:{user:{id:user}}});
 assert.equal((await call(rankings,'DELETE','author',{id:'a'})).status,200);
 assert.equal(await count(),2,'owner deletion updates precomputed count');
 const results=await Promise.all([call(adminRankings,'POST','admin',{action:'delete',target_id:'b'}),call(adminRankings,'POST','admin',{action:'delete',target_id:'b'})]);
 assert(results.every(r=>r.status===200));
 assert.equal(await count(),1,'concurrent deletion does not double-decrement');
 console.log('Home template counts: backfill, owner deletion, concurrent admin deletion passed.');
} finally {await mf.dispose()}
