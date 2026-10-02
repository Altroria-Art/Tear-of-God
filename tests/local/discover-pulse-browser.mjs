// Read-only local Pages/D1 browser audit. Start `npx wrangler pages dev dist --local --port 8788` first.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const base = process.env.ACCEPTANCE_URL || 'http://127.0.0.1:8788';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Local Pages server required');
const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9343;
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tog-discover-pulse-'));
const chrome = spawn(chromePath, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`,
  `--user-data-dir=${profileDir}`, '--no-first-run', '--no-default-browser-check', 'about:blank'],
{ windowsHide: true, stdio: 'ignore' });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const output = 'artifacts/discover-pulse';
fs.mkdirSync(output, { recursive: true });
let ws;
const errors = [];
const consoleErrors = [];
const failedApi = [];
const violations = [];
let mockEmptyPulse = false;
let checks = 0;
const deadline = setTimeout(() => { console.error('Discover Pulse browser audit timed out'); ws?.close(); chrome.kill(); process.exit(1); }, 240000);
const keepAlive = setInterval(() => {}, 1000);
try {
  let targets;
  for (let attempt = 0; attempt < 60; attempt++) {
    try { targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); break; }
    catch { await delay(100); }
  }
  assert(targets?.length, 'Chrome must start');
  ws = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let serial = 0;
  const pending = new Map();
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++serial; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params }));
  });
  ws.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const promise = pending.get(message.id); pending.delete(message.id);
      if (message.error) promise?.reject(message.error); else promise?.resolve(message.result);
    } else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    else if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') consoleErrors.push(message.params.entry.text);
    else if (message.method === 'Network.responseReceived' && message.params.response.status >= 500 && message.params.response.url.includes('/api/')) failedApi.push({ url: message.params.response.url, status: message.params.response.status });
    else if (message.method === 'Fetch.requestPaused') {
      const { requestId } = message.params;
      if (mockEmptyPulse) {
        const body = Buffer.from(JSON.stringify({ success: true, requested_window: 'now', window: 'week', fallback_from: 'now',
          active_rankings: 0, sampled: false, topics: [], rankings: [], discussions: [], hashtags: [], templates: [] })).toString('base64');
        send('Fetch.fulfillRequest', { requestId, responseCode: 200,
          responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body }).catch(error => errors.push(String(error)));
      } else send('Fetch.continueRequest', { requestId }).catch(error => errors.push(String(error)));
    }
  };
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description);
    return result.result?.value;
  };
  const waitFor = async expression => {
    for (let attempt = 0; attempt < 60; attempt++) { if (await evaluate(`!!(${expression})`)) return; await delay(100); }
    throw new Error(`Timed out waiting for ${expression}`);
  };
  await send('Runtime.enable'); await send('Page.enable'); await send('Log.enable'); await send('Network.enable');
  for (const theme of ['light', 'dark']) {
    for (const language of ['en', 'th']) {
      await send('Page.navigate', { url: base + '/' });
      // Initial Thai loading must finish before setting the next case's locale;
      // otherwise prepareInitialLanguage can overwrite the storage write.
      await waitFor(`document.readyState === 'complete' && !!document.querySelector('nav')`);
      await evaluate(`localStorage.setItem('tog-theme', ${JSON.stringify(theme)}); localStorage.setItem('tog-lang', ${JSON.stringify(language)});`);
      for (const window of ['now', 'today', 'week', 'last_week']) {
        await send('Page.navigate', { url: `${base}/discover?window=${window}` });
        await waitFor(`document.querySelector('.pulse-lead-section') && !document.querySelector('.pulse-topic--skeleton') && (document.querySelector('.pulse-topic') || document.querySelector('.pulse-empty'))`);
        await waitFor(`document.documentElement.lang === ${JSON.stringify(language)}`);
        for (const width of [320, 390, 768, 1366, 1440]) {
          await send('Emulation.setDeviceMetricsOverride', { width, height: width === 390 ? 844 : width === 1366 ? 768 : 900, deviceScaleFactor: 1, mobile: false });
          await delay(40);
          const result = await evaluate(`({ overflow: document.documentElement.scrollWidth > innerWidth + 1,
            lang: document.documentElement.lang, hero: document.querySelector('.pulse-hero h1')?.textContent,
            tab: document.querySelector('.pulse-tabs button[aria-pressed=true]')?.textContent.trim(),
            topics: document.querySelectorAll('.pulse-topic:not(.pulse-topic--skeleton)').length })`);
          if (result.overflow || result.lang !== language || !result.hero || !result.tab) violations.push({ theme, language, window, width, result });
          checks++;
          if (['now', 'last_week'].includes(window) && [390, 1366, 1440].includes(width)) {
            const screenshot = await send('Page.captureScreenshot', { format: 'png' });
            fs.writeFileSync(`${output}/${theme}-${language}-${window}-${width}.png`, Buffer.from(screenshot.data, 'base64'));
          }
          if (theme === 'light' && language === 'en' && window === 'week' && [390, 1440].includes(width)) {
            const { cssContentSize } = await send('Page.getLayoutMetrics');
            const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true,
              clip: { x: 0, y: 0, width, height: cssContentSize.height, scale: 1 } });
            fs.writeFileSync(`${output}/light-en-week-${width}-full.png`, Buffer.from(screenshot.data, 'base64'));
          }
        }
      }
    }
  }
  await send('Page.navigate', { url: base + '/discover?window=now' });
  await waitFor(`!!document.querySelector('.pulse-topic:not(.pulse-topic--skeleton)')`);
  await evaluate(`document.querySelectorAll('.pulse-tabs button')[1].click()`);
  await waitFor(`new URLSearchParams(location.search).get('window') === 'today' && !!document.querySelector('.pulse-tabs button:nth-child(2)[aria-pressed=true]')`);
  await waitFor(`!!document.querySelector('.pulse-topic:not(.pulse-topic--skeleton)')`);
  assert(await evaluate(`!!document.querySelector('.pulse-topic:not(.pulse-topic--skeleton)')`), 'Today tab loads real Pulse cards');
  const topicHref = await evaluate(`document.querySelector('.pulse-topic')?.getAttribute('href')`);
  assert(topicHref?.startsWith('/discover/hashtag/') || topicHref?.startsWith('/template/') || topicHref?.startsWith('/post/'));
  await evaluate(`document.querySelector('.pulse-topic').click()`);
  await waitFor(`location.pathname !== '/discover'`);
  assert.equal(await evaluate(`location.pathname`), topicHref);

  await send('Page.navigate', { url: base + '/discover' });
  await waitFor(`!!document.querySelector('.pulse-search input')`);
  await evaluate(`(() => { const input = document.querySelector('.pulse-search input');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'coffee');
    input.dispatchEvent(new Event('input', { bubbles: true })); input.form.requestSubmit(); })()`);
  await waitFor(`new URLSearchParams(location.search).get('q') === 'coffee'`);
  assert(await evaluate(`!document.querySelector('.pulse-lead-section')`), 'Search has a focused results layout');
  await send('Page.navigate', { url: base + '/discover?view=saved' });
  await waitFor(`!!document.querySelector('.pulse-results-intro')`);
  assert(await evaluate(`!document.querySelector('.pulse-lead-section')`), 'Saved templates keep a focused results layout');
  await send('Page.navigate', { url: base + '/discover?window=now' });
  await waitFor(`!!document.querySelector('.pulse-topic:not(.pulse-topic--skeleton)')`);
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  assert(await evaluate(`getComputedStyle(document.querySelector('.pulse-topic')).transitionDuration.split(',').every(value => parseFloat(value) < .01)`), 'Reduced motion removes topic transitions');
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  await evaluate(`localStorage.setItem('tog-theme', 'light'); localStorage.setItem('tog-lang', 'en')`);
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  mockEmptyPulse = true;
  await send('Fetch.enable', { patterns: [{ urlPattern: '*/api/discover-pulse*' }] });
  await send('Page.navigate', { url: base + '/discover?window=now' });
  await waitFor(`!!document.querySelector('.pulse-empty strong')`);
  assert(await evaluate(`!document.querySelector('.pulse-topic') && !document.querySelector('.pulse-fallback') && document.documentElement.scrollWidth <= innerWidth + 1`), 'Empty Pulse makes no false activity claim and has no mobile overflow');
  const emptyShot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(`${output}/light-en-empty-390.png`, Buffer.from(emptyShot.data, 'base64'));
  const report = { checks, violations, errors, consoleErrors, failedApi, interactions: ['window switching', 'topic click-through', 'search', 'saved view', 'reduced motion', 'empty/low activity'] };
  fs.writeFileSync(`${output}/audit.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  assert.deepEqual(violations, []);
  assert.deepEqual(errors, []);
  assert.deepEqual(consoleErrors, []);
  assert.deepEqual(failedApi, []);
} finally { clearTimeout(deadline); clearInterval(keepAlive); ws?.close(); chrome.kill(); }
