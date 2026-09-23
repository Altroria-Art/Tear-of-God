import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { onRequest } from '../../functions/api/rankings.js';
import { feedCommunityStats } from '../../functions/lib/community-cache.js';

const split = sql => sql.split(/\r?\n/).filter(l=>!l.trimStart().startsWith('--')).join('\n').split(';').map(s=>s.trim()).filter(Boolean);
// Original eligibility predicate, with the same bind order and feed handler.
function legacyQuery(sql) {
  if (!sql.includes('/* for-you eligibility */')) return sql.replaceAll(', ri.rowid ASC','');
  const tagCount = (sql.match(/IN \(([?,]+)\) OR lower\(trim/)?.[1].match(/\?/g) || []).length;
  const tagCond = tagCount ? `EXISTS (SELECT 1 FROM ranking_hashtags rh WHERE rh.ranking_id = r.id AND rh.hashtag IN (${Array(tagCount).fill('?').join(',')}))` : '0';
  return sql.replace(/\/\* for-you eligibility \*\/[\s\S]*?\/\* end for-you eligibility \*\//, `(
    CASE WHEN r.template_id IS NOT NULL AND r.template_id IN (
      SELECT template_id FROM rankings WHERE user_id = ? AND template_id IS NOT NULL
      UNION SELECT fav.template_id FROM votes v JOIN rankings fav ON v.ranking_id = fav.id
      WHERE v.user_id = ? AND v.vote_type = 'like' AND fav.template_id IS NOT NULL
      UNION SELECT topic_key FROM topic_follows WHERE user_id = ? AND topic_type = 'template'
    ) THEN 1 ELSE 0 END
    + CASE WHEN ${tagCond} OR EXISTS (
      SELECT 1 FROM topic_follows tf JOIN ranking_hashtags rh ON rh.hashtag = tf.topic_key
      WHERE tf.user_id = ? AND tf.topic_type = 'hashtag' AND rh.ranking_id = r.id
    ) THEN 1 ELSE 0 END
  ) >= 1`);
}

const mf = new Miniflare(convertV4MiniflareOptions({modules:true,script:'export default {fetch(){return new Response("test")}}',compatibilityDate:'2026-01-01',d1Databases:['DB']}));
try {
  const db = await mf.getD1Database('DB');
  await db.batch(split(await readFile(new URL('../../schema.sql',import.meta.url),'utf8')).map(s=>db.prepare(s)));
  await db.batch(['DROP INDEX idx_ranking_items_ranking_tier','CREATE INDEX idx_ranking_items_ranking_id ON ranking_items(ranking_id)'].map(s=>db.prepare(s)));
  await db.prepare("INSERT INTO profiles(id,username) VALUES ('author','Author'),('viewer','Viewer'),('empty','Empty'),('topics','Topics')").run();
  await db.prepare(`WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<10)
    INSERT INTO templates(id,title,creator_id,tiers) SELECT 't'||n,'Template '||n,'author','[{"label":"S"},{"label":"A"},{"label":"Custom ไทย"}]' FROM seq`).run();
  await db.prepare(`WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<2000)
    INSERT INTO rankings(id,user_id,title,template_id,hashtags,created_at)
    SELECT printf('r%04d',n),CASE WHEN n%200=0 THEN 'viewer' ELSE 'author' END,'Rank '||n,
      CASE WHEN n%17=0 THEN NULL ELSE 't'||(n%10+1) END,
      CASE n%4 WHEN 0 THEN '#Shared, #SHARED, ##double, ไทย' WHEN 1 THEN '#other, , #,' WHEN 2 THEN '#shared, escaped"quote, slash\value' ELSE NULL END,
      datetime('2026-09-20','-'||(n/2)||' minutes') FROM seq`).run();
  await db.prepare(`WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<20)
    INSERT INTO ranking_items(id,ranking_id,item_id,tier,position)
    SELECT r.id||':'||n,r.id,'item'||n,CASE WHEN n>4 THEN NULL WHEN n=1 THEN 'S' WHEN n=2 THEN 'A' ELSE 'Custom ไทย' END,n/2 FROM rankings r,seq`).run();
  await db.prepare("INSERT INTO ranking_items(id,ranking_id,item_id,tier,position) VALUES ('duplicate','r0001','item1','S',NULL),('null-item','r0001',NULL,'S',NULL)").run();
  await db.prepare("INSERT INTO votes(id,ranking_id,user_id,vote_type) VALUES ('v1','r0002','viewer','like'),('v2','r0003','viewer','dislike')").run();
  await db.prepare("INSERT INTO topic_follows(user_id,topic_type,topic_key) VALUES ('viewer','hashtag','other'),('viewer','template','t5'),('topics','hashtag','other')").run();
  await db.prepare("INSERT INTO follows VALUES ('viewer','author',CURRENT_TIMESTAMP)").run();

  async function measure(path,user='viewer',legacy=false,aggregate=false) {
    const queries=[];
    const traced={prepare(sql){
      if(legacy) sql=legacyQuery(sql);
      const wrap=stmt=>({bind:(...args)=>wrap(stmt.bind(...args)),all:async()=>{const r=await stmt.all();queries.push({sql,...r.meta});return r;},first:async()=>{const r=await stmt.all();queries.push({sql,...r.meta});return r.results[0]??null;}});
      return wrap(db.prepare(sql));
    }};
    const context={request:new Request('https://test'+path),env:{tear_of_god_db:traced,CACHE_METRIC_SAMPLE_RATE:'0'},data:{user:user?{id:user}:null}};
    const response=aggregate?await feedCommunityStats(context,traced,['t1','t2','missing'],{fresh:true}):await onRequest(context);
    if(!aggregate) assert.equal(response.status,200);
    return {body:aggregate?response:await response.json(),read:queries.reduce((sum,q)=>sum+q.rows_read,0),pool:queries.filter(q=>q.sql.includes('freshness_tier FROM rankings r')).reduce((sum,q)=>sum+q.rows_read,0)};
  }
  async function writeCost() {
    const results=[];
    for(const sql of ["INSERT INTO ranking_items(id,ranking_id,item_id,tier) VALUES ('probe','r0001','x','S')","UPDATE ranking_items SET tier='A' WHERE id='probe'","DELETE FROM ranking_items WHERE id='probe'"]) results.push((await db.prepare(sql).run()).meta.rows_written);
    return results;
  }
  const paths=['for_you','following','trending'].flatMap(type=>[1,2].map(page=>`/api/rankings?feed_type=${type}&seed=9&limit=12&page=${page}`));
  const cases=[...paths.map(path=>[path,'viewer']),...['empty','topics',null].map(user=>[paths[0],user]),...['&hashtag=other','&template_id=t1','&author_id=author','&days=7','&exclude=r0001,r0002','&pin=r0001'].map(suffix=>[paths[0]+suffix,'viewer'])];
  const before=[];
  for(const [path,user] of cases) before.push(await measure(path,user,true));
  const aggregateBefore=await measure('/api/test','viewer',false,true);
  const writesBefore=await writeCost();
  const queryOnly=await measure(paths[0]);
  assert.deepEqual(queryOnly.body,before[0].body);
  console.log(`For You selection query rows_read ${before[0].pool} -> ${queryOnly.pool}`);
  assert.ok(queryOnly.pool<before[0].pool);
  // Only 0013, on an ephemeral test DB. 0012 is never applied.
  const migration=split(await readFile(new URL('../../migrations-active/0013_placement_tier_index.sql',import.meta.url),'utf8'));
  await db.batch(migration.map(s=>db.prepare(s)));
  await db.batch(migration.map(s=>db.prepare(s)));
  const writesAfter=await writeCost();
  assert.equal(writesAfter[0],writesBefore[0]);
  assert.equal(writesAfter[2],writesBefore[2]);
  console.log(`Placement insert/tier-update/delete writes ${writesBefore} -> ${writesAfter}`);
  const aggregateAfter=await measure('/api/test','viewer',false,true);
  assert.deepEqual(aggregateAfter.body,aggregateBefore.body);
  console.log(`Cold aggregate rows_read ${aggregateBefore.read} -> ${aggregateAfter.read}`);
  assert.ok(aggregateAfter.read<aggregateBefore.read/2);
  for(let i=0;i<cases.length;i++) {
    const [path,user]=cases[i];
    const after=await measure(path,user);
    assert.deepEqual(after.body,before[i].body,`${path} user=${user}`);
    if(i<6) console.log(`${path} rows_read ${before[i].read} -> ${after.read}`);
  }
  await db.prepare("DELETE FROM rankings WHERE id='r0001'").run();
  assert.equal((await db.prepare("SELECT COUNT(*) n FROM ranking_items WHERE ranking_id='r0001'").first()).n,0);
  assert.deepEqual((await db.prepare('PRAGMA foreign_key_check').all()).results,[]);
  // Isolate NULL-density effects: identical histogram, same fixture, both indexes.
  await db.prepare('CREATE INDEX idx_ranking_items_ranking_id ON ranking_items(ranking_id)').run();
  for(const ranked of [0,10,20]) {
    await db.prepare("UPDATE ranking_items SET tier=CASE WHEN CAST(substr(item_id,5) AS INTEGER)<=? THEN 'S' ELSE NULL END").bind(ranked).run();
    const results=[];
    for(const index of ['idx_ranking_items_ranking_id','idx_ranking_items_ranking_tier']) {
      results.push(await db.prepare(`SELECT r.template_id,ri.item_id,ri.tier,COUNT(*) placements
        FROM ranking_items ri INDEXED BY ${index} JOIN rankings r ON r.id=ri.ranking_id
        WHERE r.template_id IN ('t1','t2') AND ri.tier IS NOT NULL
        GROUP BY r.template_id,ri.item_id,ri.tier`).all());
    }
    assert.deepEqual(results[1].results,results[0].results);
    console.log(`${ranked*5}% ranked: histogram rows_read ${results[0].meta.rows_read} -> ${results[1].meta.rows_read}`);
  }
  console.log('Exact feeds, tied positions, custom/NULL tiers, hashtag normalization, user isolation, filters, migration repeat and cascade checks passed.');
} finally {await mf.dispose();}
