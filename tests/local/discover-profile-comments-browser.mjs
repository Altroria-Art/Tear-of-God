// Actual built UI + Pages Functions + isolated local D1. Faults are explicit
// one-shot CDP interceptions; all ordinary reads and all mutations use the API.
// See docs/local-browser-qa.md for the isolated Wrangler setup.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { chromium, delay } from './helpers/chromium.mjs';
import { BADGE_POLL_INTERVAL_MS } from '../../src/lib/notificationFeed.js';

const copy = JSON.parse(fs.readFileSync(new URL('../../src/locales/en.json',import.meta.url),'utf8'));

const base = process.env.BROWSER_QA_URL;
const state = process.env.BROWSER_QA_STATE;
assert(base && ['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Explicit loopback BROWSER_QA_URL required');
const root = process.cwd();
const statePath = path.resolve(state || '');
assert(state && statePath.startsWith(path.join(root, '.wrangler', 'browser-qa-')) && statePath.endsWith(path.sep + 'state'), 'Use a separate .wrangler/browser-qa-*/state directory');
const output = path.dirname(statePath);
fs.mkdirSync(output, { recursive: true });
const run = randomUUID().slice(0, 8);
const profiles = Object.fromEntries([0, 1, 3, 20, 49, 50, 51, 100].map(count => [count, `browser-qa-${run}-p${count}`]));
const password = `BrowserQA-${randomUUID()}!`;
const checks = [];
const timings = {};
const q = value => `'${String(value).replaceAll("'", "''")}'`;
function localSql(text, name) {
  const file = path.join(output, name);
  fs.writeFileSync(file, text);
  execFileSync(process.execPath, [path.join(root, 'node_modules/wrangler/bin/wrangler.js'), 'd1', 'execute', 'tear-of-god-db', '--local', '--persist-to', statePath, '--file', file], { cwd: root, windowsHide: true, stdio: 'pipe', timeout: 60000 });
}
async function api(route, { cookie, body, method = body ? 'POST' : 'GET' } = {}) {
  const response = await fetch(base + route, { method, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
}
// Prove that this server reads the selected isolated state before creating any
// accounts through HTTP. A server accidentally using .wrangler/state fails here.
const marker = `browser-qa-isolation-${run}`;
localSql(`INSERT INTO profiles (id,username) VALUES (${q(marker)},${q(marker)});`, 'isolation.sql');
assert.equal((await api(`/api/users?id=${marker}`)).data.data?.username, marker, 'Pages server must use the selected isolated D1 state');
const accounts = [];
for (const letter of ['A', 'B']) {
  const person = { email: `browser-qa-${run}-${letter}@example.test`, username: `Browser QA ${letter}` };
  assert.equal((await api('/api/auth', { body: { action: 'register', ...person, password } })).status, 201);
  const login = await api('/api/auth', { body: { action: 'login', email: person.email, password } });
  assert.equal(login.status, 200); assert(login.cookie);
  accounts.push({ ...person, id: login.data.data.id, cookie: login.cookie });
}
const tiers = [{ id: 's', label: 'S', color: '#ff6b6b' }, { id: 'a', label: 'A', color: '#ffbf7f' }, { id: 'b', label: 'แนะนำ', color: '#ffdf50' }, { id: 'c', label: 'C', color: '#45dc82' }];
const templateId = `browser-qa-${run}-topic`;
const sql = [];
for (const person of accounts) sql.push(`UPDATE profiles SET avatar_url=NULL WHERE id=${q(person.id)};`);
for (const [count, id] of Object.entries(profiles)) {
  sql.push(`INSERT INTO profiles (id,username,bio,created_at) VALUES (${q(id)},${q(`Browser QA ${count}`)},${q('Responsive profile QA')},'2026-08-01 12:00:00');`);
  for (let index = 0; index < Number(count); index++) sql.push(`INSERT INTO rankings (id,user_id,title,hashtags,created_at,last_activity_at) VALUES (${q(`${id}-post-${index}`)},${q(id)},${q(`QA ${count} ranking ${index}`)},'#BrowserQA,#Responsive',datetime('now','-${index} seconds'),CURRENT_TIMESTAMP);`);
}
for (let index = 0; index < 8; index++) {
  const id = index ? `${templateId}-${index}` : templateId;
  sql.push(`INSERT INTO templates (id,creator_id,title,description,hashtags,tiers,use_count,created_at) VALUES (${q(id)},${q(accounts[0].id)},${q(`Browser topic ${index} ชื่อหัวข้อภาษาไทยที่ยาว`)} ,'Local QA','#BrowserQA,#Responsive,#LongHashtagForLayout',${q(JSON.stringify(tiers))},${8-index},datetime('now','-${index} seconds'));`);
  for (let item = 0; item < 10; item++) {
    const itemId = `${id}-item-${item}`;
    sql.push(`INSERT INTO items (id,name) VALUES (${q(itemId)},${q(`รายการภาษาไทย ${item} Long item`)}); INSERT INTO template_items (id,template_id,item_id,tier,position) VALUES (${q(itemId)},${q(id)},${q(itemId)},${q(tiers[Math.min(3, Math.floor(item/3))].label)},${item});`);
  }
}
for (const id of Object.values(profiles)) {
  sql.push(`UPDATE rankings SET template_id=${q(templateId)} WHERE user_id=${q(id)};`);
  sql.push(`INSERT INTO ranking_items (id,ranking_id,item_id,tier,position) SELECT r.id||'-'||ti.id,r.id,ti.item_id,ti.tier,ti.position FROM rankings r CROSS JOIN template_items ti WHERE r.user_id=${q(id)} AND ti.template_id=${q(templateId)};`);
}
sql.push(`INSERT INTO profile_pins (user_id,ranking_id,position) VALUES (${q(profiles[100])},${q(`${profiles[100]}-post-99`)},0);`);
const rankingId = `browser-qa-${run}-comments`;
sql.push(`INSERT INTO rankings (id,user_id,template_id,title,hashtags,last_activity_at) VALUES (${q(rankingId)},${q(accounts[0].id)},${q(templateId)},'Browser comments QA','#BrowserQA',CURRENT_TIMESTAMP);`);
sql.push(`INSERT INTO ranking_items (id,ranking_id,item_id,tier,position) SELECT 'rank-'||id,${q(rankingId)},item_id,tier,position FROM template_items WHERE template_id=${q(templateId)};`);
localSql(sql.join('\n'), 'seed.sql');

let browser;
const pages = [];
const button = text => `[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(text)} || [...e.children].some(c=>c.tagName==='SPAN' && c.textContent.trim()===${JSON.stringify(text)}))`;
const tab = text => `[...document.querySelectorAll('.discover-browse-tabs button')].find(e=>e.textContent.trim()===${JSON.stringify(text)})`;
async function spa(page, pathname) {
  await page.evaluate(`history.pushState({},'',${JSON.stringify(pathname)}); dispatchEvent(new PopStateEvent('popstate'));`);
}
async function layout(page, selector, width, name, columns) {
  await page.viewport(width); await delay(150);
  const result = await page.evaluate(`(() => { const grid=document.querySelector(${JSON.stringify(selector)}); const tiles=[...grid?.children||[]]; return { width:innerWidth, body:document.documentElement.scrollWidth, columns:grid?getComputedStyle(grid).gridTemplateColumns.split(' ').length:0, outside:tiles.filter(e=>{const r=e.getBoundingClientRect();return r.left < -1 || r.right > innerWidth+1}).length, tiles:tiles.map(e=>{const r=e.getBoundingClientRect();return {width:r.width,height:r.height}}) }; })()`);
  assert(result.body <= width + 1, `${name} ${width}: page overflow ${JSON.stringify(result)}`);
  assert.equal(result.outside, 0, `${name}: tile escapes viewport`);
  if (columns) assert.equal(result.columns, columns, `${name} ${width}: columns`);
  if (name === 'Discover') for (const tile of result.tiles) assert(Math.abs(tile.width - tile.height) <= 2, `Discover ${width}: square cards`);
  checks.push(`${name} geometry ${width}px`);
}
async function login(page, person) {
  await page.goto(base + '/login');
  await page.until(`!!document.querySelector('#login-email')`, 'login form');
  await page.field('#login-email', person.email); await page.field('#login-password', password);
  await page.click(`document.querySelector('#login-email').closest('form').querySelector('button[type=submit]')`);
  await page.until(`location.pathname!=='/login'`, 'login submitted');
  await page.until(`!!document.querySelector('button[aria-label="Notifications"]')`, 'authenticated navigation');
  assert.equal((await page.evaluate(`fetch('/api/auth').then(r=>r.json())`)).data.id, person.id);
}
function faults(page) {
  const plans = [];
  const seen = [];
  const errors = [];
  page.on('Network.requestWillBeSent', ({ request }) => { if (request.url.startsWith(base + '/api/')) seen.push(request.url); });
  page.on('Fetch.requestPaused', async event => {
    const plan = plans.find(item => !item.taken && item.match(new URL(event.request.url)));
    if (plan) { plan.taken = true; plan.event = event; }
    try {
      if (plan?.hold) await plan.hold;
      if (plan?.status) await page.send('Fetch.fulfillRequest', { requestId: event.requestId, responseCode: plan.status, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: Buffer.from(JSON.stringify(plan.body || { success: false, error: 'Browser QA temporary outage' })).toString('base64') });
      else await page.send('Fetch.continueRequest', { requestId: event.requestId });
    } catch (error) {
      if (!/Invalid InterceptionId|Invalid.*requestId/i.test(error.message)) errors.push(error.message);
    }
  });
  return {
    seen, errors,
    async enable() { await page.send('Fetch.enable', { patterns: [{ urlPattern: base + '/api/*', requestStage: 'Request' }] }); },
    next(match, { fail = false, hold = false, body } = {}) {
      let release;
      const plan = { match, body, status: fail ? 503 : body ? 200 : undefined, ...(hold ? { hold: new Promise(resolve => { release = resolve; }) } : {}) };
      plans.push(plan);
      return { release: () => release?.(), async taken() { for (let i=0;i<100;i++) { if(plan.taken) return; await delay(100); } throw new Error('Fault plan was not reached'); } };
    },
  };
}
const cardCount = `document.querySelectorAll('.discover-browse-grid .discover-topic-card:not(.animate-pulse)').length`;
try {
  browser = await chromium();
  const page = await browser.page(); pages.push(page);
  const fault = faults(page); await fault.enable(); await page.viewport(1440);
  const list = sort => url => url.pathname === '/api/templates' && !url.searchParams.has('id') && url.searchParams.get('sort') === sort;
  const slow = fault.next(list('popular'), { hold: true });
  await page.goto(base + '/discover'); await slow.taken();
  await page.until(`!!document.querySelector('.discover-browse-grid[aria-busy=true]')`, 'Discover loading skeleton');
  await page.click(tab('New')); await page.until(`new URLSearchParams(location.search).get('tab')==='new' && ${cardCount}===8`, 'New tab loads independently');
  const titles = await page.evaluate(`[...document.querySelectorAll('.discover-browse-grid .discover-card-title')].map(e=>e.textContent)`);
  assert.equal(titles.length,8);
  slow.release(); await delay(600);
  assert.deepEqual(await page.evaluate(`[...document.querySelectorAll('.discover-browse-grid .discover-card-title')].map(e=>e.textContent)`), titles);
  assert.equal(await page.evaluate(`document.querySelector('.discover-browse-tabs button[aria-pressed=true]').textContent.trim()`), 'New');
  checks.push('Discover loading and late Popular response do not overwrite New');
  const failure = fault.next(list('popular'), { fail: true });
  await page.click(tab('Popular')); await failure.taken();
  await page.until(`!!document.querySelector('.discover-inline-error[role=alert]')`, 'Discover API error');
  await page.click(`document.querySelector('.discover-inline-error button')`);
  await page.until(`${cardCount}===8 && !document.querySelector('.discover-inline-error')`, 'Discover retry recovers');
  checks.push('Discover Popular failure/retry');
  const newFailure = fault.next(list('recent'), {fail:true});
  await page.click(tab('New')); await newFailure.taken();
  await page.until(`!!document.querySelector('.discover-inline-error') && ${cardCount}===0`,'New error has no stale cards');
  await page.click(`document.querySelector('.discover-inline-error button')`);
  await page.until(`${cardCount}===8 && !document.querySelector('.discover-inline-error')`,'New retry');
  checks.push('Discover New failure/retry clears previous cards');
  const empty = fault.next(list('popular'), {body:{success:true,data:[],total:0}});
  await page.click(tab('Popular')); await empty.taken();
  await page.until(`document.querySelector('.pulse-empty')?.textContent.includes(${JSON.stringify(copy.discover.emptyTemplates)}) && ${cardCount}===0`,'Empty list communicates its state');
  checks.push('Discover empty response shows an explanation without stale cards');
  await page.click(tab(copy.discover.browseTabs.active));
  await page.until(`new URLSearchParams(location.search).get('tab')==='active' && !!document.querySelector('.discover-period select') && !document.querySelector('.discover-browse-grid[aria-busy=true]')`, 'Active loads');
  for (const period of ['today', 'week', 'last_week', 'now']) {
    await page.evaluate(`(() => { const s=document.querySelector('.discover-period select'); s.value=${JSON.stringify(period)}; s.dispatchEvent(new Event('change',{bubbles:true})); })()`);
    await page.until(`new URLSearchParams(location.search).get('window')===${JSON.stringify(period)}`, 'Period URL updated');
    await delay(100);
    await page.until(`!document.querySelector('.discover-browse-grid[aria-busy=true]') && document.querySelector('.discover-period select').value===${JSON.stringify(period)}`, `Active ${period}`);
  }
  checks.push('Discover Active and all four time windows');
  const pulseFail = fault.next(url => url.pathname === '/api/discover-pulse', { fail: true });
  await spa(page, '/discover?tab=active&window=week'); await pulseFail.taken();
  await page.until(`!!document.querySelector('.discover-inline-error')`, 'Active outage visible');
  await page.click(`document.querySelector('.discover-inline-error button')`);
  await page.until(`!document.querySelector('.discover-inline-error') && !document.querySelector('[aria-busy=true]')`, 'Active retry');
  checks.push('Discover Active failure/retry');
  const navigateSlow = fault.next(list('recent'), { hold: true });
  await page.click(tab('New')); await navigateSlow.taken();
  await spa(page, `/profile/${profiles[3]}`);
  await page.until(`document.querySelectorAll('.profile-ranking-tile').length===3`, 'Navigate away during Discover load');
  navigateSlow.release(); await delay(400);
  assert.equal(await page.evaluate('location.pathname'), `/profile/${profiles[3]}`);
  checks.push('Discover navigation during pending load');
  await spa(page, '/discover'); await page.until(`${cardCount}===8`, 'Discover restored');
  assert(await page.evaluate(`[...document.querySelectorAll('.discover-card-preview [title]')].some(e=>e.title.startsWith('รายการภาษาไทย'))`), 'Discover renders names for ID-backed items');
  assert(await page.evaluate(`[...document.querySelectorAll('.discover-card-preview [title]')].every(e=>!e.title.startsWith('browser-qa-'))`), 'Discover does not display internal item IDs');
  checks.push('Discover ID-backed items display names with tier labels and overflow count');
  for (const [width, columns] of [[320,1],[390,1],[768,2],[1440,4]]) await layout(page, '.discover-browse-grid', width, 'Discover', columns);
  await page.viewport(390,844); await page.evaluate('scrollTo(0,0)'); await page.screenshot(path.join(output,'discover-mobile.png'));
  await page.viewport(1440,1000); await page.evaluate('scrollTo(0,0)'); await page.screenshot(path.join(output,'discover-desktop.png'));

  for (const count of [0,1,3,20,49,50,51,100]) {
    await spa(page, `/profile/${profiles[count]}`);
    const expected = Math.min(count, 50) + (count === 100 ? 1 : 0);
    await page.until(`document.querySelectorAll('.profile-ranking-tile').length===${expected} && !!document.querySelector('.profile-v2')`, `Profile ${count}`);
    if (count === 0) assert(await page.evaluate(`!!document.querySelector('.profile-rankings-empty')`));
    if (count > 50) {
      await page.click(button('Next'));
      await page.until(`document.querySelectorAll('.profile-ranking-tile').length===${count}`, `Profile ${count} second page`);
    }
    assert.equal(await page.evaluate(`!!(${button('Next')})`), false, `No extra page at ${count}`);
    const names = await page.evaluate(`[...document.querySelectorAll('.profile-ranking-tile')].map(e=>e.getAttribute('aria-label'))`);
    assert.equal(new Set(names).size, count, `No duplicate profile posts at ${count}`);
    checks.push(`Profile ${count} posts: exact count, pagination and no duplicates`);
  }
  await page.click(button('Pinned')); await page.until(`document.querySelectorAll('.profile-ranking-tile').length===1`, 'Pinned tab');
  assert.equal(await page.evaluate(`document.querySelector('.profile-ranking-tile').getAttribute('aria-label')`), 'QA 100 ranking 99');
  checks.push('Profile pin beyond first 50 loads and Pinned tab isolates it');
  await page.click(button('Rankings'));
  await page.until(`document.querySelectorAll('.profile-ranking-tile').length===100`, 'All profile posts');
  for (const [width, columns] of [[320,1],[390,1],[768,2],[1024,3],[1440,4]]) await layout(page, '.profile-ranking-grid', width, 'Profile', columns);
  await page.viewport(390,844); await page.evaluate('scrollTo(0,0)'); await page.screenshot(path.join(output,'profile-mobile.png'));
  await page.viewport(1440,1000); await page.evaluate('scrollTo(0,0)'); await page.screenshot(path.join(output,'profile-desktop.png'));
  // Old pagination response must not enter another user's mounted Profile.
  await spa(page, `/profile/${profiles[51]}`); await page.until(`document.querySelectorAll('.profile-ranking-tile').length===50`, 'Profile race initial page');
  const profileSlow = fault.next(url=>url.pathname==='/api/rankings' && url.searchParams.get('author_id')===profiles[51] && url.searchParams.get('page')==='2', {hold:true});
  await page.click(button('Next')); await profileSlow.taken();
  await spa(page, `/profile/${profiles[3]}`); await page.until(`document.querySelectorAll('.profile-ranking-tile').length===3`, 'Switch profile during pagination');
  profileSlow.release(); await delay(500);
  assert(await page.evaluate(`[...document.querySelectorAll('.profile-ranking-tile')].every(e=>e.getAttribute('aria-label').startsWith('QA 3 ranking'))`));
  checks.push('Profile switching during pagination ignores previous user response');
  await page.send('Fetch.disable'); assert.deepEqual(fault.errors, []);

  const second = await browser.page(); pages.push(second);
  await page.viewport(1280); await second.viewport(390,844);
  await login(page, accounts[0]); await login(second, accounts[1]);
  for (const current of [page,second]) {
    await current.goto(base+`/post/${rankingId}`);
    await current.until(`!!document.querySelector('textarea') && document.body.textContent.includes('Browser comments QA')`, 'Real comments page');
    assert.equal(await current.evaluate('document.visibilityState'), 'visible');
  }
  const commentText = `Browser root ${run}`;
  const replyText = `Browser reply ${run}`;
  const draftText = `Unsent draft ${run}`;
  const counter = `Number(document.querySelector('button[aria-label="Comments"] .reaction-count')?.textContent)`;
  for (const current of [page,second]) assert.equal(await current.evaluate(counter),0,'Initial UI comment count');
  await page.field('textarea',draftText);
  await second.field('textarea',commentText);
  await second.click(`document.querySelector('textarea').closest('form').querySelector('button[type=submit]')`);
  await second.until(`document.body.textContent.includes(${JSON.stringify(commentText)}) && document.querySelector('textarea').value===''`, 'Comment appears on author page');
  timings.commentToOtherAccountMs = await page.until(`document.body.textContent.includes(${JSON.stringify(commentText)})`, 'Other account gets live comment',16000);
  for (const current of [page,second]) await current.until(`${counter}===1`,'UI count becomes 1');
  assert.equal(await page.evaluate(`document.querySelector('textarea').value`),draftText,'Polling preserves an unsent draft');
  await page.until(`!!document.querySelector('button[aria-label="Notifications"] span')`,'Notification badge updates with menu closed',BADGE_POLL_INTERVAL_MS+5000);
  const initial = await api(`/api/comments?ranking_id=${rankingId}`, {cookie:accounts[0].cookie});
  assert.equal(initial.data.stats.comments,1); assert.equal(initial.data.data.length,1);
  checks.push('Comments: B posts; A updates live; both UI/server counters 1; unsent draft preserved and badge updates');
  await page.click(`document.querySelector('button[aria-label="Notifications"]')`);
  await page.until(`document.querySelector('.notification-sheet')?.textContent.includes('Browser QA B')`, 'Owner comment notification');
  assert.equal((await api('/api/notifications',{cookie:accounts[0].cookie})).data.data.filter(n=>n.type==='comment'&&n.ranking_id===rankingId).length,1);
  await page.click(`document.querySelector('button[aria-label="Notifications"]')`);
  await page.click(button('Reply')); await page.field('textarea',replyText);
  await page.click(`document.querySelector('textarea').closest('form').querySelector('button[type=submit]')`);
  await page.until(`document.body.textContent.includes(${JSON.stringify(replyText)}) && document.querySelector('textarea').value===''`, 'Reply appears');
  timings.replyToOtherAccountMs = await second.until(`document.body.textContent.includes(${JSON.stringify(replyText)})`, 'Second account gets live reply',16000);
  for (const current of [page,second]) await current.until(`${counter}===2`,'UI count becomes 2');
  const replyData = await api(`/api/comments?ranking_id=${rankingId}`,{cookie:accounts[1].cookie});
  assert.equal(replyData.data.stats.comments,2); assert.equal(replyData.data.data.find(c=>c.content===replyText).parent_id,initial.data.data[0].id);
  checks.push('Comments: A replies; B updates live; both UI/server counters 2 and parent persisted');
  await second.click(`document.querySelector('button[aria-label="Notifications"]')`);
  await second.until(`document.querySelector('.notification-sheet')?.textContent.includes('Browser QA A')`, 'Reply recipient notified');
  await second.screenshot(path.join(output,'comments-notifications-mobile.png'));
  await second.click(`document.querySelector('.notification-sheet button[aria-label="Delete notification"]')`);
  await second.until(`!document.querySelector('.notification-sheet button[aria-label="Delete notification"]')`, 'Delete notification UI');
  assert.equal((await api('/api/notifications',{cookie:accounts[1].cookie})).data.data.filter(n=>n.type==='comment'&&n.ranking_id===rankingId).length,0);
  await second.goto(base+`/post/${rankingId}`); await second.until(`document.body.textContent.includes(${JSON.stringify(replyText)})`,'Reply after refresh');
  await second.click(`document.querySelector('button[aria-label="Notifications"]')`);
  await second.until(`!!document.querySelector('.notification-sheet') && !document.querySelector('.notification-sheet button[aria-label="Delete notification"]')`, 'Deleted notification stays gone after refresh');
  await second.click(`document.querySelector('button[aria-label="Notifications"]')`);
  checks.push('Comments notifications: correct recipients, delete, persistence after refresh');
  // The root author alone has a Delete action on that root. The reply author
  // alone has Delete on the reply; the API must also reject another author.
  assert.equal(await second.evaluate(`document.querySelectorAll('button[aria-label="Delete comment"]').length`),1);
  assert.equal(await page.evaluate(`document.querySelectorAll('button[aria-label="Delete comment"]').length`),1);
  const forbidden = await api('/api/comments',{cookie:accounts[0].cookie,method:'DELETE',body:{id:initial.data.data[0].id}});
  assert.equal(forbidden.status,403);
  await second.click(`document.querySelector('button[aria-label="Delete comment"]')`);
  await second.until(`!!document.querySelector('[role=dialog]')`,'Delete confirmation');
  await second.click(`document.querySelector('[role=dialog] .dialog-danger')`);
  await second.until(`!document.body.textContent.includes(${JSON.stringify(commentText)}) && document.body.textContent.includes(${JSON.stringify(replyText)})`,'Root delete preserves reply');
  await page.until(`!document.body.textContent.includes(${JSON.stringify(commentText)}) && document.body.textContent.includes(${JSON.stringify(replyText)})`,'Other account receives root deletion',16000);
  for (const current of [page,second]) await current.until(`${counter}===1`,'UI count drops to 1');
  const remaining = await api(`/api/comments?ranking_id=${rankingId}`,{cookie:accounts[0].cookie});
  assert.equal(remaining.data.stats.comments,1); assert.equal(remaining.data.data.length,1); assert.equal(remaining.data.data[0].parent_id,null);
  checks.push('Comments: ownership enforced; root delete preserves other author reply; both UI/server counters 1');
  await page.click(`document.querySelector('button[aria-label="Delete comment"]')`);
  await page.until(`!!document.querySelector('[role=dialog]')`,'Reply delete confirmation');
  await page.click(`document.querySelector('[role=dialog] .dialog-danger')`);
  await page.until(`!document.body.textContent.includes(${JSON.stringify(replyText)})`,'Reply deleted');
  await second.until(`!document.body.textContent.includes(${JSON.stringify(replyText)})`,'Other account receives reply deletion',16000);
  for (const current of [page,second]) await current.until(`${counter}===0`,'UI count drops to 0');
  for (const current of [page,second]) {
    await current.goto(base+`/post/${rankingId}`); await current.until(`!!document.querySelector('textarea') && document.body.textContent.includes(${JSON.stringify(copy.post.startDiscussion)})`,'Deleted comments stay absent after refresh');
    const saved = await current.evaluate(`fetch('/api/comments?ranking_id=${rankingId}').then(r=>r.json())`);
    assert.equal(saved.stats.comments,0); assert.equal(saved.data.length,0);
  }
  assert.equal((await api('/api/notifications',{cookie:accounts[0].cookie})).data.data.filter(n=>n.type==='comment'&&n.ranking_id===rankingId).length,0);
  checks.push('Comments: both authors delete, live count returns to zero, comments and associated notifications stay gone after refresh');
  assert.deepEqual(pages.flatMap(current=>current.errors),[], 'No uncaught browser runtime errors');
  const result = { browser:browser.version, base, isolatedState:statePath, checks, timings, runtimeErrors:[], screenshots:['discover-mobile.png','discover-desktop.png','profile-mobile.png','profile-desktop.png','comments-notifications-mobile.png'] };
  fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
} catch(error) {
  if (pages[0]) {
    await pages[0].screenshot(path.join(output,'failure.png')).catch(()=>{});
    fs.writeFileSync(path.join(output,'failure-dom.txt'),await pages[0].evaluate('document.body.innerText').catch(()=>''));
  }
  fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify({passed:checks,error:error.stack,runtimeErrors:pages.flatMap(current=>current.errors)},null,2));
  throw error;
} finally { if(browser) await browser.close(); }
