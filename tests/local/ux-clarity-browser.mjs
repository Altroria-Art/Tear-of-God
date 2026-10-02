// Local, deterministic UI acceptance. All API responses are fixtures.
// UX_CLARITY_PHASE=before records the unchanged baseline without new assertions.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const base = process.env.UI_TEST_URL || 'http://127.0.0.1:8807';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Local server required');
const phase = process.env.UX_CLARITY_PHASE || 'after';
const output = '.wrangler/ux-clarity';
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
const port = 9395;
const chrome = spawn(process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`,
  `--user-data-dir=${fs.mkdtempSync(path.join(os.tmpdir(), 'tog-clarity-'))}`,
  '--no-first-run', '--no-default-browser-check', 'about:blank',
], { windowsHide: true, stdio: 'ignore' });
let ws;
const timeout = setTimeout(() => { ws?.close(); chrome.kill(); console.error('Clarity audit timed out'); process.exit(1); }, 240000);
const errors = [], consoleErrors = [], failedApi = [], measurements = [], interactions = [];
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
      else if (url.pathname === '/api/templates') body.data = url.searchParams.has('id') ? template : [template];
      else if (url.pathname === '/api/rankings') body.data = url.searchParams.has('id') ? ranking : [ranking];
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
    const selector = route === '/create' ? '.quick-add-panel' : route.startsWith('/post/') ? '.post-board' : '.pulse-topic';
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
  await send('Fetch.enable', { patterns: [{ urlPattern: '*/api/*' }] });
  await send('Page.navigate', { url: base }); await waitFor('!!document.querySelector("nav")');
  const sizes = [[1366,768], [1280,800], [1440,900], [768,1024], [820,1180], [390,844], [430,932]];
  for (const lang of ['en', 'th']) for (const theme of ['light', 'dark']) {
    await evaluate(`localStorage.clear(); localStorage.setItem('tog-lang',${JSON.stringify(lang)});localStorage.setItem('tog-theme',${JSON.stringify(theme)})`);
    for (const [width,height] of sizes) for (const page of ['Create', 'Post', 'Discover']) {
      if (page === 'Create') await evaluate(`Object.keys(localStorage).filter(k=>k.includes('draft')).forEach(k=>localStorage.removeItem(k))`);
      await navigate(page === 'Create' ? '/create' : page === 'Post' ? '/post/clarity-post' : '/discover?window=now', width,height);
      const common = await evaluate(`({documentHeight:document.documentElement.scrollHeight,overflow:document.documentElement.scrollWidth>innerWidth+1,lang:document.documentElement.lang})`);
      check(!common.overflow && common.lang === lang, `${page} locale/overflow ${lang}/${theme}/${width}`);
      let geometry;
      if (page === 'Create') {
        geometry = await evaluate(`(() => {const r=s=>document.querySelector(s).getBoundingClientRect();const add=r('.quick-add-panel'),board=r('.create-board'),title=r('.create-publish-panel input'),pub=r('.editor-toolbar-float button');const pool=[...document.querySelectorAll('.create-board h3')][0];const row=document.querySelector('.create-board .bg-tag');return {quickAddTop:add.top,quickAddBottom:add.bottom,unrankedTop:pool.getBoundingClientRect().top,boardTop:board.top,firstTierY:row.getBoundingClientRect().top,titleTop:title.top,publishTop:pub.top,publishBottom:pub.bottom,publishHeight:pub.height,publishColor:getComputedStyle(document.querySelector('.editor-toolbar-float button')).backgroundColor,placeholder:document.querySelector('.quick-add-panel textarea').placeholder,addLabel:document.querySelector('.quick-add-panel button').innerText.trim(),idle:document.querySelector('.editor-toolbar-float').classList.contains('is-idle'),publishDisabled:document.querySelector('.editor-toolbar-float button').disabled,sideBySide:add.left>=board.right-1,minTierHeight:Math.min(...[...document.querySelectorAll('.create-board .bg-tag')].map(n=>n.getBoundingClientRect().height)),instructionCount:document.querySelectorAll('.create-board-hint').length};})()`);
        if (phase !== 'before') {
          check(geometry.placeholder === (lang==='en'?'Thai tea, Matcha, Cocoa':'ชาไทย, มัทฉะ, โกโก้'), 'Concrete localized examples');
          check(geometry.addLabel === (lang==='en'?'Add items':'เพิ่มไอเทม'), 'Localized Add items CTA');
          check(geometry.idle && !geometry.publishDisabled && geometry.publishHeight>=44, 'Idle Publish remains usable with unchanged validation');
          const visual = await publishVisual();
          check(visual.green && visual.darkInk && visual.normalShadow && visual.compact && visual.uploadIcon && visual.target
            && visual.progressOpacity === '0.45', 'Idle Publish inherits the primary button style; only progress is subdued');
          check(geometry.minTierHeight>=72 && geometry.instructionCount===1, 'Usable tiers and one primary empty instruction');
          if(width>=768) {
            check(geometry.sideBySide,'Create retains two columns');
            check(await evaluate(`document.querySelector('.editor-toolbar-float').getBoundingClientRect().right < document.querySelector('.quick-add-panel').getBoundingClientRect().left`),'Publish stays clear of the metadata column');
          }
          check(await evaluate(`[...document.querySelectorAll('.quick-add-panel button, .create-board button')].every(n=>n.getBoundingClientRect().height>=44)`),'Add, pool and tier settings keep 44px targets');
          if(width<768)check(common.documentHeight<2000 && geometry.titleTop<1500,'Meaningfully shorter mobile empty flow');
        }
      } else if(page==='Post') {
        geometry=await evaluate(`(() => {const b=document.querySelector('.post-board').getBoundingClientRect(),input=document.querySelector('main textarea'),comments=input.closest('section').getBoundingClientRect(),about=document.querySelector('.post-about-ticket').getBoundingClientRect();return {rankingBottom:b.bottom,commentsTop:comments.top,aboutTop:about.top,aboutLeft:about.left,rankingRight:b.right,commentForms:document.querySelectorAll('main textarea').length,placeholder:input.placeholder,descriptionTop:document.querySelector('.post-description')?.getBoundingClientRect().top};})()`);
        if(phase!=='before') {
          check(geometry.commentForms===1,'Only one comment form');
          check(geometry.placeholder===(lang==='en'?'Which item would you move — and why?':'คุณจะย้ายไอเทมไหน เพราะอะไร?'),'Tier-neutral localized conversation prompt');
          if(width<1024)check(geometry.rankingBottom<geometry.commentsTop && geometry.commentsTop<geometry.aboutTop,'Single-column discussion before Template');
          else check(geometry.aboutLeft>geometry.rankingRight,'Desktop Template remains beside ranking');
          check(geometry.descriptionTop>=geometry.rankingBottom,'Reason follows ranking');
        }
      } else {
        geometry=await evaluate(`(() => {const r=s=>document.querySelector(s).getBoundingClientRect();const h=r('.pulse-hero'),s=r('.pulse-search'),l=r('.pulse-lead-section'),t=r('.pulse-topic'),ranking=r('.pulse-ranking-grid');return {heroBottom:h.bottom,searchTop:s.top,leadTop:l.top,firstTopicTop:t.top,topicHeight:t.height,firstRankingTop:ranking.top,firstContentSectionTop:document.querySelector('.pulse-ranking-grid').closest('.pulse-section').getBoundingClientRect().top,heroFont:parseFloat(getComputedStyle(document.querySelector('.pulse-hero h1')).fontSize),leadFont:parseFloat(getComputedStyle(document.querySelector('.pulse-lead-section h2')).fontSize),leadText:document.querySelector('.pulse-lead-section h2').innerText,selectedTab:document.querySelector('.pulse-tabs button[aria-pressed=true]').innerText,period:document.querySelector('.pulse-displayed-period')?.innerText,duplicateContext:document.querySelector('.pulse-ranking-card .pulse-card-context')?.innerText};})()`);
        if(phase!=='before') {
          check(geometry.leadFont<geometry.heroFont*.8,'Hero dominates compact lead heading');
          check(geometry.period===(lang==='en'?'Showing: This week':'แสดงข้อมูล: สัปดาห์นี้'),'Fallback displayed period is truthful');
          check(!geometry.duplicateContext,'Identical ranking/template titles are not repeated');
          check(geometry.topicHeight<200,'Compact lead topic');
          if(width===1366)check(geometry.firstContentSectionTop<1000,'Desktop content appears earlier');
          // Thai activity counts wrap onto an extra line in the same five-topic fixture.
          if(width===390)check(geometry.firstContentSectionTop<(lang==='th'?1350:1300),'Mobile content appears earlier');
        }
      }
      measurements.push({page,width,height,lang,theme,...common,...geometry});
      if(theme==='light'&&[390,430,768,1366].includes(width))await shot(`${page.toLowerCase()}-${lang}-${width}`);
      if(phase!=='before'&&lang==='en'&&theme==='light'&&[390,768,1366].includes(width))await shot(`${page.toLowerCase()}-${lang}-${width}-full`,true);
      if(phase!=='before'&&page==='Create'&&[390,430,768,1366].includes(width)) {
        await shot(`publish-idle-${lang}-${theme}-${width}`);
        await evaluate(`(() => { const input = document.querySelector('.quick-add-panel textarea');
          Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(input,'Thai tea, Matcha, Cocoa');
          input.dispatchEvent(new Event('input',{bubbles:true})); })()`);
        await evaluate(`document.querySelector('.quick-add-panel button').click()`);
        await waitFor(`document.querySelectorAll('[data-item-id]').length===3`);
        for(const name of ['Thai tea','Matcha','Cocoa']) {
          await evaluate(`[...document.querySelectorAll('.editor-item-main')].find(n=>n.textContent.includes(${JSON.stringify(name)})).click()`);
          await waitFor(`!!document.querySelector('[role=dialog]')`);
          await evaluate(`[...document.querySelectorAll('[role=dialog] button[aria-label]')].find(n=>n.getAttribute('aria-label').endsWith(' S')).click()`);
          await waitFor(`!document.querySelector('[role=dialog]')`);
        }
        await waitFor(`document.querySelector('.editor-toolbar-float').classList.contains('is-ready')`);
        await evaluate('window.scrollTo(0,0)'); await delay(200);
        const visual = await publishVisual();
        check(visual.green && visual.darkInk && visual.shadow !== 'none' && visual.target && !visual.overflow,
          'Ready Publish stays green, reachable and at least 44px');
        await shot(`publish-ready-${lang}-${theme}-${width}`);
      }
    }
  }
  if(phase!=='before') {
    await evaluate(`localStorage.clear();localStorage.setItem('tog-lang','en')`);
    await navigate('/create',390,844);
    const idleColor=await evaluate(`getComputedStyle(document.querySelector('.editor-toolbar-float button')).backgroundColor`);
    await evaluate(`(()=>{const n=document.querySelector('.quick-add-panel textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(n,'Thai tea, Matcha, Cocoa');n.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await evaluate(`document.querySelector('.quick-add-panel button').click()`);
    await waitFor(`document.querySelectorAll('[data-item-id]').length===3`);
    await waitFor(`document.querySelector('.editor-toolbar-float').classList.contains('is-progress')`);
    check(await evaluate(`getComputedStyle(document.querySelector('.editor-toolbar-float button')).backgroundColor===${JSON.stringify(idleColor)}`),
      'Publish stays green from idle through progress');
    for(const name of ['Thai tea','Matcha','Cocoa']) {
      await evaluate(`[...document.querySelectorAll('.editor-item-main')].find(n=>n.innerText.includes(${JSON.stringify(name)})).click()`);
      await waitFor(`!!document.querySelector('[role=dialog]')`);
      await evaluate(`document.querySelector('[role=dialog] button[aria-label="Move to S"]').click()`);
      await waitFor(`!document.querySelector('[role=dialog]')`);
    }
    check(await evaluate(`document.querySelector('.editor-toolbar-float').classList.contains('is-ready')`),'Assigning all items reaches ready state');
    await delay(650);await navigate('/create',390,844);
    check(await evaluate(`document.querySelectorAll('[data-item-id]').length===3 && document.querySelector('.editor-toolbar-float').classList.contains('is-ready')`),'Draft preserves assigned items on reload');
    interactions.push('Quick Add, tap picker, assignments, Publish idle/progress/ready, draft restore');
    await navigate('/post/clarity-post',390,844);
    const count=commentWrites.length;
    await evaluate(`(()=>{const n=document.querySelector('main textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(n,'Guest test');n.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await evaluate(`document.querySelector('main textarea').form.requestSubmit()`);await delay(150);
    check(commentWrites.length===count,'Guest comment blocked before API submission');
    check(await evaluate(`document.querySelector('main').innerText.includes('Cocoa deserves S.')&&document.querySelector('main').innerText.includes('I prefer matcha.')`),'Parent/reply render');
    await evaluate(`[...document.querySelectorAll('.post-ranking-v2 button')].find(n=>n.title==='Comments'||n.getAttribute('aria-label')==='Comments').click()`);
    await waitFor(`document.activeElement===document.querySelector('main textarea')`);
    check(true,'Comment action focuses the single input');
    viewer={id:'other',username:'Tea fan',role:'user'};await navigate('/post/clarity-post',768,1024);
    // Select Reply by its text in the parent comment, never by global button index.
    await evaluate(`[...document.querySelector('main textarea').closest('section').querySelectorAll('button')].find(n=>n.innerText.trim()==='Reply').click()`);
    await evaluate(`(()=>{const n=document.querySelector('main textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(n,'A local reply');n.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await evaluate(`document.querySelector('main textarea').form.requestSubmit()`);
    await waitFor(`document.querySelector('main').innerText.includes('A local reply')`);
    check(commentWrites.at(-1).parent_id==='comment-parent','Reply keeps parent relationship');
    interactions.push('Existing comments/replies, focus action, guest gate, fixture reply submission');
    viewer=null;await navigate('/discover?window=now',390,844);
    for(const [window,label] of [['today','Today'],['week','This week'],['last_week','Last week'],['now','Now']]) {
      await evaluate(`[...document.querySelectorAll('.pulse-tabs button')].find(n=>n.textContent.trim()===${JSON.stringify(label)}).click()`);
      await waitFor(`new URLSearchParams(location.search).get('window')===${JSON.stringify(window)}&&!document.querySelector('.pulse-topic--skeleton')`);
      check(await evaluate(`document.querySelector('.pulse-tabs button[aria-pressed=true]').textContent.trim()===${JSON.stringify(label)}`),'Requested tab semantics preserved');
      await waitFor(`document.querySelector('.pulse-displayed-period')?.innerText===${JSON.stringify('Showing: '+(window==='now'?'This week':label))}`);
      check(true,'Displayed period follows API effective window');
    }
    await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    check(await evaluate(`getComputedStyle(document.querySelector('.pulse-topic')).transitionDuration.split(',').every(n=>parseFloat(n)<.01)`),'Reduced motion retained');
    interactions.push('All time tabs, requested/effective period, reduced motion');
  }
  const report={phase,checks,measurements,interactions,errors,consoleErrors,failedApi};
  fs.writeFileSync(`${output}/${phase}.json`,JSON.stringify(report,null,2));
  assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[]);assert.deepEqual(failedApi,[]);
  console.log(JSON.stringify({phase,checks,measurements:measurements.length,interactions,errors,consoleErrors,failedApi}));
} catch (error) {
  fs.writeFileSync(`${output}/${phase}-failed.json`, JSON.stringify({ checks, measurements, errors, consoleErrors, failedApi, failure: error.message }, null, 2));
  throw error;
} finally {clearTimeout(timeout);ws?.close();chrome.kill();}
