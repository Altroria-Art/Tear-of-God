// UI-only regression: all API responses are local fixtures; never contacts production.
// Start `npm run dev -- --host 127.0.0.1` first.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const base = process.env.UI_TEST_URL || 'http://127.0.0.1:5173';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Local UI server required');
const port = 9337;
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tog-vibe-ui-'));
const chrome = spawn(chromePath, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${profileDir}`, '--no-first-run', '--no-default-browser-check', 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
chrome.stderr.on('data', chunk => { if (String(chunk).includes('ERROR')) console.error(String(chunk).trim()); });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let ws;
const keepAlive = setInterval(() => {}, 1000);
const deadline = setTimeout(() => { console.error('UI audit timed out'); ws?.close(); chrome.kill(); process.exit(1); }, 240000);
const output = 'artifacts/rank-your-vibe';
fs.mkdirSync(output, { recursive: true });
const shotPhase = process.env.VIBE_SHOT_PHASE;
const shotRoutes = new Map([
  ['/', 'home'], ['/discover', 'discover'], ['/create', 'create'],
  ['/rank?template=ui-template', 'rank'], ['/post/ui-ranking', 'post'],
  ['/template/ui-template', 'template'], ['/template/ui-template/community', 'community'],
  ['/profile/ui-user', 'profile'], ['/duel/ui-duel', 'duel'], ['/login', 'login'], ['/login?mode=signup', 'register'],
]);
const compactDesktopShots = new Set(['/login', '/login?mode=signup', '/post/ui-ranking', '/template/ui-template/community', '/duel/ui-duel', '/profile/ui-user', '/discover']);
if (shotPhase) fs.mkdirSync(`${output}/${shotPhase}`, { recursive: true });
const errors = [];
const violations = [];
let viewer = null;
let stickyFixture = null;
const person = { id: 'ui-user', username: 'Vibe Collector', bio: 'รสนิยมไม่จำเป็นต้องเหมือนกัน', followers_count: 12, following_count: 3, taste_identity: { top_items: [], badges: [], hashtag_distribution: [], pinned_rankings: [] } };
const tiers = [{ label: 'สุดยอดมาก', color: 'bg-[#ff7f7f]' }, { label: 'A', color: '#ffbf7f' }, { label: 'B', color: '#ffff7f' }];
const items = ['ชาไทย', 'Matcha', 'Espresso', 'Cocoa'].map((name, i) => ({ item_id: 'item-' + i, tier: tiers[i % 3].label, tier_index: i % 3, item: { name } }));
const template = { id: 'ui-template', title: 'เครื่องดื่มที่ใช่ / Your daily drink', description: 'A local UI fixture with custom Thai tiers.', hashtags: '#Food,#Drinks', creator_id: person.id, profile: person, tiers, template_items: items, use_count: 8, view_count: 21, stats: { uses: 8, views: 21, likes: 3, comments: 0 }, community_average: { tiers: tiers.map(t => ({ label: t.label, items: items.filter(i => i.tier === t.label).map(i => ({ name: i.item.name, avg: 1, votes: 8 })) })) } };
const ranking = { ...template, id: 'ui-ranking', user_id: person.id, template_id: template.id, ranking_items: items, created_at: '2026-09-29 06:00:00', comments: [] };
try {
  let targets;
  for (let i = 0; i < 50; i++) {
    try { targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); break; } catch { await delay(100); }
  }
  assert(targets?.length, 'Chrome must start');
  ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  ws.onclose = event => { console.error('Browser connection closed', event.code); };
  let serial = 0;
  const pending = new Map();
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++serial; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
  ws.onmessage = async event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const p = pending.get(message.id); pending.delete(message.id);
      if (message.error) p?.reject(message.error); else p?.resolve(message.result);
    } else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    else if (message.method === 'Fetch.requestPaused') {
      const { requestId, request } = message.params;
      const url = new URL(request.url);
      let body = { success: true, data: [], total: 0, hasMore: false };
      if (url.pathname === '/api/auth') body.data = viewer;
      else if (url.pathname === '/api/admin' || url.pathname === '/api/admin/analytics') body.data = { activity: {}, funnel: [], daily_activity: [], recent_posts: [], recent_reports: [] };
      else if (url.pathname === '/api/templates') { body.data = url.searchParams.has('id') ? (stickyFixture || template) : [template]; body.total = 1; }
      else if (url.pathname === '/api/rankings') { body.data = url.searchParams.has('id') ? ranking : [ranking]; body.total = 1; }
      else if (url.pathname === '/api/users') body.data = person;
      else if (url.pathname === '/api/spotlights') body.data = { daily: null, weekly: null, freshness: {} };
      else if (url.pathname === '/api/duels') body.data = { id: 'ui-duel', challenger: { ...person, id: 'challenger' }, owner: person, template, similarity_score: 75, community_similarity_score: 70, community_sample_count: 8, comparison: { details: [], total_items: 4, matched_items: 3 }, created_at: ranking.created_at };
      await send('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: Buffer.from(JSON.stringify(body)).toString('base64') });
    }
  };
  const evaluate = async expression => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description); return r.result?.value; };
  const tierZone = index => `(() => {
    const zone = [...document.querySelectorAll('.drop-zone')].filter(node => node.parentElement?.classList.contains('bg-tag'))[${index}];
    if (!zone) throw new Error('Missing tier drop zone at index ${index}');
    return zone;
  })()`;
  const unrankedZone = `(() => {
    const zone = [...document.querySelectorAll('.drop-zone')].find(node => !node.parentElement?.classList.contains('bg-tag'));
    if (!zone) throw new Error('Missing Unranked drop zone');
    return zone;
  })()`;
  await send('Runtime.enable'); await send('Page.enable');
  await send('Fetch.enable', { patterns: [{ urlPattern: '*/api/*' }] });
  const routes = ['/', '/discover', '/discover?view=saved', '/discover/templates', '/discover/hashtags', '/create', '/rank?template=ui-template', '/rank?template=ui-template&mode=duel', '/template/ui-template', '/post/ui-ranking', '/template/ui-template/community', '/profile/ui-user', '/duel/ui-duel', '/login', '/login?mode=signup', '/forgot-password', '/reset-password', '/missing'];
  let checks = 0;
  for (const theme of ['light', 'dark']) {
    for (const language of ['en', 'th']) {
      await send('Page.navigate', { url: base }); await delay(200);
      await evaluate(`localStorage.setItem('tog-theme', ${JSON.stringify(theme)}); localStorage.setItem('tog-lang', ${JSON.stringify(language)});`);
      for (const route of routes) {
        await send('Page.navigate', { url: base + route }); await delay(420);
        for (let n = 0; n < 40; n++) {
          if (await evaluate(`document.readyState === 'complete' && document.querySelector('nav') && !document.querySelector('.tier-loader')`)) break;
          await delay(100);
        }
        for (const width of [320, 360, 375, 390, 412, 430, 768, 820, 1024, 1280, 1366, 1440]) {
          await send('Emulation.setDeviceMetricsOverride', { width, height: ({390:844,430:932,768:1024,820:1180,1280:800,1366:768,1440:900})[width] || 900, deviceScaleFactor: 1, mobile: false });
          await delay(30);
          const result = await evaluate(`({ overflow: document.documentElement.scrollWidth > innerWidth + 1, width: document.documentElement.scrollWidth, title: document.querySelector('h1')?.textContent, error: document.body.textContent.includes('Something went wrong') })`);
          if (result.overflow || result.error) violations.push({ theme, language, route, width, result });
          if (width >= 768 && ['/create', '/rank?template=ui-template', '/login', '/login?mode=signup'].includes(route)) {
            await delay(650);
            const layout = await evaluate(`(() => {
              const rect = selector => document.querySelector(selector)?.getBoundingClientRect().toJSON();
              const panes = [...document.querySelectorAll('.auth-v2 > div > div')].filter(n => n.querySelector('form') && n.getAttribute('aria-hidden') !== 'true');
              return { board:rect('.create-board'), add:rect('.quick-add-panel'), pool:rect('.rank-pool'), rankBoard:rect('.rank-board'), auth:panes[0]?.getBoundingClientRect().toJSON(), card:rect('.auth-v2 > div'), publish:rect('.editor-toolbar-float button') };
            })()`);
            if (route === '/create') assert(layout.add.x >= layout.board.right - 1 && Math.abs(layout.add.y - layout.board.y) < 2, 'iPad/laptop Add controls stay beside the board');
            if (route.startsWith('/rank')) assert(layout.pool.x >= layout.rankBoard.right - 1, 'Unranked stays beside the Rank board');
            if (route.startsWith('/login') && width >= 1024) assert(Math.abs(layout.auth.width - (layout.card.width - 4) / 2) < 2, 'Auth form occupies half the card without panel overlap');
            if (layout.publish) assert(layout.publish.height >= 44 && layout.publish.bottom <= (({390:844,430:932,768:1024,820:1180,1280:800,1366:768,1440:900})[width] || 900), 'Publish remains visible with 44px target');
          }
          checks++;
          if (([390,1440].includes(width) || (width === 1366 && compactDesktopShots.has(route))) && shotRoutes.has(route) && (language === 'en' || (shotPhase === 'after' && language === 'th' && ['/', '/discover', '/create', '/rank?template=ui-template'].includes(route)))) {
            if (route === '/') await delay(500);
            const shot = await send('Page.captureScreenshot', { format: 'png' });
            fs.writeFileSync(`${output}/${shotPhase ? `${shotPhase}/` : ''}${theme}-${language === 'en' ? '' : 'th-'}${shotRoutes.get(route)}-${width}.png`, Buffer.from(shot.data, 'base64'));
          }
        }
      }
    }
  }

  // A long board proves actual sticky engagement; a short board catches a rail
  // that dictates the grid row height and scrolls its controls under the navbar.
  const stickyGeometry = [];
  for (const language of ['en', 'th']) {
    await evaluate(`localStorage.setItem('tog-lang', ${JSON.stringify(language)})`);
    for (const tierCount of [5, 18]) {
      stickyFixture = {
        ...template,
        tiers: Array.from({ length: tierCount }, (_, index) => ({ label: 'Tier ' + (index + 1), color: '#ff7f7f' })),
        template_items: Array.from({ length: 18 }, (_, index) => ({ item_id: 'sticky-' + index, item: { name: 'Item ' + (index + 1) } })),
      };
      for (const [width, height] of [[768,1024], [820,1180], [1280,800], [1366,768], [1440,900]]) {
        await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
        await send('Page.navigate', { url: base + '/rank?template=sticky-' + tierCount });
        for (let n = 0; n < 60; n++) {
          if (await evaluate(`document.querySelectorAll('.rank-pool [data-item-id]').length === 18 && document.querySelectorAll('.rank-board > div').length === ${tierCount}`)) break;
          await delay(100);
        }
        assert.equal(await evaluate(`document.querySelectorAll('.rank-pool [data-item-id]').length`), 18, 'Tall pool fixture loaded');
        const positions = [];
        for (const requestedScroll of [0, 200, 550, 900]) {
          await evaluate('window.scrollTo(0, ' + requestedScroll + ')'); await delay(80);
          const geometry = await evaluate(`(() => {
            const rail = document.querySelector('.rank-side');
            const style = getComputedStyle(rail);
            const rect = node => node.getBoundingClientRect().toJSON();
            const navbar = document.querySelector('nav:not(.bottom-nav)');
            return { scrollY, viewportHeight: innerHeight, scrollHeight: document.documentElement.scrollHeight,
              position: style.position, inset: parseFloat(style.top), display: style.display,
              rail: rect(rail), workspace: rect(rail.parentElement), board: rect(document.querySelector('.rank-board')), navbar: rect(navbar),
              overflow: document.documentElement.scrollWidth > innerWidth + 1 };
          })()`);
          assert.equal(geometry.position, 'sticky');
          assert.equal(geometry.display, 'flex');
          assert(!geometry.overflow, 'Sticky Rank does not overflow');
          if (requestedScroll >= 550) {
            assert(geometry.rail.top >= geometry.navbar.bottom + 8, 'Rail controls remain below navbar even at a short board boundary');
            assert(geometry.rail.bottom <= height - 8, 'Entire rail fits inside viewport on scroll');
            if (tierCount === 18) {
              assert.equal(geometry.scrollY, requestedScroll, 'Long fixture reaches the requested scroll position');
              assert(geometry.board.height > height, 'Acceptance board is taller than viewport');
              assert(geometry.rail.top <= geometry.navbar.bottom + 20, 'Long-board rail pins near navbar');
              assert(Math.abs(geometry.rail.top - geometry.inset) <= 2, 'Sticky inset actually engages');
            }
          }
          positions.push(geometry.rail.top);
          stickyGeometry.push({ language, tierCount, width, height, requestedScroll, ...geometry });
          checks++;
        }
        if (tierCount === 18) assert(Math.abs(positions[2] - positions[3]) <= 2, 'Rail top remains stable deeper in the board');
        const targets = await evaluate(`(() => {
          const pool = document.querySelector('.rank-pool'); pool.scrollTop = pool.scrollHeight;
          const item = [...pool.querySelectorAll('.editor-item-main')].at(-1);
          const publish = document.querySelector('.editor-toolbar-float button');
          const controls = [...document.querySelectorAll('.rank-controls button')];
          const hit = node => { const r = node.getBoundingClientRect(); return node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); };
          const r = item.getBoundingClientRect();
          return { poolScrollable: pool.scrollHeight > pool.clientHeight, poolScrolled: pool.scrollTop > 0,
            itemHit: hit(item), controlsHit: controls.every(hit), publishHit: hit(publish), publishHeight: publish.getBoundingClientRect().height,
            itemCenter: { x: r.x + r.width / 2, y: r.y + r.height / 2 } };
        })()`);
        assert(targets.poolScrollable && targets.poolScrolled && targets.itemHit && targets.controlsHit, 'Internal pool scroll keeps final item and controls reachable');
        assert(targets.publishHit && targets.publishHeight >= 44, 'Publish remains visible and usable without rail overlap');
        await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...targets.itemCenter });
        await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...targets.itemCenter });
        await delay(80);
        assert(await evaluate(`!!document.querySelector('[role=dialog]')`), 'Scrolled Unranked item opens picker by pointer');
        await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' });
        await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape' });
      }
    }
  }
  for (const [width, height] of [[390,844], [430,932]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true });
    await send('Page.navigate', { url: base + '/rank?template=sticky-mobile' });
    for (let n = 0; n < 60; n++) { if (await evaluate(`!!document.querySelector('.rank-pool .editor-item-main')`)) break; await delay(100); }
    assert(await evaluate(`getComputedStyle(document.querySelector('.rank-side')).display === 'contents' && getComputedStyle(document.querySelector('.rank-side')).position !== 'sticky' && getComputedStyle(document.querySelector('.rank-pool')).overflowY !== 'auto' && !document.querySelector('.rank-controls').offsetWidth`), 'Mobile keeps Unranked in normal flow without desktop rail');
    assert(await evaluate(`document.documentElement.scrollWidth <= innerWidth + 1`), 'Mobile Rank does not overflow');
    await evaluate(`document.querySelector('.rank-pool .editor-item-main').click()`); await delay(80);
    assert(await evaluate(`!!document.querySelector('[role=dialog]')`), 'Mobile tap still opens AssignTierModal');
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape' });
    checks++;
  }
  stickyFixture = null;
  fs.writeFileSync(output + '/sticky-geometry.json', JSON.stringify(stickyGeometry, null, 2));

  viewer = { ...person, role: 'admin' };
  for (const route of ['/', '/admin', '/admin/users', '/admin/templates', '/admin/rankings', '/admin/reports']) {
    await send('Page.navigate', { url: base + route }); await delay(700);
    for (const width of [320,360,375,390,412,430,768,1024,1440]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false }); await delay(40);
      if (await evaluate(`document.documentElement.scrollWidth > innerWidth + 1`)) violations.push({ route, width, viewer: 'admin' });
      checks++;
    }
  }
  viewer = null;
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 900, deviceScaleFactor: 1, mobile: false });
  fs.writeFileSync(`${output}/audit.json`, JSON.stringify({ checks, violations, errors }, null, 2));
  await send('Page.navigate', { url: base + '/rank?template=ui-template' });
  for (let n = 0; n < 40; n++) { if (await evaluate(`!!document.querySelector('[data-item-id] button')`)) break; await delay(100); }
  assert(await evaluate(`!!document.querySelector('[data-item-id] button')`), 'Editor items render');
  await evaluate(`document.querySelector('[data-item-id] button').click()`); await delay(100);
  assert(await evaluate(`!!document.querySelector('[role=dialog]')`), 'Tap opens accessible tier picker');
  assert(await evaluate(`document.querySelector('[role=dialog]').contains(document.activeElement)`), 'Focus enters picker');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape' });
  assert(await evaluate(`!document.querySelector('[role=dialog]')`), 'Escape closes picker');
  await evaluate(`(() => { const item = (${unrankedZone}).querySelector('[data-item-id="item-0"] button'); if (!item) throw new Error('Missing item-0 in Unranked'); item.click(); })()`); await delay(80);
  await evaluate(`(() => { const modal = document.querySelector('[role=dialog]'); if (!modal) throw new Error('Missing tier picker'); const button = modal.querySelector('.grid button'); if (!button) throw new Error('Missing first tier choice'); button.click(); })()`); await delay(80);
  assert(await evaluate(`!!(${tierZone(0)}).querySelector('[data-item-id="item-0"]') && !(${unrankedZone}).querySelector('[data-item-id="item-0"]')`), 'Tap assignment moves item-0 from Unranked into tier 0');
  await evaluate(`(() => { const transfer = new DataTransfer(); transfer.setData('itemId', 'item-0'); (${tierZone(1)}).dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer })); })()`); await delay(80);
  assert(await evaluate(`!!(${tierZone(1)}).querySelector('[data-item-id="item-0"]') && !(${tierZone(0)}).querySelector('[data-item-id="item-0"]')`), 'Drop handler moves item-0 from tier 0 to tier 1');
  await evaluate(`(${tierZone(0)}).scrollIntoView({ block: 'center', behavior: 'instant' })`); await delay(100);
  const dragPoints = await evaluate(`(() => {
    const sourceItem = (${tierZone(1)}).querySelector('[data-item-id="item-0"] .editor-item-main');
    if (!sourceItem) throw new Error('Missing item-0 drag source in tier 1');
    const targetZone = ${tierZone(0)};
    const a = sourceItem.getBoundingClientRect();
    const b = targetZone.getBoundingClientRect();
    if (a.width <= 0 || a.height <= 0 || a.top < 0 || a.bottom > innerHeight) throw new Error('Drag source is not visible');
    if (b.width <= 0 || b.height <= 0 || b.top < 0 || b.top >= innerHeight) throw new Error('Drag target is not visible');
    return { from: { x: a.left + a.width / 2, y: a.top + 20 }, to: { x: b.left + Math.min(b.width / 2, 100), y: b.top + b.height / 2 } };
  })()`);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: dragPoints.from.x, y: dragPoints.from.y });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: dragPoints.from.x, y: dragPoints.from.y, button: 'left', buttons: 1, clickCount: 1 });
  for (let step = 1; step <= 12; step++) {
    const x = dragPoints.from.x + (dragPoints.to.x - dragPoints.from.x) * step / 12;
    const y = dragPoints.from.y + (dragPoints.to.y - dragPoints.from.y) * step / 12;
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'left', buttons: 1 });
    await delay(25);
  }
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: dragPoints.to.x, y: dragPoints.to.y, button: 'left', buttons: 0, clickCount: 1 }); await delay(150);
  assert(await evaluate(`!!(${tierZone(0)}).querySelector('[data-item-id="item-0"]') && !(${tierZone(1)}).querySelector('[data-item-id="item-0"]')`), 'Physical pointer drag moves item-0 from tier 1 to tier 0');
  await send('Page.navigate', { url: base + '/discover' }); await delay(600);
  await evaluate(`(() => { const input = document.querySelector('input[name=query]'); input.value = 'matcha'; input.form.requestSubmit(); })()`); await delay(150);
  assert(await evaluate(`new URLSearchParams(location.search).get('q') === 'matcha'`), 'Discover search updates query');
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  assert(await evaluate(`(() => { const button = document.querySelector('.pulse-search-button'); if (!button) throw new Error('Missing Discover search button for reduced-motion check'); return getComputedStyle(button).transitionDuration.split(',').every(s => parseFloat(s) < .01); })()`), 'Reduced motion overrides transitions');
  await send('Page.navigate', { url: base + '/create' }); await delay(500);
  await evaluate(`(() => { const field = document.querySelector('.quick-add-panel textarea'); const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; setter.call(field, 'Tea, Coffee'); field.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await evaluate(`document.querySelector('.quick-add-panel button').click()`); await delay(100);
  assert(await evaluate(`document.querySelectorAll('[data-item-id]').length === 2`), 'Quick Add creates two draggable items');
  await evaluate(`document.querySelector('[data-item-id]').scrollIntoView({ block: 'center', behavior: 'instant' })`); await delay(80);
  const deleteTarget = await evaluate(`(() => {
    const card = document.querySelector('[data-item-id]');
    const button = card.querySelector('button[aria-label^="Remove"], button[aria-label^="ลบ"]');
    const rect = button.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    const neighbor = card.nextElementSibling?.getBoundingClientRect();
    return { width: rect.width, height: rect.height, overhangRight: rect.right - cardRect.right, overhangTop: cardRect.top - rect.top, clearOfNeighbor: !neighbor || rect.right <= neighbor.left, centerHitsDelete: button.contains(document.elementFromPoint(center.x, center.y)), mainHitsPicker: card.querySelector('.editor-item-main').contains(document.elementFromPoint(cardRect.left + cardRect.width / 2, cardRect.top + 20)), overflow: document.documentElement.scrollWidth > innerWidth + 1 };
  })()`);
  assert(deleteTarget.width >= 44 && deleteTarget.height >= 44 && deleteTarget.overhangRight <= 4 && deleteTarget.overhangTop <= 4 && deleteTarget.clearOfNeighbor && deleteTarget.centerHitsDelete && deleteTarget.mainHitsPicker && !deleteTarget.overflow, 'Delete target is 44px, clear of neighbors, and leaves tier picker and viewport usable');
  await evaluate(`document.querySelector('[data-item-id] .editor-item-main').click()`); await delay(80);
  assert(await evaluate(`!!document.querySelector('[role=dialog]')`), 'New item opens tier picker');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape' });
  await evaluate(`document.querySelector('[data-item-id] button.absolute').click()`); await delay(80);
  assert(await evaluate(`document.querySelectorAll('[data-item-id]').length === 1`), 'Delete removes a created item');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await evaluate(`localStorage.setItem('tog-lang', 'en')`);
  await send('Page.navigate', { url: base + '/' }); await delay(450);
  const wasLight = await evaluate(`document.body.classList.contains('light-theme')`);
  await evaluate(`document.querySelector('button[aria-label="Toggle Theme"]').click()`); await delay(80);
  assert.notEqual(await evaluate(`document.body.classList.contains('light-theme')`), wasLight, 'Theme button changes theme');
  await evaluate(`document.querySelector('button[aria-label="Switch language"]').click()`); await delay(100);
  assert(await evaluate(`document.querySelector('.play-header--home .play-title').textContent.includes('จัดเทียร์')`), 'Language button updates hero text');
  for (const language of ['en', 'th']) {
    await evaluate(`localStorage.setItem('tog-lang', ${JSON.stringify(language)})`);
    await send('Page.navigate', { url: base + '/rank?template=ui-template' });
    for (let n = 0; n < 40; n++) {
      if (await evaluate(`!!document.querySelector('.editor-metadata button[aria-label^="Remove"], .editor-metadata button[aria-label^="ลบ"]')`)) break;
      await delay(100);
    }
    const controls = await evaluate(`(() => {
      const details = document.querySelector('.editor-metadata'); details.open = true;
      const input = details.querySelector('input');
      const button = details.querySelector('button[aria-label^="Remove"], button[aria-label^="ลบ"]');
      return { language: document.documentElement.lang, placeholder: input.placeholder, removeName: button?.getAttribute('aria-label'), text: details.textContent };
    })()`);
    assert.equal(controls.language, language);
    assert.equal(controls.placeholder, language === 'en' ? '+ Add tags...' : '+ เพิ่มแท็ก...');
    assert.equal(controls.removeName, language === 'en' ? 'Remove #Food' : 'ลบ #Food');
    if (language === 'en') assert(!/[ก-๙]/.test(`${controls.placeholder} ${controls.removeName} ${controls.text}`), 'English tag controls contain no hardcoded Thai');
  }
  viewer = { ...person, id: 'ui-viewer', role: 'user' };
  await evaluate(`localStorage.setItem('tog-lang', 'en')`);
  await send('Page.navigate', { url: base + '/post/ui-ranking' });
  for (let n = 0; n < 40; n++) { if (await evaluate(`!!document.querySelector('.post-board')`)) break; await delay(100); }
  assert(await evaluate(`!!document.querySelector('button[aria-label="Report"]') && !document.querySelector('button[aria-label="Delete"]')`), 'Non-owner sees Report, not Delete');
  await evaluate(`(() => { const button = document.querySelector('button[aria-label="Report"]'); if (!button) throw new Error('Missing non-owner Report action'); button.focus(); button.click(); })()`); await delay(80);
  assert(await evaluate(`document.querySelector('[role=dialog][aria-modal=true]')?.textContent.includes('Report')`), 'Post report opens shared Action Modal');
  assert(await evaluate(`document.querySelector('[role=dialog]').contains(document.activeElement)`), 'Report focus enters dialog');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape' }); await delay(80);
  assert(await evaluate(`!document.querySelector('[role=dialog]') && document.activeElement?.getAttribute('aria-label') === 'Report'`), 'Report Escape closes and returns focus');
  viewer = { ...person, role: 'user' };
  await send('Page.navigate', { url: base + '/post/ui-ranking' });
  for (let n = 0; n < 40; n++) { if (await evaluate(`!!document.querySelector('.post-board')`)) break; await delay(100); }
  assert(await evaluate(`!!document.querySelector('button[aria-label="Delete"]') && !document.querySelector('button[aria-label="Report"]')`), 'Owner sees Delete, not Report');
  await evaluate(`document.querySelector('button[aria-label="Delete"]').click()`); await delay(80);
  assert(await evaluate(`document.querySelector('[role=dialog][aria-modal=true]')?.textContent.includes('Delete')`), 'Delete uses shared Action Modal');
  await evaluate(`document.querySelector('[role=dialog] .dialog-secondary').click()`); await delay(80);
  assert(await evaluate(`!document.querySelector('[role=dialog]') && !!document.querySelector('.post-board')`), 'Delete Cancel keeps ranking intact');
  await send('Page.navigate', { url: base + '/profile/ui-user' }); await delay(600);
  assert(await evaluate(`!!Array.from(document.querySelectorAll('button')).find(button => button.textContent.includes('Followers'))`), 'Profile follow list trigger renders');
  await evaluate(`(() => { const button = Array.from(document.querySelectorAll('button')).find(button => button.textContent.includes('Followers')); button.focus(); button.click(); })()`); await delay(80);
  assert(await evaluate(`!!document.querySelector('[role=dialog][aria-modal=true]') && document.querySelector('[role=dialog]').contains(document.activeElement)`), 'Profile follow list uses shared Modal and receives focus');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape' }); await delay(80);
  assert(await evaluate(`!document.querySelector('[role=dialog]') && document.activeElement?.textContent.includes('Followers')`), 'Follow list Escape closes and returns focus');
  fs.writeFileSync(`${output}/audit.json`, JSON.stringify({ checks, violations, errors, interactions: ['tap opens picker', 'focus enters picker', 'Escape dismisses picker', 'tap assignment', 'drop handler moves item', 'physical pointer drag', 'Discover search', 'Quick Add', '44px delete target', 'delete item', 'theme toggle', 'language toggle', 'Rank tag controls EN/TH', 'Post Action Modal report/delete focus and cancel', 'Profile follow list Modal focus and Escape', 'reduced motion'] }, null, 2));
  console.log(JSON.stringify({ checks, violations, errors }, null, 2));
  assert.equal(errors.length, 0, 'No runtime exceptions');
  assert.equal(violations.length, 0, 'No viewport overflow');
} finally { clearInterval(keepAlive); clearTimeout(deadline); ws?.close(); chrome.kill(); }
