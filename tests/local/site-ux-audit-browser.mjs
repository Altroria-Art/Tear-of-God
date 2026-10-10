// Actual Chromium + built Pages Functions + isolated D1. No API fixtures in the
// route matrix. Interaction/failure rehearsals are separate documented checks.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium, delay } from './helpers/chromium.mjs';
import { siteFixture } from './helpers/site-audit-fixture.mjs';

const fixture = await siteFixture();
const { base, output, accounts, password, topic, empty, unposted, posts, duel } = fixture;
const phase = process.env.QA_PHASE || 'before';
assert(['before','after'].includes(phase));
const widths = [320,390,768,1024,1440];
const variants = [['en','light'],['en','dark'],['th','light'],['th','dark']];
const routes = [
  ['home','/','guest'],['login','/login','guest'],['signup','/login?mode=signup','guest'],
  ['forgot','/forgot-password','guest'],['reset-code','/reset-password','guest'],['reset-password','/reset-password?token=qa-invalid-token','guest'],
  ['create','/create','guest'],['rank',`/rank?template=${topic}`,'guest'],
  ['discover','/discover','user'],['discover-new','/discover?tab=new','user'],['discover-active','/discover?tab=active','user'],
  ['discover-search','/discover?q=Campus','user'],['discover-saved','/discover?view=saved','user'],
  ['templates','/discover/templates','user'],['hashtags','/discover/hashtags','user'],['hashtag','/discover/hashtag/Campus','user'],['category-alias','/category/Campus','user'],
  ['template',`/template/${topic}`,'user'],['unposted-topic',`/template/${unposted}`,'user'],['empty-topic',`/template/${empty}`,'user'],
  ['community',`/template/${topic}/community`,'user'],['participants',`/template/${topic}/participants`,'admin'],
  ['participants-access-guard',`/template/${topic}/participants`,'user'],
  ['empty-participants',`/template/${empty}/participants`,'admin'],['missing-participants','/template/qa-missing/participants','admin'],
  ['post',`/post/${posts[0]}`,'user'],['own-profile','/profile','user'],['other-profile',`/profile/${accounts[1].id}`,'user'],
  ['duel',`/duel/${duel}`,'user'],['not-found','/qa-page-does-not-exist','guest'],
  ['missing-post','/post/qa-missing','guest'],['missing-template','/template/qa-missing','guest'],
  ['missing-community','/template/qa-missing/community','guest'],['missing-profile','/profile/qa-missing','guest'],['missing-duel','/duel/qa-missing','guest'],
  ['admin-dashboard','/admin','admin'],['admin-users','/admin/users','admin'],['admin-rankings','/admin/rankings','admin'],['admin-templates','/admin/templates','admin'],['admin-reports','/admin/reports','admin'],
];

function inspect(viewportWidth) {
  const visible = element => !element.closest('[inert], [aria-hidden=true]') && element.checkVisibility({checkOpacity:true,checkVisibilityCSS:true});
  const name = element => element.getAttribute('aria-label') || (element.getAttribute('aria-labelledby') || '').split(' ').map(id=>document.getElementById(id)?.textContent||'').join(' ').trim() || [...element.labels||[]].map(label=>label.textContent).join(' ').trim() || element.getAttribute('title') || element.innerText?.trim() || (element.tagName==='IMG' ? element.alt : '');
  const describe = element => ({ tag:element.tagName, text:name(element).slice(0,100), id:element.id, class: typeof element.className==='string'?element.className.slice(0,150):'', width:Math.round(element.getBoundingClientRect().width),height:Math.round(element.getBoundingClientRect().height) });
  const buttons = [...document.querySelectorAll('button,[role=button],summary')].filter(visible);
  const fields = [...document.querySelectorAll('input:not([type=hidden]):not([type=file]),textarea,select')].filter(visible);
  const ids = [...document.querySelectorAll('[id]')].map(element=>element.id);
  const outside = [...document.querySelectorAll('main,header,section,form,table,input,textarea,select')].filter(visible).filter(element=>{const rect=element.getBoundingClientRect();return (rect.left < -1 || rect.right > viewportWidth+1) && !element.closest('.squeeze-panel,[class*=overflow-x]')}).map(describe);
  return {
    url:location.pathname+location.search, title:document.title,lang:document.documentElement.lang,
    width:viewportWidth, layoutWidth:innerWidth, scrollWidth:document.documentElement.scrollWidth, mains:document.querySelectorAll('main').length,
    h1:[...document.querySelectorAll('h1')].filter(visible).map(element=>element.textContent.trim()),
    unnamedButtons:buttons.filter(element=>!name(element)).map(describe),
    unlabelledFields:fields.filter(element=>!element.getAttribute('aria-label') && !element.getAttribute('aria-labelledby') && ![...element.labels||[]].some(label=>label.textContent.trim()) && !element.getAttribute('title')).map(describe),
    // DOMRect subtraction can report 43.99999 for a 44px CSS target.
    smallButtons:buttons.filter(element=>{const rect=element.getBoundingClientRect();return rect.width<43.99 || rect.height<43.99}).map(describe),
    duplicateIds:[...new Set(ids.filter((id,index)=>ids.indexOf(id)!==index))], outside,
    tinyText:[...document.querySelectorAll('main p,main label,main button,main th')].filter(visible).filter(element=>parseFloat(getComputedStyle(element).fontSize)<11).map(describe).slice(0,12),
    animations:[...document.querySelectorAll('[class*=animate-in],.dialog-panel,.play-header')].filter(visible).map(element=>({ ...describe(element),animation:getComputedStyle(element).animationName })),
  };
}

let browser;
const results=[], errors=[], requestFailures=[];
try {
  browser=await chromium({port:9382});
  const pages={};
  for(const role of ['guest','user','admin']) {
    const page=await browser.page(); pages[role]=page;
    page.pending=new Set(); page.lastResponse=Date.now();
    page.on('Network.requestWillBeSent',event=> { if(event.request.url.startsWith(base+'/api/') && event.request.method==='GET') page.pending.add(event.requestId); });
    page.on('Network.loadingFinished',event=> { if(page.pending.delete(event.requestId)) page.lastResponse=Date.now(); });
    page.on('Network.loadingFailed',event=> { page.pending.delete(event.requestId); if(!event.canceled) requestFailures.push({role,error:event.errorText}); });
    await page.goto(base+'/login'); await page.until(`!!document.querySelector('#login-email')`,'initial app');
    if(role!=='guest') {
      const person=accounts[role==='admin'?2:0];
      await page.field('#login-email',person.email); await page.field('#login-password',password);
      await page.click(`document.querySelector('#login-email').closest('form').querySelector('button[type=submit]')`);
      await page.until(`location.pathname!=='/login'`,'actual form login');
      assert.equal((await page.evaluate(`fetch('/api/auth').then(r=>r.json())`)).data.id,person.id);
    }
  }
  for(const [name,route,role] of routes) {
    const page=pages[role];
    for(const [lang,theme] of variants) {
      await page.evaluate(`localStorage.setItem('tog-lang',${JSON.stringify(lang)});localStorage.setItem('tog-theme',${JSON.stringify(theme)});`);
      await page.goto(base+route);
      await page.until(`document.documentElement.lang===${JSON.stringify(lang)} && !!document.querySelector('#root')?.textContent.trim()`,'route content '+name);
      // Wait for actual API reads and lazy routes, allowing polling to stay idle.
      for(let attempt=0;attempt<100;attempt++) { if(page.pending.size===0 && Date.now()-page.lastResponse>250) break; await delay(80); }
      await delay(350);
      for(const width of widths) {
        await page.viewport(width); await delay(160);
        const result=await page.evaluate(`(${inspect.toString()})(${width})`);
        results.push({name,role,theme,lang,...result});
        if((width===390 || width===1440) && lang==='th' && theme==='light') await page.screenshot(path.join(output,`${phase}-${name}-${width}.png`));
      }
    }
    console.log(`${phase}: ${name} checked in 20 viewport/language/theme combinations`);
  }
  for(const [role,page] of Object.entries(pages)) errors.push(...page.errors.map(error=>({role,error})));
} finally {
  fs.writeFileSync(path.join(output,`${phase}-site-audit.json`),JSON.stringify({phase,browser:browser?.version,routes:routes.length,combinations:results.length,results,errors,requestFailures},null,2));
  if(browser) await browser.close();
}
const affected=key=>[...new Set(results.filter(row=>row[key]?.length).map(row=>row.name))];
console.log(JSON.stringify({phase,routes:routes.length,combinations:results.length,overflow:[...new Set(results.filter(row=>row.scrollWidth>row.width+1).map(row=>row.name))],missingMain:[...new Set(results.filter(row=>row.mains!==1).map(row=>row.name))],missingHeading:[...new Set(results.filter(row=>row.h1.length!==1).map(row=>row.name))],unnamedButtons:affected('unnamedButtons'),unlabelledFields:affected('unlabelledFields'),duplicateIds:affected('duplicateIds'),errors,requestFailures},null,2));
if(phase==='after') {
  assert(results.length===routes.length*variants.length*widths.length);
  assert.equal(errors.length,0,'No uncaught browser exceptions');
  assert(results.every(row=>row.scrollWidth<=row.width+1),'No page overflows');
  assert(results.every(row=>row.mains===1),'Every route has one main landmark');
  assert(results.every(row=>row.h1.length===1),'Every route has one visible page heading');
  assert(results.every(row=>row.unnamedButtons.length===0),'All rendered buttons have accessible names');
  assert(results.every(row=>row.unlabelledFields.length===0),'All rendered fields have persistent accessible labels');
  assert(results.every(row=>row.smallButtons.length===0),'All visible buttons and disclosure controls meet 44px targets');
  assert(results.every(row=>row.tinyText.length===0),'Page text checked by the audit is at least 11px');
  assert(results.every(row=>row.duplicateIds.length===0),'No duplicate IDs');
}
