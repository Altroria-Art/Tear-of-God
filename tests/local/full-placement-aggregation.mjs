import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

// Isolated query experiment. Never reads/applies migrations or touches a saved DB.
const mf = new Miniflare(convertV4MiniflareOptions({modules:true,script:'export default {fetch(){return new Response("test")}}',compatibilityDate:'2026-01-01',d1Databases:['DB']}));
const canonical = rows => rows.map(r=>JSON.stringify([r.template_id,r.item_id,r.tier,r.placements])).sort();
try {
  const db=await mf.getD1Database('DB');
  const schema=await readFile(new URL('../../schema.sql',import.meta.url),'utf8');
  await db.batch(schema.split(/\r?\n/).filter(l=>!l.trimStart().startsWith('--')).join('\n').split(';').map(s=>s.trim()).filter(Boolean).map(s=>db.prepare(s)));
  await db.prepare("INSERT INTO profiles(id,username) VALUES ('author','Author')").run();
  await db.prepare("INSERT INTO templates(id,title,creator_id) VALUES ('t1','One','author'),('t2','Two','author'),('other','Unselected','author')").run();
  const queries={
    baseline:`SELECT r.template_id,ri.item_id,ri.tier,COUNT(*) placements
      FROM ranking_items ri JOIN rankings r ON r.id=ri.ranking_id
      WHERE r.template_id IN ('t1','t2') AND ri.tier IS NOT NULL
      GROUP BY r.template_id,ri.item_id,ri.tier`,
    materialized_rankings:`WITH selected AS MATERIALIZED (
      SELECT id,template_id FROM rankings WHERE template_id IN ('t1','t2'))
      SELECT r.template_id,ri.item_id,ri.tier,COUNT(*) placements
      FROM selected r JOIN ranking_items ri ON r.id=ri.ranking_id
      WHERE ri.tier IS NOT NULL GROUP BY r.template_id,ri.item_id,ri.tier`,
    per_ranking_groups:`SELECT template_id,item_id,tier,SUM(placements) placements FROM (
      SELECT r.template_id,ri.item_id,ri.tier,COUNT(*) placements
      FROM rankings r JOIN ranking_items ri ON ri.ranking_id=r.id
      WHERE r.template_id IN ('t1','t2') AND ri.tier IS NOT NULL
      GROUP BY r.id,ri.item_id,ri.tier
    ) GROUP BY template_id,item_id,tier`,
    template_json:`SELECT r.template_id,json_group_array(json_array(ri.item_id,ri.tier)) items
      FROM rankings r JOIN ranking_items ri ON ri.ranking_id=r.id
      WHERE r.template_id IN ('t1','t2') AND ri.tier IS NOT NULL
      GROUP BY r.template_id`,
  };
  for(const size of [200,2000]) {
    await db.prepare('DELETE FROM rankings').run();
    await db.prepare(`WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<?)
      INSERT INTO rankings(id,user_id,template_id) SELECT 'r'||n,'author',CASE n%3 WHEN 0 THEN 'other' WHEN 1 THEN 't1' ELSE 't2' END FROM seq`).bind(size).run();
    await db.prepare(`WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<20)
      INSERT INTO ranking_items(id,ranking_id,item_id,tier)
      SELECT r.id||':'||n,r.id,'item'||n,CASE n%3 WHEN 0 THEN 'S' WHEN 1 THEN 'A' ELSE 'Custom ไทย' END FROM rankings r,seq`).run();
    // Preserve duplicate placements, null item IDs, and arbitrary labels exactly.
    await db.prepare("INSERT INTO ranking_items(id,ranking_id,item_id,tier) VALUES ('dup','r1','item1','A'),('null','r1',NULL,'A'),('escaped','r1','x\"y','[custom]')").run();
    let expected;
    for(const [name,sql] of Object.entries(queries)) {
      const result=await db.prepare(sql).all();
      assert.equal(result.meta.rows_written,0);
      let histogram=result.results;
      if(name==='template_json') {
        histogram=[];
        for(const row of result.results) {
          const counts=new Map();
          for(const [item,tier] of JSON.parse(row.items)) {
            const key=JSON.stringify([item,tier]);
            const entry=counts.get(key);
            if(entry) entry.placements++;
            else counts.set(key,{template_id:row.template_id,item_id:item,tier,placements:1});
          }
          histogram.push(...counts.values());
        }
      }
      if(name==='baseline') expected=canonical(histogram);
      else assert.deepEqual(canonical(histogram),expected,name);
      const plan=(await db.prepare('EXPLAIN QUERY PLAN '+sql).all()).results.map(r=>r.detail);
      console.log(JSON.stringify({rankings:size,candidate:name,rows_read:result.meta.rows_read,response_bytes:Buffer.byteLength(JSON.stringify(result.results)),temp_grouping:plan.filter(p=>p.includes('TEMP B-TREE'))}));
    }
  }
  console.log('Exact histograms verified for all candidates; no application changes or migrations applied.');
} finally {await mf.dispose();}
