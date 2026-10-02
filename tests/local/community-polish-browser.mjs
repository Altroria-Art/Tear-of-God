// Local, deterministic UI acceptance. All API responses are fixtures.
// COMMUNITY_PHASE=before captures comparison images without feature assertions.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const base = process.env.UI_TEST_URL || 'http://127.0.0.1:8807';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Local server required');
const phase = process.env.COMMUNITY_PHASE || 'after';
const output = '.wrangler/community-polish';
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
const port = 9399;
const chrome = spawn(process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`,
  `--user-data-dir=${fs.mkdtempSync(path.join(os.tmpdir(), 'tog-clarity-'))}`,
  '--no-first-run', '--no-default-browser-check', 'about:blank',
], { windowsHide: true, stdio: 'ignore' });
let ws;
const timeout = setTimeout(() => { ws?.close(); chrome.kill(); console.error('Clarity audit timed out'); process.exit(1); }, 240000);
const errors = [], consoleErrors = [], failedApi = [], measurements = [];
let viewer = null, checks = 0, metric = 0;
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
      else if (url.pathname === '/api/templates') body.data = url.searchParams.has('id') ? {...template,use_count:metric,view_count:metric,stats:{uses:metric,views:metric}} : (url.searchParams.has('saved') && !metric ? [] : [{...template,use_count:metric,view_count:metric}]);
      else if (url.pathname === '/api/rankings') body.data = url.searchParams.has('id') ? {...ranking,stats:{likes:metric,dislikes:0,comments:metric}} : Array.from({length:metric},(_,i)=>({...ranking,id:'ranking-'+i,stats:{likes:metric,dislikes:0,comments:metric}}));
      else if (url.pathname === '/api/users') body.data = {...person,bio:metric?'Drinks, games and strong opinions.':'',posts_count:metric,likes_received:metric,followers_count:0,following_count:0,created_at:'2026-01-01 00:00:00',taste_identity:{badges:[],hashtag_distribution:[],top_items:[],pinned_rankings:metric?[{id:'ranking-0',ranking_id:'ranking-0'}]:[]}};
      else if (url.pathname === '/api/notifications') {body.data=Array.from({length:metric},(_,i)=>({id:'notice-'+i,type:i?'follow':'template_use',actor_username:'Tea fan',template_title:'Our drinks',template_id:template.id,is_read:!!i,created_at:'2026-10-01 00:00:00'}));body.unreadCount=metric?1:0;}
      else if (url.pathname === '/api/discover-pulse') body = pulseFor(url.searchParams.get('window') || 'now');
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
    const selector = route === '/create' ? '.quick-add-panel' : route.startsWith('/post/') ? '.post-board' : route.startsWith('/profile') ? '.taste-passport-v2 h2' : route.startsWith('/template') ? '.template-page' : route === '/discover/templates' ? '.template-card-preview' : route.startsWith('/discover') ? '.pulse-results-head' : '#home-feed';
    await waitFor(`!!document.querySelector(${JSON.stringify(selector)})`);
    await evaluate('window.scrollTo(0,0)'); await delay(250);
    check(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),route+' fits viewport');
  };
  const shot = async (name, full = false) => {
    const clip = full ? await evaluate('({x:0,y:0,width:innerWidth,height:document.documentElement.scrollHeight,scale:1})') : undefined;
    const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: full, ...(clip ? { clip } : {}) });
    fs.writeFileSync(`${output}/${phase}-${name}.png`, Buffer.from(r.data, 'base64'));
  };
  await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Fetch.enable',{patterns:[{urlPattern:'*/api/*'}]});
  await send('Page.navigate',{url:base});await waitFor('!!document.querySelector("nav")');
  const cases=[['en','light',1366,768,1],['th','dark',1280,800,1],['en','dark',1440,900,1],['th','light',768,1024,1],['en','dark',820,1180,1],['en','light',390,844,1],['th','dark',430,932,1],['en','light',390,844,0],['th','dark',1366,768,0],['th','light',390,844,2],['en','dark',1366,768,2]];
  for(const [lang,theme,width,height,count] of cases){
    metric=count;viewer={id:'fixture-viewer',username:'Viewer'};
    await evaluate(`localStorage.clear();localStorage.setItem('tog-lang',${JSON.stringify(lang)});localStorage.setItem('tog-theme',${JSON.stringify(theme)})`);
    for(const owner of [false,true]) {
      viewer=owner?{...person}:{id:'fixture-viewer',username:'Viewer'};
      await navigate('/profile/'+person.id,width,height);await delay(250);
      const profile=await evaluate(`(()=>{const n=document.querySelector('.taste-passport-v2'),bio=n.querySelector('.profile-bio'),follow=n.querySelector('.profile-follow'),grid=document.querySelector('.profile-ranking-grid'),empty=document.querySelector('.profile-rankings-empty'),taste=document.querySelector('.taste-snapshot-mobile');return {overflow:document.documentElement.scrollWidth>innerWidth+1,text:n.textContent,follow:!!follow,edit:[...n.querySelectorAll('button')].some(n=>n.textContent.includes(${JSON.stringify(lang==='en'?'Edit Profile':'แก้ไขโปรไฟล์')})),bioTop:bio?.getBoundingClientRect().top,followTop:follow?.getBoundingClientRect().top,tasteTop:taste?.getBoundingClientRect().top,rankTop:(grid||empty)?.getBoundingClientRect().top,emptyText:empty?.textContent,tiles:document.querySelectorAll('.profile-ranking-tile').length,totalLikeText:document.querySelector('.profile-social-total')?.textContent,followers:[...n.querySelectorAll('button')].filter(n=>n.textContent.includes(${JSON.stringify(lang==='en'?'Followers':'ผู้ติดตาม')})).map(n=>n.textContent)};})()`);
      check(!profile.overflow,'Profile fits viewport');measurements.push({page:'Profile',owner,lang,theme,width,count,...profile});
      if(phase!=='before'){
        check(profile.follow===!owner&&profile.edit===owner,'Profile owner/Follow affordances');
        if(!owner&&count)check(profile.bioTop<profile.followTop,'Bio precedes social stats/action');
        if(!owner)check(await evaluate(`document.querySelector('.profile-follow').getBoundingClientRect().height>=44`),'Follow touch target');
        if(width<1024)check(profile.rankTop<profile.tasteTop,'Ranking content before mobile Taste');
        if(!count)check(!profile.totalLikeText&&profile.emptyText?.includes(lang==='en'?'No rankings yet':'ยังไม่มีการจัดอันดับ'),'Sparse Profile has no passive zero likes');
        if(count)check(profile.totalLikeText?.includes(String(count)),'Populated Profile likes retained');
        check(profile.followers[0]?.includes('0'),'Interactive follower zero retained');
      }
      if(!owner&&lang==='en'&&theme==='light'&&[390,1366].includes(width)&&count<=1)await shot(`profile-${count?'populated':'sparse'}-${width}`);
    }
    viewer={id:'fixture-viewer',username:'Viewer'};
    await navigate('/discover?view=saved',width,height);await delay(200);
    if(phase!=='before')check(await evaluate(`!!document.querySelector('.personality-empty')===${!count}`),'Saved empty vs populated');
    const badges=await evaluate(`[...document.querySelectorAll('.template-card-metrics span')].map(n=>n.textContent.trim())`);
    if(phase!=='before'&&count)check(badges.length===2&&badges.every(n=>n.includes(String(count))),'Populated template metadata remains');
    if(!count&&width===390&&lang==='en')await shot('saved-empty-390');
    await navigate('/discover/templates',width,height);await waitFor('!!document.querySelector(".template-card-preview")');
    if(phase!=='before'){
      const card=await evaluate(`({height:document.querySelector('.template-card-preview').getBoundingClientRect().height,metrics:[...document.querySelectorAll('.template-card-metrics span')].map(n=>n.textContent.trim())})`);
      check(card.height===176,'Template preview reserves constant height');
      check(count?card.metrics.length===2:card.metrics.length===0,'Passive template zero metrics omitted');
    }
    await navigate('/template/'+template.id,width,height);await delay(250);
    const metadata=await evaluate(`({text:document.querySelector('.template-social-metadata')?.textContent,views:!!document.querySelector('.template-view-count'),viewText:document.querySelector('.template-view-count')?.textContent})`);
    if(phase!=='before')check(count?metadata.views:!metadata.views&&metadata.text?.includes(lang==='en'?'Be the first to rank this':'ลองจัดอันดับเป็นคนแรก'),'Template zero is invitation; populated stats retained');
    if(phase!=='before'&&lang==='en'&&count)check(metadata.text.trim()===(count===1?'1 Use':'2 Uses')&&metadata.viewText.trim()===(count===1?'1 View':'2 Views'),'Template singular/plural');
    if(width===390&&lang==='en'&&count===1)await shot('template-390');
    if(phase!=='before'&&width===390&&lang==='en'&&!count)await shot('template-zero-390');
    await navigate('/post/'+ranking.id,width,height);if(width===390&&lang==='en'&&count===1)await shot('post-390');
    await navigate('/',width,height);await evaluate(`[...document.querySelectorAll('#home-feed button')].find(n=>n.textContent.trim()===${JSON.stringify(lang==='en'?'Following':'กำลังติดตาม')}).click()`);await delay(200);
    check(await evaluate(`!!document.querySelector('.following-empty')===${!count}`),'Following empty vs populated');
    if(!count&&width===390&&lang==='en')await shot('following-empty-390');
    await evaluate(`document.querySelector('button[aria-label=${JSON.stringify(lang==='en'?'Notifications':'การแจ้งเตือน')} ]').click()`);await delay(200);
    check(await evaluate(`!!document.querySelector('.notification-empty')===${!count}`),'Notifications empty vs unread/read fixtures');
    if(count)check(await evaluate(`document.querySelectorAll('.notification-sheet button[aria-label="'+${JSON.stringify(lang==='en'?'Delete notification':'ลบการแจ้งเตือน')}+'"]').length===${count}&&document.querySelectorAll('.notification-sheet span[aria-label="'+${JSON.stringify(lang==='en'?'New notification':'การแจ้งเตือนใหม่')}+'"]').length===1`),'Read/unread rows and delete controls remain');
    if(!count&&width===390&&lang==='en')await shot('notifications-empty-390');
    check(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'Community pages fit viewport');
    viewer=null;await navigate('/discover?view=saved',width,height);check(await evaluate(`!document.querySelector('.pulse-results-head [role=status]').textContent.includes('0')`),'Guest Saved no false zero');
  }
  const report={phase,checks,measurements,errors,consoleErrors,failedApi};fs.writeFileSync(`${output}/${phase}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({phase,checks,errors,consoleErrors,failedApi}));assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[]);assert.deepEqual(failedApi,[]);
}finally{clearTimeout(timeout);ws?.close();chrome.kill();}
