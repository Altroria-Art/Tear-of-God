// Built UI + Pages Functions + isolated local D1. No production data or assets.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { chromium, delay } from './helpers/chromium.mjs';

const base = process.env.BROWSER_QA_URL;
const state = path.resolve(process.env.BROWSER_QA_STATE || '');
const root = process.cwd();
assert(base && ['localhost', '127.0.0.1'].includes(new URL(base).hostname));
assert(state.startsWith(path.join(root, '.wrangler', 'browser-qa-')) && state.endsWith(path.sep + 'state'));
const output = path.dirname(state);
fs.mkdirSync(output, { recursive: true });
const run = randomUUID().slice(0, 8);
const password = `BrowserQA-${randomUUID()}!`;
const q = value => `'${String(value).replaceAll("'", "''")}'`;
const copy = Object.fromEntries(['en','th'].map(lang => [lang, JSON.parse(fs.readFileSync(`src/locales/${lang}.json`, 'utf8'))]));
const checks = [];
const screenshots = [];
const localSql = (sql, name) => {
  const file = path.join(output, name + '.sql'); fs.writeFileSync(file, sql);
  execFileSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'd1', 'execute', 'tear-of-god-db', '--local', '--persist-to', state, '--file', file], { cwd: root, windowsHide: true, stdio: 'pipe', timeout: 90000 });
};
async function api(route, body) {
  const response = await fetch(base + route, { method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, body: await response.json() };
}
const marker = `board-qa-${run}`;
localSql(`INSERT INTO profiles(id,username) VALUES (${q(marker)},${q(marker)});`, 'marker');
assert.equal((await api('/api/users?id=' + marker)).body.data.username, marker, 'Verify the selected isolated D1 state');
localSql("DELETE FROM rankings WHERE id LIKE 'board-qa-%'; DELETE FROM templates WHERE id LIKE 'board-qa-%'; DELETE FROM items WHERE id LIKE 'board-qa-%'; DELETE FROM profiles WHERE email LIKE 'board-qa-%@example.test';", 'previous-fixtures');
const people = [];
for (const letter of ['A', 'B']) {
  const person = { email: `board-qa-${run}-${letter}@example.test`, username: `Board QA ${letter}` };
  assert.equal((await api('/api/auth', { action: 'register', ...person, password })).status, 201);
  const login = await api('/api/auth', { action: 'login', email: person.email, password });
  assert.equal(login.status, 200); people.push({ ...person, id: login.body.data.id });
}
const tiers = [{ label: 'S', color: '#ff7f7f' }, { label: 'แนะนำสำหรับเด็กมหาลัย', color: 'bg-[#ffbf7f]' }, { label: 'B', color: '#ffff7f' }, { label: 'ว่าง', color: '#7fff7f' }];
const fixtures = [];
const sql = people.map(person => `UPDATE profiles SET avatar_url=NULL WHERE id=${q(person.id)};`);
for (const [index, count] of [13,12,21,6,0,null,500,100,2,3,4,5,1].entries()) {
  const id = `${marker}-topic-${index}`;
  const post = `${marker}-post-${index}`;
  fixtures.push({ id, post, count });
  const small = `${[9,10].includes(index) ? ' SmallPair' : ''}${[10,11,12].includes(index) ? ' SmallTrio' : ''}`;
  sql.push(`INSERT INTO templates(id,title,creator_id,description,hashtags,tiers,created_at) VALUES (${q(id)},${q(`Board QA ${index} หัวข้อมหาลัย${small}`)},${q(people[0].id)},'Topic description','#BoardQA,#มหาลัย',${q(JSON.stringify(tiers))},datetime('now','-${index} minutes'));`);
  if (count !== null) sql.push(`INSERT INTO rankings(id,title,user_id,template_id,description,hashtags,created_at,last_activity_at) VALUES (${q(post)},${q(`อันดับ ${index} Full board`)},${q(people[1].id)},${q(id)},'ความเห็นจากคนโพสต์ล่าสุด','#BoardQA,#มหาลัย',datetime('now','-${index} minutes'),CURRENT_TIMESTAMP),(${q(`${post}-old`)},'Old opinion',${q(people[0].id)},${q(id)},'Old description','#BoardQA',datetime('now','-1 day'),datetime('now','-1 day'));`);
  if (count !== null) for (const [person, ranking] of [[people[0],`${post}-old`],[people[1],post]]) {
    sql.push(`INSERT INTO template_user_contributions(template_id,user_id,current_ranking_id,cooldown_until,last_contributed_at) VALUES (${q(id)},${q(person.id)},${q(ranking)},datetime('now','-1 day'),CURRENT_TIMESTAMP);`);
  }
  for (let item = 0; item < (count ?? 13); item++) {
    const itemId = `${id}-item-${item}`;
    const name = item === 0 ? 'ชื่อรายการภาษาไทยยาวที่ต้องเห็นครบทุกตัวอักษรโดยไม่ต้องกดเปิดดู' : `รายการ ${item} Item ${item}`;
    // A local existing image and a deliberately broken image exercise captions/fallback.
    const image = item === 0 ? '/favicon.svg' : item === 1 ? '/broken-qa-image.png' : null;
    sql.push(`INSERT INTO items(id,name,image_url) VALUES (${q(itemId)},${q(name)},${q(image)});`);
    sql.push(`INSERT INTO template_items(id,template_id,item_id,tier,position) VALUES (${q(itemId)},${q(id)},${q(itemId)},NULL,${item});`);
    if (count !== null) sql.push(`INSERT INTO ranking_items(id,ranking_id,item_id,tier,position) VALUES (${q(itemId)},${q(post)},${q(itemId)},${q(tiers[item % 3].label)},${item});`);
    if (count !== null && item < count - 1) for (const [ranking, tierIndex] of [[post,item % 3],[`${post}-old`,2-item % 3]]) {
      sql.push(`INSERT INTO ranking_item_scores(id,ranking_id,template_id,item_id,tier_index,score) VALUES (${q(`${ranking}-score-${item}`)},${q(ranking)},${q(id)},${q(itemId)},${tierIndex},${4-tierIndex});`);
    }
  }
}
localSql(sql.join('\n'), 'fixtures');
let browser, otherBrowser, page, other;
const seen = [];
const cards = `document.querySelectorAll('.discover-ranking-card[data-topic-id]').length`;
const panels = `document.querySelectorAll('.squeeze-panel').length`;
async function spa(page, route) { await page.evaluate(`history.pushState({},'',${JSON.stringify(route)});dispatchEvent(new PopStateEvent('popstate'));`); }
async function settled(page) {
  // Device resize is asynchronous: let ResizeObserver and React commit geometry
  // before checking the CSS animations (otherwise a swipe starts offscreen).
  await page.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
  await page.until(`!!document.querySelector('.squeeze-track') && !document.querySelector('.squeeze-track').getAnimations().length && [...document.querySelectorAll('.squeeze-panel')].every(e=>!e.getAnimations().length)`, 'Carousel transition settled');
}
async function ready(page, count = 9) {
  await page.until(`${panels}===${count} && ${cards}===1 && !document.querySelector('.discover-board-grid[aria-busy=true]')`, 'Full boards loaded', 20000);
  await settled(page);
}
async function key(page, key, code = key, windowsVirtualKeyCode = 0) {
  const text = key === 'Enter' ? '\r' : key === ' ' ? ' ' : undefined;
  await page.send('Input.dispatchKeyEvent', {type:'keyDown',key,code,windowsVirtualKeyCode,...(text ? {text} : {})});
  await page.send('Input.dispatchKeyEvent', {type:'keyUp',key,code,windowsVirtualKeyCode});
}
async function first(page) { await page.evaluate("document.querySelector('.squeeze-viewport').focus({preventScroll:true})"); await key(page,'Home','Home',36); await settled(page); }
async function cardClick(page, expression) {
  await page.evaluate(`(${expression}).scrollIntoView({block:'center',behavior:'instant'})`);
  // Only visible lazy images can reflow the click target now. A 500-item board
  // intentionally leaves offscreen images unloaded until their rows are visible.
  await page.until(`(() => {const article=(${expression}).closest('article'),clip=article.querySelector('.discover-board-reading').getBoundingClientRect();return [...article.querySelectorAll('img')].filter(e=>{const r=e.getBoundingClientRect();return r.bottom>Math.max(0,clip.top)&&r.top<Math.min(innerHeight,clip.bottom)}).every(e=>e.complete);})()`, 'Visible card image fallbacks settled');
  await delay(250);
  await page.click(expression);
}
async function login(page, person) {
  await page.goto(base + '/login'); await page.until(`!!document.querySelector('#login-email')`, 'Login form');
  await page.field('#login-email', person.email); await page.field('#login-password', password);
  await page.click(`document.querySelector('#login-email').closest('form').querySelector('button[type=submit]')`);
  await page.until(`location.pathname!=='/login'`, 'Login completed');
  await page.until(`!!document.querySelector('button[aria-label="Notifications"]')`, 'Authenticated navigation');
}
try {
  browser = await chromium({ port: 9349 }); page = await browser.page();
  page.on('Network.requestWillBeSent', ({ request }) => { if (request.url.startsWith(base + '/api/')) seen.push(request.url); });
  await page.viewport(1440); await login(page, people[0]); await spa(page, '/discover'); await ready(page);
  const topicOrder = await page.evaluate(`[...document.querySelectorAll('.squeeze-panel')].map(e=>e.dataset.squeezeId).filter(id=>id!=='discover:all')`);
  const data = [];
  for (let index = 0; index < topicOrder.length; index++) {
    const board = await page.evaluate(`(() => {const e=document.querySelector('.discover-ranking-card[data-topic-id]');return {topic:e.dataset.topicId,kind:e.dataset.boardKind,heading:e.querySelector('.discover-board-community').textContent,profiles:e.querySelectorAll('a[href^="/profile/"]').length,items:e.querySelectorAll('[data-board-item]').length,tiers:[...e.querySelectorAll('[data-tier]')].map(t=>t.dataset.tier),placements:[...e.querySelectorAll('[data-tier]')].map(t=>t.querySelectorAll('[data-board-item]').length),href:e.querySelector('.discover-board-comment')?.getAttribute('href'),height:e.getBoundingClientRect().height,previewHeights:[...document.querySelectorAll('.squeeze-choice')].map(p=>p.getBoundingClientRect().height)};})()`);
    assert.equal(board.topic, topicOrder[index]); data.push(board);
    assert.equal(board.height,600, 'Short and long boards share the collapsed height');
    assert(board.previewHeights.every(height=>Math.abs(height-602)<1), 'Previews match the selected panel including its border');
    if (index < topicOrder.length - 1) { await page.click("document.querySelector('[data-squeeze-next]')"); await settled(page); }
  }
  for (const board of data) {
    const fixture = fixtures.find(f => f.id === board.topic);
    assert.equal(board.items, fixture.count); assert.equal(board.kind, 'community'); assert.equal(board.profiles, 0);
    assert(board.heading.includes(copy.en.discover.boards.community));
    assert.deepEqual(board.placements, [0,Math.max(0,fixture.count-1),0,0], 'Two differing personal rankings combine into the middle tier');
    assert.deepEqual(board.tiers, tiers.map(t => t.label)); assert.equal(board.href, `/template/${fixture.id}/community#comments`);
  }
  checks.push('Every topic combines two personal rankings with no author identity, retains every item/custom tier and uses equal collapsed heights');
  assert(await page.evaluate(`[...document.querySelectorAll('.discover-squeeze-preview-caption span')].every(e=>e.textContent===${JSON.stringify(copy.en.discover.boards.community)})`));
  const snapshot = (await api('/api/discover-boards?ids=' + fixtures[0].id)).body.data[0];
  const detail = (await api('/api/templates?id=' + fixtures[0].id)).body.data;
  assert.deepEqual(snapshot.community_average, detail.community_average);
  assert.equal(snapshot.participant_count, 2);
  checks.push('Discover aggregate equals the real Community detail API; neighbour captions use Community rankings');
  await page.click("document.querySelector('[data-squeeze-next]')"); await settled(page);
  assert(await page.evaluate("!!document.querySelector('[data-squeeze-end]') && !document.querySelector('[data-topic-id]')"));
  assert.equal(await page.evaluate("document.querySelector('.discover-squeeze-all-link').getAttribute('href')"), '/discover/templates?sort=popular');
  assert(await page.evaluate("document.querySelector('[data-squeeze-next]').disabled"));
  checks.push('Final browse slide offers View all with the Popular catalog destination');
  await first(page);
  const full = seen.filter(url => new URL(url).pathname === '/api/discover-boards'); assert.equal(full.length, 1);
  assert(!seen.some(url => ['/api/comments','/api/template-comments'].includes(new URL(url).pathname)));
  await delay(11000);
  assert.equal(seen.filter(url => new URL(url).pathname === '/api/discover-boards').length, 1, 'No board polling after cache expiry');
  assert(!seen.some(url => new URL(url).pathname === '/api/comments'), 'No per-board comment polling');
  checks.push('One bulk board request, no per-board comment reads or polling');
  for (const theme of ['light','dark']) for (const language of ['en','th']) {
    await page.evaluate(`localStorage.setItem('tog-lang',${JSON.stringify(language)})`);
    await page.evaluate(`localStorage.setItem('tog-theme',${JSON.stringify(theme)})`);
    await page.goto(base + '/discover'); await ready(page); await page.until(`document.documentElement.lang===${JSON.stringify(language)}`, 'Language');
    await page.until(`document.documentElement.classList.contains(${JSON.stringify(theme)})`, 'Theme');
    for (const width of [320,360,390,768,1024,1440]) {
      await page.viewport(width, 1000); await delay(100); await settled(page);
      const geometry = await page.evaluate(`(() => { const viewport=document.querySelector('.squeeze-viewport'),panel=document.querySelector('.squeeze-panel.is-selected');return {width:innerWidth,body:document.documentElement.scrollWidth,viewport:viewport.clientWidth,active:panel.getBoundingClientRect().width,left:panel.getBoundingClientRect().left-viewport.getBoundingClientRect().left,overflow:[...document.querySelectorAll('.discover-ranking-card,.discover-board-lane,.discover-board-label,.discover-board-item')].filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>e.className),clamped:[...document.querySelectorAll('.discover-board-item span')].some(e=>getComputedStyle(e).webkitLineClamp!=='none'),smallText:[...document.querySelectorAll('.discover-ranking-card span,.discover-ranking-card p')].some(e=>parseFloat(getComputedStyle(e).fontSize)<11),smallControls:[...document.querySelectorAll('.discover-board-tools button,.discover-board-footer a,.discover-board-footer button,.squeeze-controls button')].some(e=>{const r=e.getBoundingClientRect();return r.width<44 || r.height<44}),scrollers:[...document.querySelectorAll('.discover-board-content,.discover-board-lane')].some(e=>['auto','scroll'].includes(getComputedStyle(e).overflowY))};})()`);
      assert(geometry.body <= width+1, JSON.stringify(geometry)); assert(Math.abs(geometry.left)<1, JSON.stringify(geometry));
      if (width < 1024) assert(Math.abs(geometry.active-geometry.viewport)<1, 'Phone/tablet gets full-width board');
      else assert(geometry.active < geometry.viewport && geometry.active > geometry.viewport/2, 'Desktop board expands beside narrow neighbours');
      assert.deepEqual(geometry.overflow, []); assert.equal(geometry.clamped, true, 'Home-style tile captions use three lines');
      const boxes = await page.evaluate("[...document.querySelectorAll('.discover-board-item,.discover-squeeze-mini-item')].map(e=>{const r=e.getBoundingClientRect();return {width:r.width,height:r.height}})");
      assert(boxes.every(box=>Math.abs(box.width-(width<640?72:80))<1&&Math.abs(box.width-box.height)<1), 'Main board and previews use equal square tiles');
      assert.equal(geometry.smallText, false); assert.equal(geometry.smallControls, false); assert.equal(geometry.scrollers, false);
      const fixed = await page.evaluate("(() => {const card=document.querySelector('.discover-ranking-card'),reading=card.querySelector('.discover-board-reading');return {height:card.offsetHeight,footerVisible:card.querySelector('footer').getBoundingClientRect().top>=reading.getBoundingClientRect().bottom,smallExpand:[...card.querySelectorAll('.discover-board-expand')].some(e=>e.offsetHeight<44||e.offsetWidth<44),scroller:['auto','scroll'].includes(getComputedStyle(reading).overflowY)};})()");
      assert.equal(fixed.height,600); assert.equal(fixed.footerVisible,true); assert.equal(fixed.smallExpand,false); assert.equal(fixed.scroller,false);
      if ([390,1440].includes(width)) {
        await page.evaluate("document.querySelector('.squeeze-toolbar').scrollIntoView({block:'start',behavior:'instant'});scrollBy(0,-88)");
        await delay(200);
        const filename = `discover-squeeze-${theme}-${language}-${width}.png`;
        await page.screenshot(path.join(output, filename)); screenshots.push(filename);
      }
      checks.push(`${theme} ${language} ${width}px: Home-style square tiles, uniform height, visible actions, 44px controls, no horizontal overflow`);
    }
  }
  await page.evaluate(`localStorage.setItem('tog-lang','en');localStorage.setItem('tog-theme','light')`); await page.goto(base + '/discover'); await ready(page);
  const card = `document.querySelector('[data-topic-id="${fixtures[0].id}"]')`;
  await page.evaluate(`${card}.scrollIntoView({block:'center',behavior:'instant'})`);
  await page.until(`([...${card}.querySelectorAll('img')]).every(e=>e.complete)`, 'Images settled before hover');
  await delay(200);
  const beforeHover = await page.evaluate(`(() => { const r=${card}.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};})()`);
  await page.send('Input.dispatchMouseEvent', { type:'mouseMoved', x:beforeHover.x+8, y:beforeHover.y+8 }); await delay(200);
  const afterHover = await page.evaluate(`(() => { const r=${card}.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};})()`);
  assert.deepEqual(afterHover,beforeHover,'Hover preserves card geometry');
  await page.send('Input.dispatchKeyEvent', { type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9 });
  await page.evaluate(`${card}.querySelector('.play-button').focus({preventScroll:true})`);
  assert(await page.evaluate(`parseFloat(getComputedStyle(document.activeElement).outlineWidth)>=2`),'Keyboard focus remains visible');
  await page.send('Emulation.setEmulatedMedia', { features:[{ name:'prefers-reduced-motion',value:'reduce' }] });
  // The shared reduced-motion rule uses 0.01ms to preserve transition events.
  assert(await page.evaluate(`([...document.querySelectorAll('.discover-ranking-card,.discover-ranking-card button,.discover-ranking-card a')]).every(e=>getComputedStyle(e).transitionDuration.split(',').every(t=>parseFloat(t)<=0.00001))`),'Reduced motion uses the shared near-zero duration');
  assert(await page.evaluate(`([...document.querySelectorAll('.squeeze-track,.squeeze-panel')]).every(e=>getComputedStyle(e).transitionDuration.split(',').every(t=>parseFloat(t)<=0.00001))`), 'Carousel respects reduced motion');
  await page.send('Emulation.setEmulatedMedia', { features:[] });
  checks.push('Stable card geometry, keyboard focus and shared reduced motion');
  const longName = await page.evaluate(`${card}.querySelector('[data-board-item]').getAttribute('aria-label')`);
  const detailRequests = seen.filter(url=>new URL(url).pathname==='/api/discover-boards').length;
  await cardClick(page,`${card}.querySelector('[data-board-item]')`);
  await page.until(`!!document.querySelector('[role=dialog] p') && document.querySelector('[role=dialog] p').textContent===${JSON.stringify(longName)}`,'Click tile for full item name');
  await key(page,'Escape','Escape',27); await page.until("!document.querySelector('[role=dialog]')",'Item details closed');
  assert(await page.evaluate("document.activeElement.matches('[data-board-item]')"),'Details restore tile focus');
  await key(page,'Enter','Enter',13); await page.until("!!document.querySelector('[role=dialog]')",'Keyboard opens item details');
  await key(page,'Escape','Escape',27); await page.until("!document.querySelector('[role=dialog]')",'Keyboard closes item details');
  await key(page,' ','Space',32); await page.until("!!document.querySelector('[role=dialog]')",'Space opens item details');
  await key(page,'Escape','Escape',27); await page.until("!document.querySelector('[role=dialog]')",'Space details closed');
  assert.equal(seen.filter(url=>new URL(url).pathname==='/api/discover-boards').length,detailRequests);
  checks.push('Square tile click and keyboard show full long names, restore focus, and use no additional API requests');
  await page.evaluate("document.querySelector('.squeeze-viewport').focus({preventScroll:true})");
  await key(page,'ArrowRight','ArrowRight',39); await settled(page);
  assert.equal(await page.evaluate("document.querySelector('[data-topic-id]').dataset.topicId"), topicOrder[1]);
  await key(page,'ArrowLeft','ArrowLeft',37); await settled(page);
  assert.equal(await page.evaluate("document.querySelector('[data-topic-id]').dataset.topicId"), topicOrder[0]);
  await key(page,'End','End',35); await settled(page);
  assert(await page.evaluate("!!document.querySelector('[data-squeeze-end]')"));
  assert(await page.evaluate("document.querySelector('[data-squeeze-next]').disabled"));
  await first(page);
  for (let press=0;press<5;press++) await page.click("document.querySelector('[data-squeeze-next]')");
  await settled(page);
  assert.equal(await page.evaluate("document.querySelector('[data-topic-id]').dataset.topicId"), topicOrder[5], 'Rapid input is applied before animations finish');
  await first(page);
  await page.click("document.querySelectorAll('[data-squeeze-choice]')[1]"); await settled(page);
  assert.equal(await page.evaluate("document.querySelector('[data-topic-id]').dataset.topicId"), topicOrder[2], 'Click a narrow preview to expand it');
  assert(await page.evaluate("document.activeElement===document.querySelector('.squeeze-viewport')"), 'Selection keeps keyboard navigation in the carousel');
  await first(page);
  const nextPanel = await page.evaluate("(() => { const r=document.querySelectorAll('.squeeze-panel')[1].getBoundingClientRect();return {width:r.width,x:r.x+20,y:r.y+20}; })()");
  await page.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:nextPanel.x,y:nextPanel.y}); await settled(page);
  assert(await page.evaluate(`document.querySelectorAll('.squeeze-panel')[1].getBoundingClientRect().width>${nextPanel.width}`),'Hovered neighbour expands');
  await page.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:5,y:5}); await settled(page);
  checks.push('Arrows, keyboard Home/End, rapid input, preview selection and hover squeeze');
  await page.viewport(390,1000); await settled(page);
  await page.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
  await page.evaluate("document.querySelector('.discover-board-content').scrollIntoView({block:'center',behavior:'instant'})");
  await page.until("[...document.querySelector('.discover-ranking-card').querySelectorAll('img')].every(e=>e.complete)",'Images settled before touch coordinates');
  await delay(200);
  const swipe = await page.evaluate("(() => { const r=document.querySelector('.discover-board-content').getBoundingClientRect();return {start:r.right-25,end:r.left+25,y:Math.max(100,r.top+25)}; })()");
  async function touch(from, to, y = swipe.y) {
    await page.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:from,y}]});
    for (let step=1;step<=5;step++) { await page.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:from+(to-from)*step/5,y}]}); await delay(20); }
    await page.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); await settled(page);
  }
  const tileTouch = await page.evaluate("(() => {const r=document.querySelector('[data-board-item]').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()");
  await page.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[tileTouch]});
  await page.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.until("!!document.querySelector('[role=dialog]')",'Mobile tile tap opens details');
  await key(page,'Escape','Escape',27); await page.until("!document.querySelector('[role=dialog]')",'Mobile details closed');
  await touch(tileTouch.x,Math.max(10,tileTouch.x-90),tileTouch.y);
  assert.equal(await page.evaluate("document.querySelector('[data-topic-id]').dataset.topicId"),topicOrder[1],'Swiping directly from an item button changes the topic');
  assert(await page.evaluate("!document.querySelector('[role=dialog]')"),'Swiping does not accidentally open details');
  await first(page);
  await touch(swipe.start,swipe.end);
  assert.equal(await page.evaluate("document.querySelector('[data-topic-id]').dataset.topicId"), topicOrder[1], 'Touch swipe selects next board');
  await touch(swipe.end,swipe.start);
  assert.equal(await page.evaluate("document.querySelector('[data-topic-id]').dataset.topicId"), topicOrder[0], 'Reverse touch swipe selects previous board');
  // Fixed-height cards make the page shorter; leave room to scroll before
  // verifying a vertical gesture instead of starting at the page's bottom.
  await page.evaluate('scrollBy(0,-220)'); await delay(100);
  const vertical = await page.evaluate("(() => {const r=document.querySelector('.discover-full-tier').getBoundingClientRect();return {x:r.left+70,y:Math.min(innerHeight-100,r.top+120),scroll:scrollY};})()");
  await page.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:vertical.x,y:vertical.y}]});
  for(let step=1;step<=5;step++){await page.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:vertical.x,y:vertical.y-step*35}]});await delay(20);}
  await page.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); await delay(200);
  assert.equal(await page.evaluate("document.querySelector('[data-topic-id]').dataset.topicId"), topicOrder[0], 'Vertical scrolling does not change topics');
  assert(await page.evaluate(`scrollY>${vertical.scroll}`),'Vertical scrolling remains available');
  await page.send('Emulation.setTouchEmulationEnabled',{enabled:false}); await page.viewport(1440,1000); await settled(page);
  checks.push('Real Chromium touch events: swipe in both directions and preserve vertical scrolling');
  await cardClick(page, `${card}.querySelector('.play-button')`);
  await page.until(`location.pathname==='/rank' && new URLSearchParams(location.search).get('template')===${JSON.stringify(fixtures[0].id)}`, 'Rank the same topic');
  await spa(page,'/discover'); await ready(page);
  checks.push('Rank action opens the original topic');
  await cardClick(page, `${card}.querySelector('button[aria-label=${JSON.stringify(copy.en.discover.save)}]')`);
  await page.until(`!!${card}.querySelector('button[aria-pressed=true]')`, 'Saved by first viewer');
  await spa(page, '/discover?view=saved'); await ready(page, 1);
  assert.equal(await page.evaluate(`document.querySelector('[data-topic-id]').dataset.topicId`), fixtures[0].id);
  await cardClick(page, `${card}.querySelector('.discover-board-share')`);
  await page.until(`!![...document.querySelectorAll('[role=dialog] input')].find(input=>input.value===${JSON.stringify(`${base}/template/${fixtures[0].id}/community`)})`, 'Share URL belongs to community board');
  await page.send('Input.dispatchKeyEvent', { type:'keyDown', key:'Escape', code:'Escape', windowsVirtualKeyCode:27 });
  await page.until(`!document.querySelector('[role=dialog]')`, 'Share dialog closed');
  checks.push('Share opens the topic Community ranking URL');
  otherBrowser = await chromium({ port: 9350 }); other = await otherBrowser.page(); await other.viewport(1440); await login(other, people[1]);
  await spa(other, '/discover?view=saved'); await other.until(`!!document.querySelector('.personality-empty')`, 'Second viewer has no saved topics');
  await spa(other, '/discover'); await ready(other);
  assert.equal(await other.evaluate(`${card}.querySelector('button[aria-label=${JSON.stringify(copy.en.discover.save)}]').getAttribute('aria-pressed')`), 'false');
  await cardClick(other, `${card}.querySelector('.discover-board-comment')`);
  await other.until(`location.hash==='#comments' && !!document.querySelector('#comments textarea') && document.activeElement===document.querySelector('#comments textarea')`, 'Comment link focuses after community loads');
  const commentView = await other.evaluate(`(() => { const section=document.querySelector('#comments').getBoundingClientRect(); const input=document.querySelector('#comments textarea').getBoundingClientRect(); return {sectionTop:section.top,inputTop:input.top,inputBottom:input.bottom,height:innerHeight}; })()`);
  assert(commentView.sectionTop >= 0 && commentView.inputTop >= 0 && commentView.inputBottom <= commentView.height, `Comment form fully visible: ${JSON.stringify(commentView)}`);
  assert.equal(await other.evaluate('location.pathname'), `/template/${fixtures[0].id}/community`);
  checks.push('Real two-account bookmarks isolated, correct community comments, scrolling and focus');
  for (const fixture of [fixtures[0],fixtures[1],fixtures[4],fixtures[5],fixtures[6],fixtures[7]]) {
    await spa(page, `/discover?q=${encodeURIComponent(`Board QA ${fixtures.indexOf(fixture)} หัวข้อมหาลัย`)}`); await ready(page, 1);
    assert.equal(await page.evaluate(`document.querySelectorAll('[data-board-item]').length`), fixture.count ?? 13);
    if (fixture.count === null) {
      assert(await page.evaluate(`document.querySelector('.discover-board-pool h3').textContent===${JSON.stringify(copy.en.discover.boards.noRanking)}`));
      assert.equal(await page.evaluate(`document.querySelectorAll('[data-tier]').length`), 0);
    }
    for (const width of [320,390,1440]) {
      await page.viewport(width,1000); await settled(page);
      const needsExpand = await page.evaluate("(() => { const card=document.querySelector('article.discover-ranking-card');return card.querySelector('.discover-board-reading-content').scrollHeight>card.querySelector('.discover-board-reading').clientHeight+1; })()");
      assert.equal(await page.evaluate("!!document.querySelector('.discover-board-expand')"), needsExpand, 'Expand is offered only when content exceeds the collapsed budget');
      const requests = seen.filter(url=>new URL(url).pathname==='/api/discover-boards').length;
      if(fixture.count===500&&width===320) {
        await key(page,'Tab','Tab',9);
        await page.evaluate("[...document.querySelectorAll('[data-board-item]')].at(-1).focus({preventScroll:true})");
        await page.until("document.querySelector('.discover-ranking-card').classList.contains('is-expanded')",'Keyboard focus reveals clipped item');
        await page.until("(() => {const r=document.activeElement.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;})()",'Focused item is visible');
        await cardClick(page,"document.querySelector('.discover-board-expand')"); await settled(page);
      }
      if (needsExpand) {
        await cardClick(page,"document.querySelector('.discover-board-expand')"); await settled(page);
        assert(await page.evaluate("document.querySelector('.discover-board-expand').getAttribute('aria-expanded')==='true'"));
      }
      const bounds = await page.evaluate(`(() => { const card=document.querySelector('article.discover-ranking-card'),reading=card.querySelector('.discover-board-reading'),box=reading.getBoundingClientRect();return {items:card.querySelectorAll('[data-board-item]').length,clipped:[...card.querySelectorAll('[data-board-item],.discover-full-tier')].filter(e=>{const r=e.getBoundingClientRect();return r.top<box.top-1||r.bottom>box.bottom+1||r.left<box.left-1||r.right>box.right+1}).length,horizontal:document.documentElement.scrollWidth>innerWidth+1,mask:getComputedStyle(reading).maskImage}; })()`);
      assert.equal(bounds.items,fixture.count??13); assert.equal(bounds.clipped,0, 'Every item and tier is visible after expansion');
      assert.equal(bounds.horizontal,false); assert.equal(bounds.mask,'none');
      if(needsExpand) {
        const activeHeight = await page.evaluate("document.querySelector('.squeeze-panel.is-selected').offsetHeight");
        assert(await page.evaluate(`[...document.querySelectorAll('.squeeze-choice')].every(e=>Math.abs(e.offsetHeight-${activeHeight})<1)`));
        await cardClick(page,"document.querySelector('.discover-board-expand')"); await settled(page);
        assert.equal(await page.evaluate("document.querySelector('.discover-ranking-card').offsetHeight"),600);
      }
      assert.equal(seen.filter(url=>new URL(url).pathname==='/api/discover-boards').length,requests,'Expand and collapse use existing data without requests');
    }
  }
  checks.push('0/12/13/100/500 items and unposted pool at 320/390/1440px: full expansion, conditional button, collapse to 600px, no additional requests');
  for(const [query,count] of [['SmallPair',2],['SmallTrio',3]]) {
    await spa(page, `/discover?q=${query}`); await ready(page,count);
    const ids = await page.evaluate("[...document.querySelectorAll('.squeeze-panel')].map(e=>e.dataset.squeezeId)");
    assert.equal(new Set(ids).size,count,'Small carousels never duplicate topics');
    await page.evaluate("document.querySelector('.squeeze-viewport').focus({preventScroll:true})"); await key(page,'End','End',35); await settled(page);
    assert.equal(await page.evaluate("document.querySelector('[data-topic-id]').dataset.topicId"), ids.at(-1));
    assert(await page.evaluate("document.querySelector('[data-squeeze-next]').disabled"));
  }
  await spa(page,'/discover?q=NoMatchingSqueezeTopic'); await page.until("!!document.querySelector('.pulse-empty') && !document.querySelector('.squeeze-carousel')",'Empty search without a carousel');
  checks.push('Zero, one, two and three topic lists, without duplicates or invalid navigation');
  await spa(page, '/discover?q=Board%20QA'); await ready(page, 12);
  await page.click(`[...document.querySelectorAll('button')].find(e=>e.textContent.trim()==='Next')`); await ready(page, 1);
  assert.equal(await page.evaluate(`new URLSearchParams(location.search).get('page')`), '2');
  checks.push('Search pagination preserves 12 results per page');

  const plans = [];
  page.on('Fetch.requestPaused', async event => {
    const plan = plans.find(p => !p.used && p.match(new URL(event.request.url)));
    if (plan) { plan.used = true; if (plan.held) await plan.held; }
    try {
      if (plan?.status) await page.send('Fetch.fulfillRequest', { requestId: event.requestId, responseCode: plan.status, responseHeaders:[{name:'Content-Type',value:'application/json'}], body:Buffer.from(JSON.stringify({success:false,error:'QA board outage'})).toString('base64') });
      else await page.send('Fetch.continueRequest', { requestId: event.requestId });
    } catch (e) { if (!/Invalid.*requestId|Invalid InterceptionId/.test(e.message)) throw e; }
  });
  await page.send('Fetch.enable', { patterns:[{ urlPattern:base+'/api/discover-boards*', requestStage:'Request' }] });
  const failed = { match: () => true, status:503 }; plans.push(failed);
  await spa(page, '/discover'); await page.until(`!!document.querySelector('.discover-inline-error')`, 'Board outage shown');
  await page.click(`document.querySelector('.discover-inline-error button')`); await ready(page);
  checks.push('Board failure and retry');
  let release; const slow = { match:() => true, held:new Promise(resolve => { release=resolve; }) }; plans.push(slow);
  await spa(page, '/discover?tab=new'); await page.until(`${cards}===0 && !!document.querySelector('[aria-busy=true]')`, 'Board skeleton while loading');
  for (let i=0;i<100 && !slow.used;i++) await delay(50); assert(slow.used);
  await spa(page, '/discover?tab=popular'); await ready(page); const previous = await page.evaluate(`[...document.querySelectorAll('[data-topic-id]')].map(e=>e.dataset.topicId)`);
  release(); await delay(300); assert.deepEqual(await page.evaluate(`[...document.querySelectorAll('[data-topic-id]')].map(e=>e.dataset.topicId)`), previous);
  checks.push('Switching tabs during board loading never restores stale results');
  await page.send('Fetch.disable');
  // A rerun replaces synthetic topics; don't reuse a previous run's Pulse IDs.
  await page.send('Network.setExtraHTTPHeaders', { headers:{'Cache-Control':'no-cache'} });
  await spa(page, '/discover?tab=active&window=today'); await page.until(`!!document.querySelector('.discover-period select') && ${cards}>0 && !document.querySelector('.discover-board-grid[aria-busy=true]')`, 'Active boards loaded');
  await page.send('Network.setExtraHTTPHeaders', { headers:{} });
  assert(await page.evaluate(cards) > 0); checks.push('Active topics use full boards');
  await page.evaluate("document.querySelector('.squeeze-viewport').focus({preventScroll:true})"); await key(page,'End','End',35); await settled(page);
  assert.equal(await page.evaluate("document.querySelector('.discover-squeeze-all-link').getAttribute('href')"),'/discover/templates?sort=recent');
  await page.click("document.querySelector('.discover-squeeze-all-link')");
  await page.until("location.pathname==='/discover/templates' && new URLSearchParams(location.search).get('sort')==='recent' && document.querySelectorAll('.discover-topic-card').length>0",'View all opens the catalog');
  checks.push('View all from the Active end slide opens the Recent catalog');
  await spa(page, '/discover/templates'); await page.until(`document.querySelectorAll('.discover-topic-card').length>0`, 'Catalog retained');
  assert.equal(await page.evaluate(`document.querySelectorAll('.discover-ranking-card').length`),0);
  await spa(page, `/profile/${people[1].id}`); await page.until(`document.querySelectorAll('.profile-ranking-tile').length>0`, 'Profile retained');
  assert.equal(await page.evaluate(`document.querySelectorAll('.discover-ranking-card').length`),0);
  assert.deepEqual(page.errors, []); assert.deepEqual(other.errors, []);
  checks.push('Catalog and Profile keep existing cards; no browser runtime exceptions');
  fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({checks,screenshots,limitations:['Chromium emulation, not physical devices or Safari/Firefox']},null,2));
  console.log(`${checks.length} browser checks passed; screenshots in ${output}`);
} catch (error) {
  if (page) { await page.screenshot(path.join(output,'failure.png')).catch(()=>{}); fs.writeFileSync(path.join(output,'failure-dom.txt'),await page.evaluate('document.body.innerText').catch(()=>'')); }
  if (other) { await other.screenshot(path.join(output,'failure-other.png')).catch(()=>{}); fs.writeFileSync(path.join(output,'failure-other-dom.txt'),await other.evaluate('document.body.innerText').catch(()=>'')); }
  throw error;
} finally { if (otherBrowser) await otherBrowser.close(); if (browser) await browser.close(); }
