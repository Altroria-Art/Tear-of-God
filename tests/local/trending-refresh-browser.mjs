// Built React UI + Pages Functions + isolated local D1; never run on remote data.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { chromium, delay } from './helpers/chromium.mjs';

const base = process.env.BROWSER_QA_URL, root = process.cwd();
const state = path.resolve(process.env.BROWSER_QA_STATE || '');
assert(base && ['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Explicit loopback BROWSER_QA_URL required');
assert(process.env.BROWSER_QA_STATE && state.startsWith(path.join(root, '.wrangler', 'browser-qa-')) && state.endsWith(path.sep + 'state'), 'Explicit isolated .wrangler/browser-qa-*/state required');
const output = path.dirname(state), run = randomUUID().slice(0, 8);
const author = `trending-qa-${run}`, template = `${author}-template`;
const q = value => `'${String(value).replaceAll("'", "''")}'`;
function sql(source, name) {
  const file = path.join(output, name); fs.writeFileSync(file, source);
  execFileSync(process.execPath, [path.join(root, 'node_modules/wrangler/bin/wrangler.js'), 'd1', 'execute', 'tear-of-god-db', '--local', '--persist-to', state, '--file', file], { windowsHide: true, stdio: 'pipe', timeout: 60000 });
}
sql(`INSERT INTO profiles(id,username) VALUES (${q(author)},${q(author)});`, 'isolation.sql');
assert.equal((await (await fetch(base + '/api/users?id=' + author)).json()).data?.username, author, 'Server reads selected isolated D1');
assert.deepEqual((await (await fetch(base + '/api/rankings?limit=1')).json()).data, [], 'Use a fresh isolated state with no rankings for each run');
const tiers = Array.from({ length: 12 }, (_, i) => ({ id: `t${i}`, label: `Tier ${i + 1}`, color: ['#ff7f7f', '#ffbf7f', '#ffff7f'][i % 3] }));
const ids = Array.from({ length: 60 }, (_, i) => `${author}-ranking-${i}`);
const fixture = [`INSERT INTO templates(id,creator_id,title,hashtags,tiers) VALUES (${q(template)},${q(author)},'Tall ranking QA','#BrowserQA',${q(JSON.stringify(tiers))});`];
for (let i = 0; i < 12; i++) fixture.push(`INSERT INTO items(id,name) VALUES (${q(`${template}-item-${i}`)},${q(`Item ${i}`)}); INSERT INTO template_items(id,template_id,item_id,tier,position) VALUES (${q(`${template}-item-${i}`)},${q(template)},${q(`${template}-item-${i}`)},${q(tiers[i].label)},${i});`);
for (const id of ids) fixture.push(`INSERT INTO rankings(id,user_id,template_id,title,hashtags) VALUES (${q(id)},${q(author)},${q(template)},'Tall Trending fixture','#BrowserQA'); INSERT INTO ranking_items(id,ranking_id,item_id,tier,position) SELECT ${q(id)}||'-'||id,${q(id)},item_id,tier,position FROM template_items WHERE template_id=${q(template)};`);
sql(fixture.join('\n'), 'fixtures.sql');
const checks = [], pending = new Set();
let browser, page, delayed = false, failNext = false, requests = 0, maxConcurrent = 0;
const rendered = `[...document.querySelectorAll('[data-social-ranking]')].map(e=>e.dataset.socialRanking)`;
const seen = `JSON.parse(localStorage.getItem('tog:trending-seen:guest')||'[]').map(e=>e.id)`;
const busy = `!!document.querySelector('button[aria-pressed=true][aria-busy=true]')`;
try {
  browser = await chromium(); page = await browser.page(); await page.viewport(1280, 500);
  page.on('Network.requestWillBeSent', event => {
    if (event.request.url.includes('/api/rankings?') && event.request.url.includes('feed_type=trending')) { requests++; pending.add(event.requestId); maxConcurrent = Math.max(maxConcurrent, pending.size); }
  });
  for (const event of ['Network.loadingFinished', 'Network.loadingFailed']) page.on(event, data => pending.delete(data.requestId));
  await page.send('Fetch.enable', { patterns: [{ urlPattern: '*api/rankings?*', requestStage: 'Request' }] });
  page.on('Fetch.requestPaused', async event => {
    if (event.request.url.includes('feed_type=trending')) {
      if (failNext) { failNext = false; await page.send('Fetch.fulfillRequest', { requestId: event.requestId, responseCode: 503, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: Buffer.from(JSON.stringify({ success: false, error: 'QA retry probe' })).toString('base64') }); return; }
      if (delayed) await delay(500);
    }
    await page.send('Fetch.continueRequest', { requestId: event.requestId });
  });
  const loaded = async () => page.until(`${rendered}.length>0 && !${busy}`, 'Trending loaded', 20000);
  const refresh = async count => page.evaluate(`(()=>{for(let i=0;i<${count};i++)window.dispatchEvent(new CustomEvent('tog-refresh-feed'));})()`);
  const viewFirst = async () => {
    const id = await page.evaluate(`document.querySelector('[data-social-ranking]').dataset.socialRanking`);
    const height = await page.evaluate(`(()=>{const rect=document.querySelector('[data-social-ranking]').getBoundingClientRect();window.scrollTo({top:scrollY+rect.top,behavior:'instant'});return rect.height;})()`);
    assert(height > 1000, 'Fixture is taller than twice the 500px viewport');
    return id;
  };
  await page.goto(base); await loaded();
  const first = await viewFirst();
  await page.until(`${seen}.includes(${JSON.stringify(first)})`, 'Tall visible post remembered');
  checks.push('Tall card exceeding twice viewport height is recorded after dwell');
  await refresh(1); await page.until(`!${busy} && !${rendered}.includes(${JSON.stringify(first)})`, 'Read post removed', 20000);
  assert.equal(new Set(await page.evaluate(rendered)).size, (await page.evaluate(rendered)).length);
  checks.push('Manual refresh removes read cards and retains unique unread cards');
  const quick = await viewFirst();
  const before = requests; delayed = true; await refresh(20);
  await page.until(`${busy}`, 'Refreshing indicator');
  await page.until(`${seen}.includes(${JSON.stringify(quick)})`, 'Explicit refresh records current card without dwell');
  await page.until(`!${busy}`, 'Burst refresh finished', 20000); await delay(800);
  assert.equal(requests - before, 2, 'Burst runs one initial request plus one queued refresh');
  assert.equal(maxConcurrent, 1, 'No overlapping Trending requests');
  assert(!(await page.evaluate(rendered)).includes(quick));
  delayed = false; checks.push('20 rapid Home events coalesce into two serial requests; clicked visible post does not repeat');
  const persisted = await viewFirst(); await page.until(`${seen}.includes(${JSON.stringify(persisted)})`, 'Read before F5');
  await page.goto(base); await loaded();
  const remembered = await page.evaluate(seen); assert((await page.evaluate(rendered)).every(id => !remembered.includes(id)));
  checks.push('Seen history survives full document reload and activity-independent filtering');
  failNext = true; await refresh(1); await page.until(`document.body.textContent.includes('QA retry probe') && !${busy}`, 'Manual refresh failure');
  await refresh(1); await loaded(); assert.equal(await page.evaluate(`document.body.textContent.includes('QA retry probe')`), false);
  checks.push('Failed manual refresh unlocks; immediate retry clears stale error');
  delayed = true; const switched = requests; await refresh(20); await page.until(`${busy}`, 'Pending refresh before tab switch');
  await page.click(`[...document.querySelectorAll('button')].find(e=>e.textContent.trim()==='Following')`);
  await page.until(`document.querySelector('button[aria-pressed=true]')?.textContent.trim()==='Following'`, 'Following selected');
  await delay(1000); assert.equal(requests - switched, 1, 'Old queued refresh cancelled by tab switch');
  delayed = false; checks.push('Switching feeds discards old result and queued refresh');
  await page.send('Fetch.disable');
  await page.evaluate(`localStorage.setItem('tog:trending-seen:guest',JSON.stringify(${JSON.stringify(ids)}.map(id=>({id,seenAt:Date.now()}))))`);
  const moreButton = `[...document.querySelectorAll('main button')].find(e=>e.textContent.trim()==='Loading more...')`;
  await page.goto(base); await page.until(`document.body.textContent.includes("You're all caught up") || !!${moreButton}`, 'Exhausted Trending loaded', 20000);
  for (let i = 0; i < 4; i++) {
    await delay(300);
    if (await page.evaluate(`document.body.textContent.includes("You're all caught up")`)) break;
    if (await page.evaluate(`!!${moreButton}`)) await page.click(moreButton);
  }
  await page.until(`document.body.textContent.includes("You're all caught up")`, 'All seen empty state', 20000);
  await refresh(20); await page.until(`!${busy}`, 'Empty refresh unlocks', 20000); await delay(800);
  assert.deepEqual(await page.evaluate(rendered), []); assert.equal(maxConcurrent, 1);
  checks.push('Exhausted feed stays empty during repeated refresh, without recycling seen posts');
  assert.deepEqual(page.errors, []);
  await page.screenshot(path.join(output, 'all-seen.png'));
  fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify({ browser: browser.version, checks, maxConcurrent, runtimeErrors: [] }, null, 2));
  console.log(JSON.stringify({ checks: checks.length, maxConcurrent, runtimeErrors: [] }, null, 2));
} catch (error) {
  if (page) { await page.screenshot(path.join(output, 'failure.png')).catch(() => {}); fs.writeFileSync(path.join(output, 'failure.txt'), await page.evaluate('document.body.innerText').catch(() => '')); fs.writeFileSync(path.join(output, 'failure.json'), JSON.stringify({ checks, requests, maxConcurrent, pending: [...pending], runtimeErrors: page.errors }, null, 2)); }
  throw error;
} finally { await browser?.close(); }
