// Synthetic content only, guarded by a marker in a separate local D1 database.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export async function siteFixture() {
  const base = process.env.BROWSER_QA_URL;
  const state = path.resolve(process.env.BROWSER_QA_STATE || '');
  const root = process.cwd();
  assert(base && ['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Explicit loopback URL required');
  assert(state.startsWith(path.join(root, '.wrangler', 'browser-qa-')) && state.endsWith(path.sep + 'state'), 'Use a separate QA state');
  const output = path.dirname(state);
  const manifest = path.join(output, 'site-fixture.json');
  const q = value => `'${String(value).replaceAll("'", "''")}'`;
  function sql(content, name) {
    const file = path.join(output, name + '.sql');
    fs.writeFileSync(file, content);
    execFileSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'd1', 'execute', 'tear-of-god-db', '--local', '--persist-to', state, '--file', file], { cwd: root, stdio: 'pipe', windowsHide: true, timeout: 90000 });
  }
  async function api(route, options = {}) {
    const response = await fetch(base + route, options);
    return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
  }
  if (fs.existsSync(manifest)) {
    const saved = JSON.parse(fs.readFileSync(manifest, 'utf8'));
    assert.equal((await api('/api/users?id=' + saved.marker)).data.data?.username, saved.marker, 'Server uses isolated state');
    return { ...saved, base, output, sql, api };
  }
  const run = randomUUID().slice(0, 8), marker = `site-qa-isolation-${run}`;
  sql(`INSERT INTO profiles(id,username) VALUES(${q(marker)},${q(marker)});`, 'site-marker');
  assert.equal((await api('/api/users?id=' + marker)).data.data?.username, marker, 'Server uses isolated state before any HTTP mutation');
  const password = `SiteQA-${randomUUID()}!`;
  const accounts = [];
  for (const letter of ['A', 'B', 'Admin']) {
    const person = { email: `site-qa-${run}-${letter}@example.test`, username: `QA ${letter} ทดสอบชื่อผู้ใช้ภาษาไทยและEnglish` };
    const registration = await api('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'register', ...person, password }) });
    assert.equal(registration.status, 201);
    const login = await api('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'login', email: person.email, password }) });
    assert.equal(login.status, 200);
    accounts.push({ ...person, id: login.data.data.id });
  }
  const tiers = [{ id:'s',label:'ชอบมากที่สุด',color:'bg-[#ff7979]' },{ id:'a',label:'A',color:'#ffbf7f' },{ id:'b',label:'น่าลองอีกสักครั้ง',color:'#ffff80' },{ id:'c',label:'C',color:'#80ff80' },{ id:'d',label:'ยังไม่เคยลอง',color:'#80bfff' }];
  const topic = `site-qa-${run}-topic`, empty = `site-qa-${run}-empty`, unposted = `site-qa-${run}-unposted`, duel = `site-qa-${run}-duel`;
  const posts = accounts.slice(0,2).map((_, index) => `site-qa-${run}-post-${index}`);
  const statements = [
    `UPDATE profiles SET role='admin' WHERE id=${q(accounts[2].id)};`,
    `UPDATE profiles SET bio='พื้นที่ทดลอง UX/UI — ไม่ใช่ข้อมูลผู้ใช้จริง',university='มหาวิทยาลัยพะเยา',faculty='คณะเทคโนโลยีสารสนเทศและการสื่อสาร',major='สาขาวิชาวิศวกรรมซอฟต์แวร์',year='67',created_at='2026-08-01 12:00:00' WHERE id=${q(accounts[0].id)};`,
  ];
  for (let index=0;index<13;index++) {
    const id = index===0 ? topic : index===1 ? empty : index===2 ? unposted : topic+'-'+index;
    const title = index===0 ? 'ร้านอาหารในมหาวิทยาลัยพะเยา — ชื่อหัวข้อยาวสำหรับตรวจการขึ้นบรรทัดใหม่ University campus rankings' : `หัวข้อทดสอบ ${index} Campus topic`;
    statements.push(`INSERT INTO templates(id,creator_id,title,description,hashtags,tiers,use_count) VALUES(${q(id)},${q(accounts[0].id)},${q(title)},'ลองจัดอันดับแล้วเทียบกับทุกคนในมหาวิทยาลัย — Local QA only','#มพ,#Campus,#SoftwareEngineering',${q(JSON.stringify(tiers))},${index===0?2:0});`);
    for(let item=0; item<(index===1?0:index===0?13:4);item++) {
      const itemId = id+'-item-'+item;
      statements.push(`INSERT INTO items(id,name,image_url) VALUES(${q(itemId)},${q(item===3?'VeryLongUnbrokenItemNameForResponsiveLayout1234567890':`อาหาร ${item} Thai and English item name`)},${item===0?q('/favicon.svg'):item===1?q('/missing-qa-image.png'):'NULL'});`);
      statements.push(`INSERT INTO template_items(id,template_id,item_id,tier,position) VALUES(${q(itemId)},${q(id)},${q(itemId)},'unranked',${item});`);
    }
  }
  for (let index=0;index<2;index++) {
    statements.push(`INSERT INTO rankings(id,user_id,template_id,title,description,hashtags,last_activity_at) SELECT ${q(posts[index])},${q(accounts[index].id)},id,title,description,hashtags,CURRENT_TIMESTAMP FROM templates WHERE id=${q(topic)};`);
    for(let item=0;item<13;item++) {
      const tierIndex = (item+index)%4, itemId=topic+'-item-'+item;
      statements.push(`INSERT INTO ranking_items(id,ranking_id,item_id,tier,position) VALUES(${q(posts[index]+'-item-'+item)},${q(posts[index])},${q(itemId)},${q(tiers[tierIndex].label)},${item});`);
      statements.push(`INSERT INTO ranking_item_scores(id,ranking_id,template_id,item_id,tier_index,score) VALUES(${q(posts[index]+'-score-'+item)},${q(posts[index])},${q(topic)},${q(itemId)},${tierIndex},${100-tierIndex*25});`);
    }
    statements.push(`INSERT INTO template_user_contributions(template_id,user_id,current_ranking_id,cooldown_until,last_contributed_at) VALUES(${q(topic)},${q(accounts[index].id)},${q(posts[index])},datetime('now','-1 day'),CURRENT_TIMESTAMP);`);
  }
  statements.push(`INSERT INTO comments(id,ranking_id,user_id,content) VALUES(${q(posts[0]+'-comment')},${q(posts[0])},${q(accounts[1].id)},'ความเห็นภาษาไทยและEnglish สำหรับ QA');`);
  statements.push(`INSERT INTO template_comments(id,template_id,user_id,content) VALUES(${q(topic+'-comment')},${q(topic)},${q(accounts[1].id)},'อันดับรวมของทุกคนเป็นอย่างไรบ้าง');`);
  statements.push(`UPDATE rankings SET comments_count=1 WHERE id=${q(posts[0])};`);
  statements.push(`INSERT INTO profile_pins(user_id,ranking_id,position) VALUES(${q(accounts[0].id)},${q(posts[0])},0);`);
  statements.push(`INSERT INTO template_bookmarks(user_id,template_id) VALUES(${q(accounts[0].id)},${q(topic)});`);
  statements.push(`INSERT INTO notifications(id,user_id,actor_id,type,ranking_id,comment_id) VALUES(${q(topic+'-notification')},${q(accounts[0].id)},${q(accounts[1].id)},'comment',${q(posts[0])},${q(posts[0]+'-comment')});`);
  statements.push(`INSERT INTO duels(id,challenger_id,owner_id,template_id,challenger_ranking_id,owner_ranking_id,similarity_score,community_similarity_score,community_sample_count) VALUES(${q(duel)},${q(accounts[1].id)},${q(accounts[0].id)},${q(topic)},${q(posts[1])},${q(posts[0])},75,87,2);`);
  statements.push(`INSERT INTO reports(id,ranking_id,reporter_id,reason) VALUES(${q(topic+'-report')},${q(posts[0])},${q(accounts[1].id)},'ทดสอบรายงานและการเก็บหลักฐาน QA only');`);
  sql(statements.join('\n'), 'site-seed');
  const fixture = { marker, accounts, password, topic, empty, unposted, posts, duel };
  fs.writeFileSync(manifest, JSON.stringify(fixture,null,2));
  return { ...fixture, base, output, sql, api };
}
