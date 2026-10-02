// Local, deterministic UI acceptance. All API responses are fixtures.
// PERSONALITY_PHASE=before captures comparison images without feature assertions.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const base = process.env.UI_TEST_URL || 'http://127.0.0.1:8807';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Local server required');
const phase = process.env.PERSONALITY_PHASE || 'after';
const output = '.wrangler/visual-personality';
fs.mkdirSync(output, { recursive: true });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const tiers = ['S', 'A', 'B', 'C', 'D'].map((label, index) => ({ label, color: ['#ff7f7f', '#ffbf7f', '#ffff7f', '#7fff7f', '#7fbfff'][index] }));
const person = { id: 'clarity-user', username: 'Drink club' };
const items = Array.from({ length: 18 }, (_, index) => ({ item_id: `drink-${index}`, tier: tiers[index % 5].label,
  item: { name: `Drink ${index + 1}` } }));
const template = { id: 'clarity-template', title: 'Our drinks', description: '', hashtags: '#Drinks,#Food',
  profile: person, creator_id: person.id, tiers, template_items: items, stats: { uses: 8, views: 12 } };
const ranking = { ...template, id: 'clarity-post', template_id: template.id, user_id: person.id,
  description: 'Matcha wins for its taste.', created_at: '2026-10-01 00:00:00', ranking_items: items,
  stats: { likes: 1, dislikes: 0, comments: 2 }, comments: [
    { id: 'comment-parent', user_id: person.id, username: person.username, content: 'Cocoa deserves S.', created_at: '2026-10-01 01:00:00', parent_id: null },
    { id: 'comment-reply', user_id: 'other', username: 'Tea fan', content: 'I prefer matcha.', created_at: '2026-10-01 02:00:00', parent_id: 'comment-parent' },
  ] };
const pulseFor = requested => ({ success: true, requested_window: requested, window: requested === 'now' ? 'week' : requested,
  fallback_from: requested === 'now' ? 'now' : null, active_rankings: 5, sampled: false,
  topics: ['Drinks', 'Food', 'Gaming', 'Music', 'Movies'].map((label, i) => ({ key: label.toLowerCase(), label: `#${label}`,
    href: `/discover/hashtag/${label.toLowerCase()}`, ranking_count: i + 1, comments: 1, reactions: 1,
    preview_rankings: [{ title: template.title }] })),
  rankings: Array.from({ length: 4 }, (_, i) => ({ id: `ranking-${i}`, title: template.title, template_title: template.title,
    new_ranking: true, comments: 1, reactions: 1 })), discussions: [], hashtags: [], templates: [] });
const port = 9396;
const chrome = spawn(process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`,
  `--user-data-dir=${fs.mkdtempSync(path.join(os.tmpdir(), 'tog-clarity-'))}`,
  '--no-first-run', '--no-default-browser-check', 'about:blank',
], { windowsHide: true, stdio: 'ignore' });
let ws;
const timeout = setTimeout(() => { ws?.close(); chrome.kill(); console.error('Clarity audit timed out'); process.exit(1); }, 240000);
const errors = [], consoleErrors = [], failedApi = [], measurements = [];
const commentWrites = [];
let viewer = null, checks = 0;
try {
  let targets;
  for (let i = 0; i < 60; i++) {
    try { targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); break; } catch { await delay(100); }
  }
  assert(targets?.length, 'Chrome starts');
  ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let serial = 0;
  const pending = new Map();
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++serial; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params }));
  });
  ws.onmessage = async event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const p = pending.get(message.id); pending.delete(message.id);
      if (message.error) p?.reject(message.error); else p?.resolve(message.result);
    } else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    else if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') consoleErrors.push(message.params.args.map(a => a.value || a.description).join(' '));
    else if (message.method === 'Network.responseReceived' && message.params.response.url.includes('/api/') && message.params.response.status >= 500) failedApi.push(message.params.response.url);
    else if (message.method === 'Fetch.requestPaused') {
      const { requestId, request } = message.params;
      const url = new URL(request.url);
      let body = { success: true, data: [], total: 0, hasMore: false };
      if (url.pathname === '/api/auth') body.data = viewer;
      else if (url.pathname === '/api/templates') body.data = url.searchParams.has('id') ? template : (url.searchParams.has('saved') ? [] : [template]);
      else if (url.pathname === '/api/rankings') body.data = url.searchParams.has('id') ? ranking : (url.searchParams.get('feed_type') === 'following' ? [] : [ranking]);
      else if (url.pathname === '/api/users') body.data = person;
      else if (url.pathname === '/api/discover-pulse') body = pulseFor(url.searchParams.get('window') || 'now');
      else if (url.pathname === '/api/comments' && request.method === 'POST') {
        const payload = JSON.parse(request.postData); commentWrites.push(payload);
        body.data = { id: 'fixture-submitted', ...payload, username: viewer.username, created_at: '2026-10-01 03:00:00' };
      }
      await send('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
        body: Buffer.from(JSON.stringify(body)).toString('base64') });
    }
  };
  const evaluate = async expression => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description);
    return r.result?.value;
  };
  const waitFor = async (expression, label = expression) => {
    for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await delay(50); }
    throw new Error(`Timed out: ${label}`);
  };
  const check = (ok, label) => { assert(ok, label); checks++; };
  const navigate = async (route, width, height) => {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 768 });
    await send('Page.navigate', { url: base + route });
    const selector = route === '/create' ? '.quick-add-panel' : route.startsWith('/post/') ? '.post-board' : route.startsWith('/login') ? '.auth-v2' : route.startsWith('/discover') ? '.pulse-results-head' : '#home-feed';
    await waitFor(`!!document.querySelector(${JSON.stringify(selector)})`);
    await evaluate('window.scrollTo(0,0)'); await delay(250);
  };
  const shot = async (name, full = false) => {
    const clip = full ? await evaluate('({x:0,y:0,width:innerWidth,height:document.documentElement.scrollHeight,scale:1})') : undefined;
    const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: full, ...(clip ? { clip } : {}) });
    fs.writeFileSync(`${output}/${phase}-${name}.png`, Buffer.from(r.data, 'base64'));
  };
  const publishVisual = async () => evaluate(`(() => {
    const button = document.querySelector('.editor-toolbar-float button');
    const reference = document.createElement('button');
    reference.className = 'play-button';
    reference.style.cssText = 'position:fixed;left:-9999px;visibility:hidden';
    document.body.append(reference);
    const style = getComputedStyle(button), normal = getComputedStyle(reference);
    const rect = button.getBoundingClientRect();
    const result = {
      green: style.backgroundColor === normal.backgroundColor,
      darkInk: style.color === normal.color && style.borderTopColor === normal.borderTopColor,
      normalShadow: style.boxShadow === normal.boxShadow && style.boxShadow !== 'none',
      shadow: style.boxShadow, compact: parseFloat(style.borderRadius) < 10,
      uploadIcon: !!button.querySelector('svg.lucide-upload'),
      target: rect.height >= 44 && rect.width >= 44 && rect.bottom <= innerHeight
        && button.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)),
      progressOpacity: getComputedStyle(document.querySelector('.editor-progress')).opacity,
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
    };
    reference.remove();
    return result;
  })()`);
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Fetch.enable', {patterns:[{urlPattern:'*/api/*'}]});
  await send('Page.navigate',{url:base});await waitFor('!!document.querySelector("nav")');
  const mascotCheck=async()=>check(await evaluate(`[...document.querySelectorAll('.tear-mascot')].every(n=>n.getAttribute('aria-hidden')==='true'&&n.getAttribute('focusable')==='false'&&!n.hasAttribute('tabindex'))`),'Decorative mascot accessibility');
  for(const [lang,theme,width,height] of [['en','light',390,844],['th','dark',430,932],['en','dark',768,1024],['th','light',820,1180],['en','light',1366,768],['en','dark',1366,768],['th','dark',1280,800],['en','dark',1440,900]]) {
    viewer=null;
    await evaluate(`localStorage.clear();localStorage.setItem('tog-lang',${JSON.stringify(lang)});localStorage.setItem('tog-theme',${JSON.stringify(theme)})`);
    await navigate('/create',width,height);
    const documentHeight=await evaluate('document.documentElement.scrollHeight');
    measurements.push({page:'Create',lang,theme,width,documentHeight});
    if(width===390||width===768)await shot(`create-${lang}-${theme}-${width}`,true);
    if(phase!=='before'){
      check(await evaluate(`document.querySelectorAll('.quick-add-panel .tear-mascot').length===1`),'Empty Create has mascot');
      await mascotCheck();const visual=await publishVisual();check(visual.green&&visual.darkInk&&visual.normalShadow&&visual.uploadIcon&&visual.target,'Publish unchanged');
      // Observed exact-main baseline; use a height budget, not screenshot matching.
      const baselineHeight=({390:1873,430:1818,768:1332,820:1332,1366:1238,1280:1235,1440:1240})[width];
      check(documentHeight<=baselineHeight+8,'Empty Create height unchanged');
      await evaluate(`(()=>{const n=document.querySelector('.quick-add-panel textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(n,'Matcha, Cocoa, Tea');n.dispatchEvent(new Event('input',{bubbles:true}));})()`);
      await evaluate(`document.querySelector('.quick-add-panel button').click()`);
      await waitFor(`document.querySelectorAll('.create-unranked .editor-item').length===3`);
      check(await evaluate(`!document.querySelector('.quick-add-panel .tear-mascot')&&!document.querySelector('.create-board-hint')`),'Helper disappears after items');
      check(await evaluate(`document.querySelector('.create-unranked').classList.contains('first-items-arrived')`),'First batch feedback points to Unranked');
      await delay(450);
      check(await evaluate(`(()=>{const n=document.querySelector('.create-unranked'),s=getComputedStyle(n);return s.animationName==='first-items-arrived'&&s.animationIterationCount==='1'&&n.getAnimations().length===0;})()`),'First feedback completes once');
      await evaluate(`(()=>{const n=document.querySelector('.quick-add-panel textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(n,'Coffee');n.dispatchEvent(new Event('input',{bubbles:true}));})()`);
      await evaluate(`document.querySelector('.quick-add-panel button').click()`);
      await waitFor(`document.querySelectorAll('.create-unranked .editor-item').length===4`);
      check(await evaluate(`document.querySelector('.create-unranked').getAnimations().length===0`),'Later batches do not replay first-item feedback');
      await evaluate(`document.querySelector('.editor-item button').click()`);await waitFor(`!!document.querySelector('[role=dialog]')`);await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});
      await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
      check(await evaluate(`getComputedStyle(document.querySelector('.create-unranked')).animationName==='none'`),'Reduced motion has no first item animation');
      await send('Emulation.setEmulatedMedia',{features:[]});
    }
    for(const mode of ['login','signup']){
      await navigate(`/login?mode=${mode}`,width,height);await delay(650);
      if(width===1366)await shot(`${mode}-${lang}-${theme}-${width}`);
      if(phase!=='before'){
        await mascotCheck();check(await evaluate(`document.querySelectorAll('.auth-tear-scene .tear-mascot').length===2`),'Both auth poses exist in inert-aware panels');
        check(await evaluate(`innerWidth>=1024||getComputedStyle(document.querySelector('.auth-tear-scene').closest('.hidden')).display==='none'`),'Auth art hidden on mobile/tablet');
      }
      check(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'Auth no overflow');
      if(width>=1024)check(await evaluate(`(()=>{const n=[...document.querySelectorAll('.auth-tear-scene')].find(n=>!n.closest('[inert]')),panel=n.closest('.hidden'),r=n.getBoundingClientRect(),p=panel.getBoundingClientRect();return r.top>=p.top&&r.bottom<=p.bottom&&r.left>=p.left&&r.right<=p.right;})()`),'Visible auth art fits decorative panel');
    }
    viewer={id:'personality-user',username:'Local fixture'};
    await navigate('/discover?view=saved',width,height);await delay(350);
    if(width===390||width===1366)await shot(`saved-${lang}-${theme}-${width}`);
    if(phase!=='before'){
      check(await evaluate(`!!document.querySelector('.personality-empty .tear-mascot')&&document.querySelector('.personality-empty a').getAttribute('href')==='/discover/templates'`),'Authenticated Saved mascot and useful CTA');await mascotCheck();
    }
    await navigate('/',width,height);await delay(350);
    check(await evaluate(`!document.querySelector('.play-header .tear-mascot')`),'No Home hero mascot');
    await evaluate(`[...document.querySelectorAll('button')].find(n=>n.textContent.trim()===${JSON.stringify(lang==='en'?'Following':'กำลังติดตาม')})?.click()`);await delay(400);
    if(width===390)await shot(`following-${lang}-${theme}-${width}`);
    if(phase!=='before')check(await evaluate(`!!document.querySelector('.following-empty .tear-mascot')`),'Authenticated Following mascot');
    await evaluate(`document.querySelector('button[aria-label=${JSON.stringify(lang==='en'?'Notifications':'การแจ้งเตือน')} ]')?.click()`);await delay(250);
    if(width===390)await shot(`notifications-${lang}-${theme}-${width}`);
    if(phase!=='before')check(await evaluate(`!!document.querySelector('.notification-sheet .tear-mascot')`),'Notifications mascot');
    check(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'Empty states no overflow');
    viewer=null;await navigate('/discover?view=saved',width,height);await delay(250);
    check(await evaluate(`!document.querySelector('.personality-empty .tear-mascot')`),'Guest Saved is login explanation');
    if(phase!=='before')check(await evaluate(`!document.querySelector('.pulse-results-head [role=status]').textContent.includes('0')`),'Guest does not show false saved zero');
    await navigate('/',width,height);await delay(200);await evaluate(`[...document.querySelectorAll('button')].find(n=>n.textContent.trim()===${JSON.stringify(lang==='en'?'Following':'กำลังติดตาม')})?.click()`);await delay(250);
    check(await evaluate(`!document.querySelector('.following-empty .tear-mascot')`),'Guest Following unchanged');
  }
  const report={phase,checks,measurements,errors,consoleErrors,failedApi};
  fs.writeFileSync(`${output}/${phase}.json`,JSON.stringify(report,null,2));
  assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[]);assert.deepEqual(failedApi,[]);
  console.log(JSON.stringify(report));
} catch(error){fs.writeFileSync(`${output}/${phase}-failed.json`,JSON.stringify({checks,measurements,errors,consoleErrors,failedApi,failure:error.message},null,2));throw error;}
finally{clearTimeout(timeout);ws?.close();chrome.kill();}
