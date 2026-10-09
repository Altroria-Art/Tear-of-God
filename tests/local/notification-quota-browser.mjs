// Built UI and real Pages Functions/D1, with an accelerated browser polling clock.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { digest, randomToken } from '../../functions/lib/session.js';
import { chromium, delay } from './helpers/chromium.mjs';

const base = process.env.BROWSER_QA_URL;
const state = path.resolve(process.env.BROWSER_QA_STATE || '');
assert(base && ['localhost', '127.0.0.1'].includes(new URL(base).hostname));
assert(state.startsWith(path.join(process.cwd(), '.wrangler', 'browser-qa-')) && state.endsWith(path.sep + 'state'));
const output = path.dirname(state);
const prefix = 'quota-' + crypto.randomUUID();
const tokens = Array.from({ length: 4 }, () => randomToken());
const sqlQuote = v => `'${String(v).replaceAll("'", "''")}'`;
const sql = [];
for (let i = 0; i < 4; i++) {
  sql.push(`INSERT INTO profiles(id,username) VALUES (${sqlQuote(prefix + i)},${sqlQuote('Quota Reader ' + i)});`);
}
const topic = prefix + '-topic';
sql.push(`INSERT INTO templates(id,creator_id,title,tiers) VALUES (${sqlQuote(topic)},${sqlQuote(prefix+'0')},'Quota Community','[{"label":"S","color":"#ff6b6b"}]');`);
sql.push(`INSERT INTO template_comments(id,template_id,user_id,content) VALUES (${sqlQuote(prefix+'-comment')},${sqlQuote(topic)},${sqlQuote(prefix+'0')},'Quota discussion fixture');`);
for (let i = 0; i < 4; i++) sql.push(`INSERT INTO template_reactions(id,template_id,user_id,vote_type) VALUES (${sqlQuote(prefix+'-vote'+i)},${sqlQuote(topic)},${sqlQuote(prefix+i)},${sqlQuote(i%2?'dislike':'like')});`);
for (let i = 0; i < 4; i++) {
  sql.push(`INSERT INTO auth_sessions(token_hash,user_id,expires_at) VALUES (${sqlQuote(await digest(tokens[i]))},${sqlQuote(prefix + i)},${Date.now() + 600000});`);
  for (let n = 0; n < (i % 2 ? 2 : 50); n++) sql.push(`INSERT INTO notifications(id,user_id,type,actor_id) VALUES (${sqlQuote(prefix + i + '-' + n)},${sqlQuote(prefix + i)},'comment',${sqlQuote(prefix + (i % 2 ? i-1 : i+1))});`);
}
fs.mkdirSync(output, { recursive: true });
const file = path.join(output, 'notification-fixture.sql');
fs.writeFileSync(file, sql.join('\n'));
execFileSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'd1', 'execute', 'tear-of-god-db', '--local', '--persist-to', state, '--file', file], { windowsHide: true, stdio: 'pipe' });
const browser = await chromium({ port: 9381 });
const checks = [];
try {
  for (const [width, identity] of [[390, 0], [1440, 2]]) {
    const page = await browser.page();
    await page.viewport(width);
    // Only long polling/retry timers are accelerated. Network, React and short
    // UI timers use the real browser clock; no API response is mocked.
    await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
      const realNow=Date.now, realSet=setTimeout, realClear=clearTimeout;
      let offset=0, serial=-1; const timers=new Map(), epoch=realNow();
      Date.now=()=>epoch+offset;
      window.setTimeout=(fn,ms,...args)=> {
        if(ms>=10000 && ms<=60000) { const id=serial--; timers.set(id,{at:Date.now()+ms,fn:()=>fn(...args)}); return id; }
        return realSet(fn,ms,...args);
      };
      window.clearTimeout=id=> { if(!timers.delete(id)) realClear(id); };
      window.__quotaTick=ms=> { offset+=ms; for(const [id,t] of [...timers]) if(t.at<=Date.now()){timers.delete(id);t.fn();} };
    })();` });
    let requests = [];
    page.on('Network.requestWillBeSent', event => {
      if (event.request.url.includes('/api/notifications')) requests.push(event.request.url);
    });
    await page.send('Network.setCookie', { name: 'tog_session', value: tokens[identity], url: base, httpOnly: true, sameSite: 'Lax' });
    await page.goto(base + '/profile/' + prefix + identity);
    await page.until(`!!document.querySelector('button[aria-label="Notifications"]')`, 'authenticated bell');
    const bell = `document.querySelector('button[aria-label="Notifications"]')`;
    await page.until(`${bell}.textContent==='9+'`, 'initial badge');
    assert.equal(requests.length, 1);
    assert(requests[0].includes('count_only=1'));
    await page.evaluate('__quotaTick(29999)'); await delay(100);
    assert.equal(requests.length, 1);
    await page.evaluate('__quotaTick(1)');
    await page.until('document.querySelector("button[aria-label=Notifications]").textContent==="9+"', 'badge remains visible');
    await delay(200);
    assert.equal(requests.length, 2, 'closed bell polls every thirty seconds');
    await page.evaluate('__quotaTick(300000)'); await delay(100);
    assert.equal(requests.length, 2, 'idle foreground makes no requests');
    await page.evaluate(`dispatchEvent(new Event('scroll'))`); await delay(250);
    assert.equal(requests.length, 3, 'interaction immediately resumes badge');
    await page.click(bell);
    await page.until(`document.querySelectorAll('button[aria-label="Delete notification"]').length===20`, 'full list on open');
    assert.equal(requests.filter(u => !u.includes('count_only')).length, 1, 'open issues one full list request');
    await page.evaluate('__quotaTick(10000)'); await delay(250);
    assert.equal(requests.filter(u => !u.includes('count_only')).length, 2, 'open bell retains ten-second updates');
    await page.click(`[...document.querySelectorAll('button')].find(e=>e.textContent.includes('Mark all as read'))`);
    await page.until(`${bell}.textContent===''`, 'mark all badge');
    await delay(250);
    assert(requests.some(u=>u.includes('/api/notifications') && !u.includes('?')), 'real notification mutation executed');
    await page.click(bell); await delay(250);
    assert(requests.at(-1).includes('count_only=1'), 'closing returns to badge-only reads');
    const before = requests.length;
    await page.evaluate(`Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'}); document.dispatchEvent(new Event('visibilitychange')); __quotaTick(60000);`);
    await delay(100); assert.equal(requests.length, before, 'hidden has no polling');
    await page.evaluate(`Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'}); document.dispatchEvent(new Event('visibilitychange'));`);
    await delay(250); assert.equal(requests.length, before + 1);
    await page.send('Network.setCookie', { name: 'tog_session', value: tokens[identity+1], url: base, httpOnly: true, sameSite: 'Lax' });
    await page.goto(base + '/profile/' + prefix + (identity+1));
    await page.until(`${bell}?.textContent==='2'`, 'new identity exact badge');
    await page.click(bell);
    await page.until(`document.querySelectorAll('button[aria-label="Delete notification"]').length===2`, 'new identity has only own notifications');
    assert.equal(await page.evaluate('document.documentElement.scrollWidth>innerWidth+1'), false);
    const discussionRequests = [];
    page.on('Network.requestWillBeSent', event => {
      if (/\/api\/template-(comments|votes)/.test(event.request.url)) discussionRequests.push(event.request.url);
    });
    await page.goto(base + '/template/' + topic + '/community');
    await page.until(`document.body.textContent.includes('Quota discussion fixture')`, 'combined live discussion');
    assert.equal(discussionRequests.length, 1, 'Community initial social state uses one request');
    assert(discussionRequests[0].includes('include_reactions=1'));
    await page.evaluate('__quotaTick(10000)'); await delay(250);
    assert.equal(discussionRequests.length, 2, 'one combined request per live tick');
    assert(discussionRequests.every(u=>u.includes('/template-comments?') && u.includes('include_reactions=1')));
    assert.deepEqual(page.errors, []);
    checks.push(`${width}px: count-only cadence, idle/resume, open/close, live mutation, hidden/resume, identity isolation, combined Community polling`);
  }
  console.log(checks.join('\n'));
} finally { await browser.close(); }
