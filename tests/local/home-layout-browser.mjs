// Read-only layout audit. Start `npx wrangler pages dev dist --local --port 8788` first.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const base = process.env.ACCEPTANCE_URL || 'http://127.0.0.1:8788';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Local Pages server required');
const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9349;
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tog-home-layout-'));
const output = '.wrangler/home-layout-refresh';
fs.mkdirSync(output, { recursive: true });
const chrome = spawn(chromePath, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`,
  `--user-data-dir=${profileDir}`, '--no-first-run', '--no-default-browser-check', 'about:blank'],
{ windowsHide: true, stdio: 'ignore' });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let ws;
const errors = [];
const failedApi = [];
const violations = [];
let pulseRequests = 0;
let mockPulse = null;
let checks = 0;
const deadline = setTimeout(() => { console.error('Home layout browser audit timed out'); ws?.close(); chrome.kill(); process.exit(1); }, 360000);

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
    } else if (message.method === 'Runtime.exceptionThrown') {
      errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    } else if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
      errors.push(message.params.args.map(arg => arg.value || arg.description).join(' '));
    } else if (message.method === 'Network.requestWillBeSent' && message.params.request.url.includes('/api/discover-pulse')) {
      pulseRequests++;
    } else if (message.method === 'Network.responseReceived' && message.params.response.status >= 500
      && message.params.response.url.includes('/api/')) {
      failedApi.push({ url: message.params.response.url, status: message.params.response.status });
    } else if (message.method === 'Fetch.requestPaused') {
      const { requestId } = message.params;
      if (mockPulse) {
        const body = Buffer.from(JSON.stringify(mockPulse)).toString('base64');
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
    for (let attempt = 0; attempt < 70; attempt++) {
      if (await evaluate(`!!(${expression})`)) return;
      await delay(100);
    }
    const state = await evaluate(`({ url: location.href, text: document.body?.innerText.slice(0, 300) })`);
    throw new Error(`Timed out waiting for ${expression}: ${JSON.stringify({ state, errors, failedApi })}`);
  };
  await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });

  const sizes = [[320, 568], [375, 812], [390, 844], [768, 1024], [1280, 800], [1440, 900]];
  for (const theme of ['light', 'dark']) for (const language of ['en', 'th']) {
    const script = await send('Page.addScriptToEvaluateOnNewDocument', { source:
      `try { localStorage.setItem('tog-theme', ${JSON.stringify(theme)}); localStorage.setItem('tog-lang', ${JSON.stringify(language)}); } catch {}` });
    for (const [width, height] of sizes) {
      console.log(`Checking ${theme}/${language}/${width}`);
      await send('Page.navigate', { url: 'about:blank' });
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
      pulseRequests = 0;
      await send('Page.navigate', { url: base + '/' });
      await waitFor(`document.querySelector('.home-feed-main') && document.querySelector('button[aria-pressed]')`);
      if (width >= 768) await waitFor(`document.querySelector('.home-pulse-strip')`);
      else await delay(200);
      const result = await evaluate(`(() => {
        const main = document.querySelector('.home-feed-main')?.getBoundingClientRect();
        const strip = document.querySelector('.home-pulse-strip');
        const rail = document.querySelector('.home-pulse-rail')?.getBoundingClientRect();
        return { overflow: document.documentElement.scrollWidth > innerWidth + 1,
          mainWidth: main?.width, mainLeft: main?.left, mainRight: main?.right,
          stripVisible: !!strip && getComputedStyle(strip).display !== 'none',
          topicLinks: strip?.querySelectorAll('a[href]').length || 0,
          railVisible: !!rail && rail.width > 0, railWidth: rail?.width, railLeft: rail?.left,
          railHeading: document.querySelector('#home-pulse-heading')?.textContent.trim(),
          railTitles: [...document.querySelectorAll('.home-pulse-rail h3')].map(node => node.textContent.trim()),
          contentLinks: [...document.querySelectorAll('.home-pulse-rail a[href]')].map(link => link.getAttribute('href')),
          duplicateTopics: [...document.querySelectorAll('.home-pulse-strip a[href]')].some(link =>
            link.getAttribute('href') !== '/discover' && document.querySelector('.home-pulse-rail')?.textContent.includes(link.textContent.trim())),
          clipped: [...document.querySelectorAll('.home-pulse-rail a')].some(link => link.scrollWidth > link.clientWidth + 1),
          leftSidebar: !!document.querySelector('.saved-sticker'), language: document.documentElement.lang };
      })()`);
      const desktop = width >= 768;
      if (result.overflow || result.leftSidebar || result.language !== language
        || !result.mainWidth || result.mainWidth > 761
        || result.stripVisible !== desktop || result.railVisible !== (width >= 1280)
        || (desktop && (result.topicLinks < 2 || pulseRequests !== 1))
        || (!desktop && pulseRequests !== 0)
        || result.duplicateTopics || result.clipped
        || (width >= 1280 && result.railHeading !== (language === 'en' ? 'Community Pulse' : 'ชีพจรชุมชน'))
        || (width >= 1280 && (!result.railTitles.length || !result.contentLinks.some(href =>
          href.startsWith('/post/') || href.startsWith('/template/'))))
        || (width >= 1280 && (result.mainWidth < 720 || result.railWidth < 260
          || result.railWidth > 300 || result.railLeft - result.mainRight < 24))) {
        violations.push({ theme, language, width, result, pulseRequests });
      }
      checks++;
      if ((theme === 'light' && language === 'en' && [768, 1440].includes(width))
        || (theme === 'dark' && language === 'th' && width === 390)) {
        await evaluate(`document.querySelector(${JSON.stringify(width >= 768 ? '.home-pulse-strip' : '.home-feed-main')}).scrollIntoView({ block: 'center' })`);
        await delay(150);
        const shot = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(`${output}/${theme}-${language}-${width}.png`, Buffer.from(shot.data, 'base64'));
      }
    }
    await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: script.identifier });
  }

  await send('Page.navigate', { url: 'about:blank' });
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  pulseRequests = 0;
  await send('Page.navigate', { url: base + '/' });
  await waitFor(`document.querySelector('.home-pulse-rail')`);
  for (const index of [1, 2, 0]) {
    await evaluate(`document.querySelectorAll('button[aria-pressed]')[${index}]?.click()`);
    await waitFor(`document.querySelectorAll('button[aria-pressed]')[${index}]?.getAttribute('aria-pressed') === 'true'`);
  }
  assert.equal(pulseRequests, 1, 'Tab switching must not refetch Discover Pulse');
  await waitFor(`document.querySelector('.home-feed-main .social-card')`);
  await evaluate(`window.scrollTo(0, 1200)`);
  await delay(100);
  const sticky = await evaluate(`({ railTop: document.querySelector('.home-pulse-rail')?.getBoundingClientRect().top,
    asideTop: document.querySelector('.home-pulse-rail')?.closest('aside')?.getBoundingClientRect().top,
    scrollY, scrollHeight: document.documentElement.scrollHeight, innerHeight })`);
  assert(sticky.railTop >= 90 && sticky.railTop <= 105,
    `Right rail must stay sticky below navigation (${JSON.stringify(sticky)})`);
  const firstTopic = await evaluate(`document.querySelector('.home-pulse-strip a[href]:not([href="/discover"])')?.getAttribute('href')`);
  assert(firstTopic?.startsWith('/'), 'A real Pulse topic has an internal destination');
  await evaluate(`document.querySelector('.home-pulse-strip a[href]:not([href="/discover"])').click()`);
  await waitFor(`location.pathname === ${JSON.stringify(firstTopic)}`);

  await send('Fetch.enable', { patterns: [{ urlPattern: '*/api/discover-pulse*' }] });
  const basePulse = { success: true, requested_window: 'now', window: 'now', sampled: false,
    active_rankings: 2, topics: [], rankings: [], discussions: [], templates: [], hashtags: [] };
  const topic = { key: 'tag:gaming', label: '#Gaming', href: '/discover/hashtag/gaming', active_rankings: 2 };
  const ranking = { id: 'ranking-a', title: 'Ranking A', author_name: 'alice', new_ranking: true, comments: 2, reactions: 1 };
  const discussion = { id: 'ranking-b', title: 'Discussion B', author_name: 'bob', comments: 3 };
  const template = { id: 'template-a', title: 'Template A', creator_name: 'carol', active_rankings: 4 };
  const cases = [
    { name: 'rankings + template', data: { topics: [topic], rankings: [ranking], discussions: [ranking], templates: [template] },
      sections: 2, links: ['/post/ranking-a', '/template/template-a'], noDiscussion: true },
    { name: 'unique discussion', data: { rankings: [ranking], discussions: [ranking, discussion], templates: [template] },
      sections: 3, links: ['/post/ranking-a', '/post/ranking-b', '/template/template-a'] },
    { name: 'rankings only', data: { rankings: [ranking] }, sections: 1, links: ['/post/ranking-a'] },
    { name: 'template only', data: { templates: [template] }, sections: 1, links: ['/template/template-a'] },
    { name: 'topics only', data: { topics: [topic] }, sections: 1, links: ['/discover/hashtag/gaming'] },
    { name: 'empty', data: {}, sections: 0, links: [] },
  ];
  const sparse = [];
  for (const testCase of cases) {
    console.log(`Checking sparse case: ${testCase.name}`);
    mockPulse = { ...basePulse, ...testCase.data };
    pulseRequests = 0;
    await send('Page.navigate', { url: 'about:blank' });
    await send('Page.navigate', { url: base + '/' });
    await waitFor(`document.querySelector('.home-feed-main')`);
    if (testCase.sections) await waitFor(`document.querySelector('.home-pulse-rail')`);
    else await delay(350);
    const result = await evaluate(`({ strip: !!document.querySelector('.home-pulse-strip'),
      rail: !!document.querySelector('.home-pulse-rail'),
      asideDisplay: getComputedStyle(document.querySelector('.home-feed-main').nextElementSibling).display,
      sections: document.querySelectorAll('.home-pulse-rail h3').length,
      links: [...document.querySelectorAll('.home-pulse-rail a')].map(link => link.getAttribute('href')),
      text: document.querySelector('.home-pulse-rail')?.textContent,
      width: document.querySelector('.home-feed-main')?.getBoundingClientRect().width })`);
    assert.equal(result.sections, testCase.sections, `${testCase.name}: section count`);
    assert.equal(result.rail, testCase.sections > 0, `${testCase.name}: rail visibility`);
    assert.equal(result.strip, !!testCase.data.topics?.length, `${testCase.name}: strip visibility`);
    assert.equal(pulseRequests, 1, `${testCase.name}: one Pulse request`);
    for (const href of testCase.links) assert(result.links.includes(href), `${testCase.name}: missing ${href}`);
    if (testCase.noDiscussion) assert(!result.text.includes('Discussions'), 'Duplicate discussion is hidden');
    if (testCase.name === 'empty') {
      assert(result.width >= 720, 'Empty Pulse keeps a centered, wide feed');
      assert.equal(result.asideDisplay, 'none', 'Empty Pulse hides aside completely');
    }
    if (testCase.links.length) {
      const href = testCase.links[0];
      await evaluate(`document.querySelector('.home-pulse-rail a[href=${JSON.stringify(href)}]').click()`);
      await waitFor(`location.pathname === ${JSON.stringify(href)}`);
    }
    sparse.push({ name: testCase.name, sections: result.sections, links: result.links, pulseRequests });
  }
  assert.deepEqual(violations, []);
  assert.deepEqual(errors, []);
  assert.deepEqual(failedApi, []);
  console.log(JSON.stringify({ checks, violations, errors, failedApi, sparse,
    interactions: ['tab switching', 'sticky rail', 'hashtag navigation', 'sparse Pulse'], screenshots: output }, null, 2));
} finally {
  clearTimeout(deadline);
  ws?.close();
  chrome.kill();
}
