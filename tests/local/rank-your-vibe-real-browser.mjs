// Real Pages Functions + local D1 browser acceptance. No API interception.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const base = process.env.ACCEPTANCE_URL || 'http://127.0.0.1:8799';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Local server required');
const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9338;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'tog-real-browser-'));
const chrome = spawn(chromePath, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const checks = [];
const runtimeErrors = [];
const failedApi = [];
const consoleIssues = [];
const apiRequests = new Map();
let ws;
const timeout = setTimeout(() => { console.error('Real browser audit timed out'); ws?.close(); chrome.kill(); process.exit(1); }, 180000);
try {
  const email = `ui-accept-${randomUUID().slice(0, 8)}@example.test`;
  const password = `LocalQA-${randomUUID()}!`;
  const username = 'UI Acceptance';
  const registration = await fetch(base + '/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'register', email, password, username }) });
  assert.equal(registration.status, 201, 'Browser account registered in local D1');
  let targets;
  for (let retry = 0; retry < 60; retry++) {
    try { targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); break; } catch { await delay(100); }
  }
  assert(targets?.length, 'Chrome starts');
  ws = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let serial = 0;
  const pending = new Map();
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++serial;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
  ws.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const waiting = pending.get(message.id); pending.delete(message.id);
      if (message.error) waiting?.reject(message.error); else waiting?.resolve(message.result);
    } else if (message.method === 'Runtime.exceptionThrown') {
      runtimeErrors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    } else if (message.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(message.params.type)) {
      consoleIssues.push(message.params.args.map(arg => arg.value ?? arg.description ?? '').join(' '));
    } else if (message.method === 'Network.requestWillBeSent') {
      const url = message.params.request.url;
      if (url.startsWith(base + '/api/')) {
        const path = new URL(url).pathname;
        apiRequests.set(path, (apiRequests.get(path) || 0) + 1);
      }
    } else if (message.method === 'Network.responseReceived') {
      const response = message.params.response;
      if (response.url.startsWith(base + '/api/') && response.status >= 500) failedApi.push({ url: response.url, status: response.status });
    }
  };
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description);
    return result.result?.value;
  };
  const until = async (expression, label, waitMs = 10000) => {
    for (let elapsed = 0; elapsed < waitMs; elapsed += 100) {
      if (await evaluate(expression)) { checks.push(label); return; }
      await delay(100);
    }
    throw new Error(`Timed out: ${label} (${await evaluate('location.href')})`);
  };
  const setField = async (selector, value) => evaluate(`(() => {
    const node = document.querySelector(${JSON.stringify(selector)});
    if (!node) throw new Error('Missing input: ' + ${JSON.stringify(selector)});
    const proto = node.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(node, ${JSON.stringify(value)});
    node.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  // Both editors put tier zones directly in bg-tag rows. Create keeps Unranked
  // inside .create-board, while Rank renders it before the tier canvas.
  const unrankedZone = `(() => {
    const zone = [...document.querySelectorAll('.drop-zone')].find(node => !node.parentElement?.classList.contains('bg-tag'));
    if (!zone) throw new Error('Missing Unranked drop zone');
    return zone;
  })()`;
  const tierZone = index => `(() => {
    const zone = [...document.querySelectorAll('.drop-zone')].filter(node => node.parentElement?.classList.contains('bg-tag'))[${index}];
    if (!zone) throw new Error('Missing tier drop zone at index ${index}');
    return zone;
  })()`;
  const unrankedItem = `(() => {
    const item = (${unrankedZone}).querySelector('[data-item-id] .editor-item-main');
    if (!item) throw new Error('Missing item in Unranked drop zone');
    return item;
  })()`;
  await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send('Page.navigate', { url: base + '/create' });
  await until(`!!document.querySelector('.quick-add-panel')`, 'guest Create loads');
  await evaluate(`document.querySelector('.editor-toolbar-float button').click()`);
  await until(`location.pathname === '/login' && new URLSearchParams(location.search).get('next') === '/create'`, 'guest returns to login safely');
  await until(`!!document.querySelector('#login-email')`, 'login form loads');
  await setField('#login-email', email);
  await setField('#login-password', 'wrong-password');
  await evaluate(`document.querySelector('#login-email').closest('form').requestSubmit()`);
  await until(`document.body.textContent.includes('Invalid email or password') || document.body.textContent.includes('เข้าสู่ระบบไม่สำเร็จ')`, 'invalid login has feedback');
  assert.equal(await evaluate(`location.pathname`), '/login');
  await setField('#login-password', password);
  await evaluate(`document.querySelector('#login-email').closest('form').requestSubmit()`);
  await until(`location.pathname === '/create' && !!document.querySelector('.quick-add-panel')`, 'login returns to Create');
  await send('Page.navigate', { url: base + '/create' });
  await until(`!!document.querySelector('.quick-add-panel')`, 'session restored after refresh');
  const authResponse = await evaluate(`fetch('/api/auth').then(r => r.json())`);
  assert(authResponse.data?.id, 'real session cookie restored');
  checks.push('authenticated session restored');

  const uploads = await evaluate(`(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 2; canvas.height = 2;
    canvas.getContext('2d').fillRect(0, 0, 2, 2);
    const results = [];
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
      const blob = await new Promise(resolve => canvas.toBlob(resolve, type));
      const data = new FormData(); data.append('file', new File([blob], 'acceptance.' + type.split('/')[1], { type }));
      const response = await fetch('/api/upload', { method: 'POST', body: data });
      results.push({ type, status: response.status, body: await response.json() });
    }
    for (const [type, bytes] of [['text/plain', new Uint8Array([65, 66])], ['image/png', new Uint8Array(5 * 1024 * 1024 + 1)]]) {
      const data = new FormData(); data.append('file', new File([bytes], 'invalid-file', { type }));
      const response = await fetch('/api/upload', { method: 'POST', body: data });
      results.push({ type: type + '-invalid', status: response.status, body: await response.json() });
    }
    return results;
  })()`);
  for (const item of uploads.slice(0, 3)) assert(item.status === 200 && item.body.success && item.body.url, JSON.stringify(item));
  assert.equal(uploads[3].status, 415, 'Invalid upload type rejected');
  assert.equal(uploads[4].status, 413, 'Oversized upload rejected');
  checks.push('local R2 JPEG/PNG/WebP and invalid/oversized upload');

  await setField('.quick-add-panel textarea', 'ชาไทย, Coffee');
  await evaluate(`document.querySelector('.quick-add-panel button').click()`);
  await until(`document.querySelectorAll('[data-item-id]').length === 2`, 'Quick Add creates two items');
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  await evaluate(`(${unrankedItem}).scrollIntoView({ block: 'center', behavior: 'instant' })`);
  const touchPoint = await evaluate(`(() => { const rect = (${unrankedItem}).getBoundingClientRect(); return { x: rect.left + rect.width / 2, y: rect.top + 20 }; })()`);
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touchPoint] }); await delay(180);
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await until(`!!document.querySelector('[role=dialog]')`, 'emulated touch opens tier picker');
  assert(await evaluate(`document.querySelector('[role=dialog]').contains(document.activeElement)`), 'Dialog receives focus after touch');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab' });
  assert(await evaluate(`document.querySelector('[role=dialog]').contains(document.activeElement)`), 'Tab stays inside dialog');
  checks.push('tier picker focus trap');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape' });
  await until(`!document.querySelector('[role=dialog]')`, 'Escape closes touch picker');
  await send('Emulation.setTouchEmulationEnabled', { enabled: false });
  for (let index = 0; index < 2; index++) {
    await evaluate(`(${unrankedItem}).click()`);
    await until(`!!document.querySelector('[role=dialog]')`, 'tier picker opens');
    await evaluate(`document.querySelectorAll('[role=dialog] .grid button')[${index}].click()`);
    await until(`!document.querySelector('[role=dialog]')`, 'tier picker closes');
  }
  await until(`document.querySelector('.editor-toolbar-float').textContent.includes('2 / 2')`, 'ranked count reflects assignments');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1600, deviceScaleFactor: 1, mobile: false });
  const mouseDrag = async (itemId, targetZone, beforeFirst = false) => {
    await evaluate(`document.querySelector('.create-board').scrollIntoView({ block: 'start', behavior: 'instant' })`);
    await delay(50);
    const points = await evaluate(`(() => {
      const sourceItem = document.querySelector('[data-item-id=${JSON.stringify(itemId)}] .editor-item-main');
      if (!sourceItem) throw new Error('Missing drag source item: ' + ${JSON.stringify(itemId)});
      const zone = ${targetZone === 'unranked' ? unrankedZone : tierZone(targetZone)};
      const source = sourceItem.getBoundingClientRect();
      const target = zone.getBoundingClientRect();
      const firstItem = zone.querySelector('[data-item-id]');
      if (${beforeFirst} && !firstItem) throw new Error('Missing first item for tier reorder');
      const first = firstItem?.getBoundingClientRect();
      return { from: { x: source.left + source.width / 2, y: source.top + 20 }, to: { x: ${beforeFirst} && first ? first.left + 3 : ${targetZone === 'unranked'} ? target.left + 80 : target.right - 25, y: ${beforeFirst} && first ? first.top + first.height / 2 : target.top + Math.min(target.height / 2, 45) } };
    })()`);
    assert(points.from.y > 0 && points.from.y < 1600 && points.to.y > 0 && points.to.y < 1600, 'Drag endpoints are visible');
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: points.from.x, y: points.from.y });
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: points.from.x, y: points.from.y, button: 'left', buttons: 1, clickCount: 1 });
    for (let step = 1; step <= 12; step++) {
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: points.from.x + (points.to.x - points.from.x) * step / 12, y: points.from.y + (points.to.y - points.from.y) * step / 12, button: 'left', buttons: 1 });
      await delay(20);
    }
    await delay(120);
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: points.to.x, y: points.to.y, button: 'left', buttons: 1 });
    await delay(100);
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: points.to.x, y: points.to.y, button: 'left', buttons: 0, clickCount: 1 });
    await delay(100);
  };
  const secondId = await evaluate(`(${tierZone(1)}).querySelector('[data-item-id]').dataset.itemId`);
  await mouseDrag(secondId, 0);
  await until(`(${tierZone(0)}).querySelectorAll('[data-item-id]').length === 2 && !!(${tierZone(0)}).querySelector('[data-item-id=${JSON.stringify(secondId)}]') && !(${tierZone(1)}).querySelector('[data-item-id=${JSON.stringify(secondId)}]')`, 'physical mouse drag moves across tiers');
  const firstId = await evaluate(`(${tierZone(0)}).querySelector('[data-item-id]').dataset.itemId`);
  const reorderId = secondId === firstId ? (await evaluate(`(${tierZone(0)}).querySelectorAll('[data-item-id]')[1].dataset.itemId`)) : secondId;
  await mouseDrag(reorderId, 0, true);
  await until(`(${tierZone(0)}).querySelector('[data-item-id]').dataset.itemId === ${JSON.stringify(reorderId)} && ${JSON.stringify(reorderId)} !== ${JSON.stringify(firstId)}`, 'physical mouse drag reorders within tier');
  await mouseDrag(secondId, 'unranked');
  await until(`!!(${unrankedZone}).querySelector('[data-item-id=${JSON.stringify(secondId)}]')`, 'physical mouse drag returns item to Unranked');
  await evaluate(`(() => {
    const item = (${unrankedZone}).querySelector('[data-item-id=${JSON.stringify(secondId)}] .editor-item-main');
    if (!item) throw new Error('Returned item missing from Unranked drop zone');
    item.click();
  })()`);
  await until(`!!document.querySelector('[role=dialog]')`, 'returned item picker opens');
  await evaluate(`document.querySelector('[role=dialog] .grid button').click()`);
  await until(`document.querySelector('.editor-toolbar-float').textContent.includes('2 / 2')`, 'all items ranked after return');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await evaluate(`document.querySelector('.create-board .lucide-settings').closest('button').click()`);
  await until(`!!document.querySelector('#tier-label')`, 'tier settings opens');
  await setField('#tier-label', 'สุดยอด QA');
  await evaluate(`document.querySelector('[role=dialog] .play-button').click()`);
  await until(`document.querySelector('.create-board')?.textContent.includes('สุดยอด QA')`, 'custom tier saved');
  await setField('input[placeholder="E.g. Best 90s Movies..."]', `UI publish ${randomUUID().slice(0, 6)}`);
  await evaluate(`([...document.querySelectorAll('button')].find(button => button.textContent.trim().startsWith('+ #')) || null)?.click()`);
  await until(`[...document.querySelectorAll('span')].some(span => span.className.includes('bg-brand') && span.textContent.includes('#'))`, 'hashtag selected');
  const title = await evaluate(`document.querySelector('input[placeholder="E.g. Best 90s Movies..."]').value`);
  await evaluate(`(() => { const button = document.querySelector('.editor-toolbar-float button'); button.click(); button.click(); })()`);
  await until(`location.pathname.startsWith('/post/')`, 'publish redirects to Post Detail', 20000);
  const rankingId = await evaluate(`location.pathname.split('/').pop()`);
  await until(`document.body.textContent.includes(${JSON.stringify(title)})`, 'Post Detail shows title');
  await send('Page.reload');
  await until(`document.body.textContent.includes(${JSON.stringify(title)})`, 'published post survives refresh');
  const detail = await fetch(base + '/api/rankings?id=' + encodeURIComponent(rankingId)).then(response => response.json());
  assert.equal(detail.data?.ranking_items?.length, 2, 'D1 contains both ranked items');
  assert.equal(detail.data?.tiers?.[0]?.label, 'สุดยอด QA', 'D1 contains edited tier');
  checks.push('D1 contains published items and custom tier');
  const owned = await fetch(base + `/api/rankings?author_id=${encodeURIComponent(authResponse.data.id)}&limit=20`).then(response => response.json());
  assert.equal(owned.data.filter(row => row.title === title).length, 1, 'rapid Publish clicks create one ranking');
  checks.push('rapid Publish creates one ranking');
  await evaluate(`document.querySelector('nav a[href="/"]')?.click()`);
  try {
    await until(`document.body.textContent.includes(${JSON.stringify(title)})`, 'Home displays real published ranking', 12000);
  } catch (error) {
    console.error('Home diagnostics', JSON.stringify(await evaluate(`({ text: document.body.textContent.slice(0, 1800), cards: [...document.querySelectorAll('article')].map(node => node.textContent.slice(0, 80)) })`)));
    throw error;
  }
  assert.equal(await evaluate(`document.documentElement.scrollWidth > innerWidth + 1`), false);
  checks.push('mobile Home no overflow');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: base + '/profile' });
  await until(`location.pathname === '/profile' && document.body.textContent.includes(${JSON.stringify(username)})`, 'own profile loads real account');
  await evaluate(`document.querySelector('nav button[aria-label="Profile"], nav button[aria-label="โปรไฟล์"]').click()`);
  await until(`!![...document.querySelectorAll('nav button')].find(button => button.textContent.includes('Log out') || button.textContent.includes('ออกจากระบบ'))`, 'profile menu opens');
  await evaluate(`([...document.querySelectorAll('nav button')].find(button => button.textContent.includes('Log out') || button.textContent.includes('ออกจากระบบ'))).click()`);
  await until(`location.pathname === '/login' && !!document.querySelector('#login-email')`, 'UI logout returns to Login');
  await send('Page.navigate', { url: base + '/profile' });
  await until(`location.pathname === '/login'`, 'protected own profile redirects guest');
  const newEmail = `ui-register-${randomUUID().slice(0, 8)}@example.test`;
  const newPassword = `LocalQA-${randomUUID()}!`;
  await send('Page.navigate', { url: base + '/login?mode=signup' });
  await until(`!!document.querySelector('#register-email') && !document.querySelector('#register-email').closest('[inert]')`, 'UI registration form opens');
  await setField('#register-username', 'ผู้ใช้ QA');
  await setField('#register-email', newEmail);
  await setField('#register-password', newPassword);
  await setField('#register-confirm-password', newPassword);
  await evaluate(`document.querySelector('#register-email').closest('form').requestSubmit()`);
  await until(`location.pathname === '/profile' && new URLSearchParams(location.search).get('setup') === 'education'`, 'UI register logs in and opens profile setup', 20000);
  assert.equal((await evaluate(`fetch('/api/auth').then(r => r.json())`)).data?.username, 'ผู้ใช้ QA');
  checks.push('UI registration persisted Thai username in local D1');
  await send('Page.navigate', { url: base + '/' });
  await until(`!!document.querySelector('nav button[aria-label]')`, 'authenticated Home loads after registration');
  const beforeTheme = await evaluate(`document.documentElement.className`);
  await evaluate(`document.querySelector('nav button[aria-label="Toggle Theme"], nav button[aria-label="สลับธีม"]').click()`);
  await until(`document.documentElement.className !== ${JSON.stringify(beforeTheme)}`, 'theme toggles on authenticated Home');
  const beforeLang = await evaluate(`document.documentElement.lang`);
  await evaluate(`document.querySelector('nav button[aria-label="Switch language"], nav button[aria-label="สลับภาษา"]').click()`);
  await until(`document.documentElement.lang !== ${JSON.stringify(beforeLang)}`, 'language toggles on authenticated Home');
  assert(detail.data.template_id, 'Published ranking has a template');
  await send('Page.navigate', { url: base + '/rank?template=' + encodeURIComponent(detail.data.template_id) });
  await until(`[...document.querySelectorAll('.drop-zone')].some(zone => zone.parentElement?.classList.contains('bg-tag')) && !![...document.querySelectorAll('.drop-zone')].find(zone => !zone.parentElement?.classList.contains('bg-tag'))?.querySelector('[data-item-id]')`, 'existing template loads in Rank editor');
  for (let index = 0; index < 2; index++) {
    await evaluate(`(${unrankedItem}).click()`);
    await until(`!!document.querySelector('[role=dialog]')`, 'Rank tier picker opens');
    await evaluate(`document.querySelector('[role=dialog] .grid button').click()`);
    await until(`!document.querySelector('[role=dialog]')`, 'Rank tier picker closes');
  }
  await until(`document.querySelector('.editor-toolbar-float').textContent.includes('2 / 2')`, 'Rank editor assigns both template items');
  await evaluate(`(() => { const button = document.querySelector('.editor-toolbar-float button'); button.click(); button.click(); })()`);
  await until(`location.pathname.startsWith('/post/')`, 'existing-template ranking publishes once', 20000);
  const existingRankingId = await evaluate(`location.pathname.split('/').pop()`);
  const rankedFromTemplate = await fetch(base + '/api/rankings?id=' + encodeURIComponent(existingRankingId)).then(response => response.json());
  assert.equal(rankedFromTemplate.data?.ranking_items?.length, 2);
  assert.equal(rankedFromTemplate.data?.template_id, detail.data.template_id);
  checks.push('existing-template ranking persisted in local D1');
  console.log(JSON.stringify({ checks, rankingId, runtimeErrors, consoleIssues, failedApi, apiRequests: Object.fromEntries(apiRequests) }, null, 2));
  assert.equal(runtimeErrors.length, 0, 'No browser runtime errors');
  assert.equal(consoleIssues.length, 0, 'No browser console errors or warnings');
  assert.equal(failedApi.length, 0, 'No unexpected 5xx API responses');
} finally {
  clearTimeout(timeout);
  ws?.close();
  chrome.kill();
}
