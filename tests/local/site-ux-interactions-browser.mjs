// Actual Pages/D1 for navigation and admin previews. Only password recovery
// responses are intercepted: this UI rehearsal never sends email or changes a
// real password. See the audit report for external integration limitations.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium, delay } from './helpers/chromium.mjs';
import { siteFixture } from './helpers/site-audit-fixture.mjs';

const fixture=await siteFixture();
const {base,accounts,password,topic,output}=fixture;
const copy=Object.fromEntries(['en','th'].map(lang=>[lang,JSON.parse(fs.readFileSync(`src/locales/${lang}.json`,'utf8'))]));
const checks=[];
let browser;
const key=async(page,key,code=key,text)=>{
  const virtualKey = { Enter:13, ' ':32, Tab:9, Escape:27, ArrowLeft:37, ArrowUp:38, ArrowRight:39, ArrowDown:40, Home:36, End:35 }[key];
  await page.send('Input.dispatchKeyEvent',{type:'keyDown',key,code,text,windowsVirtualKeyCode:virtualKey});
  await page.send('Input.dispatchKeyEvent',{type:'keyUp',key,code});
};
const button=text=>`[...document.querySelectorAll('button')].find(e=>!e.closest('[inert]') && e.checkVisibility() && e.textContent.trim()===${JSON.stringify(text)})`;
async function go(page,route,selector) {
  await page.goto(base+route);await delay(200);
  await page.until(`location.pathname===${JSON.stringify(new URL(route,base).pathname)} && !!document.querySelector(${JSON.stringify(selector)})`,'loaded '+route);
  await delay(350);
}
async function login(page,person) {
  await go(page,'/login','#login-email');
  await page.field('#login-email',person.email);await page.field('#login-password',password);
  await page.click(`document.querySelector('#login-email').closest('form').querySelector('[type=submit]')`);
  await page.until(`location.pathname!=='/login'`,'login');
  assert.equal((await page.evaluate(`fetch('/api/auth').then(r=>r.json())`)).data.id,person.id);
}
async function dialog(page,label) {
  await page.until(`!!document.querySelector('[role=dialog]')`,'dialog '+label);
  await delay(260);
  const state=await page.evaluate(`(()=>{const d=document.querySelector('[role=dialog]'),p=d.querySelector('.dialog-panel'),r=p.getBoundingClientRect();return {root:document.getElementById('root').inert,focus:d.contains(document.activeElement),name:document.getElementById(d.getAttribute('aria-labelledby'))?.textContent,fit:r.left>=0&&r.right<=document.documentElement.clientWidth,panel:p.scrollWidth<=p.clientWidth+1};})()`);
  assert(state.root&&state.focus&&state.name&&state.fit&&state.panel,JSON.stringify(state));
  for(let index=0;index<12;index++) {await key(page,'Tab');assert(await page.evaluate(`document.querySelector('[role=dialog]').contains(document.activeElement)`),'Tab stays in dialog');}
  await key(page,'Escape');
  await page.until(`!document.querySelector('[role=dialog]')`,'closed '+label);
  assert.equal(await page.evaluate(`document.getElementById('root').inert`),false);
  checks.push(label+' labelled, viewport fits, inert background, Tab trap, Escape and unlock');
}
try {
  browser=await chromium({port:9383});
  const guest=await browser.page(),user=await browser.page(),admin=await browser.page();
  const voteResponses=[];
  user.on('Network.responseReceived',event=>{if(new URL(event.response.url).pathname==='/api/votes')voteResponses.push(event.response.status);});
  await go(guest,'/login','#login-email');
  await login(user,accounts[0]);await login(admin,accounts[2]);
  for(const lang of ['en','th']) for(const width of [390,1440]) {
    for(const page of [guest,user,admin]) {await page.viewport(width);await page.evaluate(`localStorage.setItem('tog-lang',${JSON.stringify(lang)});localStorage.setItem('tog-theme','light')`);}
    await go(guest,'/login','#login-email');
    await guest.evaluate(`document.activeElement.blur()`);await key(guest,'Tab');
    assert.equal(await guest.evaluate(`document.activeElement.classList.contains('skip-link')`),true);
    await key(guest,'Enter','Enter','\r');
    assert.equal(await guest.evaluate(`document.activeElement.id`),'main-content');
    checks.push(`Skip navigation ${lang}/${width}`);

    await go(user,'/discover/templates','.sort-control');
    await user.evaluate(`document.querySelector('.sort-control>button').focus()`);await key(user,'ArrowDown');
    await user.until(`document.activeElement.getAttribute('role')==='menuitemradio'`,'keyboard menu');
    await key(user,'End');await key(user,'Enter','Enter','\r');
    await user.until(`!document.querySelector('.sort-control [role=menu]')`,'sort selected');
    assert.equal(await user.evaluate(`document.activeElement===document.querySelector('.sort-control>button')`),true);
    await key(user,'ArrowDown');await key(user,'Escape');
    assert.equal(await user.evaluate(`document.querySelector('.sort-control>button').getAttribute('aria-expanded')`),'false');
    await user.click(`document.querySelector('.sort-control>button')`);
    await user.click(`document.querySelector('main h1')`);
    assert.equal(await user.evaluate(`!!document.querySelector('.sort-control [role=menu]')`),false);
    checks.push(`Sort select, arrows, Escape, outside click ${lang}/${width}`);

    await go(user,`/template/${topic}/community`,'.community-board button');
    await user.evaluate(`document.querySelector('.community-board button').focus()`);await key(user,' ','Space',' ');
    await dialog(user,`Tier item keyboard detail ${lang}/${width}`);
    assert.equal(await user.evaluate(`document.activeElement===document.querySelector('.community-board button')`),true);

    await go(user,'/profile','.profile-ranking-tile');
    await user.evaluate(`document.querySelector('.profile-ranking-caption a').focus()`);
    await key(user,'Enter','Enter','\r');
    await user.until(`location.pathname.startsWith('/post/') && !!document.querySelector('main h1')`,'Profile native post link');
    checks.push(`Profile post title opens with Enter ${lang}/${width}`);
    await go(user,'/template/'+topic,'[role=link][tabindex="0"]');
    const broken=`document.querySelector('[data-template-preview-item=${JSON.stringify(topic+'-item-1')}]')`;
    await user.until(`!!${broken} && !${broken}.querySelector('img') && ${broken}.textContent.includes('อาหาร 1')`,'Broken topic preview uses name fallback');
    checks.push(`Topic preview broken image fallback ${lang}/${width}`);
    const board=`document.querySelector('[role=link][aria-label=${JSON.stringify(copy[lang].template.openRankingPost)}]')`;
    await user.until(`!!${board}?.querySelector('button')`,'Template ranking items');
    await user.evaluate(`${board}.querySelector('button').focus()`);await key(user,' ','Space',' ');
    await user.until(`!!document.querySelector('[role=dialog]')`,'Template keyboard item');
    assert.equal(await user.evaluate('location.pathname'),'/template/'+topic,'Item activation does not navigate its parent');
    await dialog(user,`Template keyboard item ${lang}/${width}`);
    const vote=`${board}.nextElementSibling.querySelector('button[aria-label=${JSON.stringify(copy[lang].post.like)}]')`;
    const initialVote=await user.evaluate(`${vote}.getAttribute('aria-pressed')`);
    await user.evaluate(`${vote}.focus()`);await key(user,' ','Space',' ');
    await user.until(`${vote}.getAttribute('aria-pressed')!==${JSON.stringify(initialVote)}`,'Keyboard vote toggles');
    await delay(500);await key(user,' ','Space',' ');
    await user.until(`${vote}.getAttribute('aria-pressed')===${JSON.stringify(initialVote)}`,'Keyboard vote restores initial state');
    await delay(500);
    checks.push(`Template keyboard vote toggles and restores ${lang}/${width}; isolated account only`);
    await go(admin,'/admin','main h1');
    await admin.evaluate(`document.querySelector('main a[href="/admin/reports"]').focus()`);
    await key(admin,'Enter','Enter','\r');
    await admin.until(`location.pathname==='/admin/reports' && !!document.querySelector('main h1')`,'Dashboard reports link');
    assert(!await admin.evaluate(`!!document.querySelector('[role=dialog]')`),'Navigation link does not open quick reports');
    checks.push(`Dashboard reports link activates without parent action ${lang}/${width}`);
    await go(user,'/profile','.profile-header-actions');
    await user.click(button(copy[lang].profile.editProfile));
    await user.until(`!!document.querySelector('#profile-display-name')`,'profile editor');
    const fields=await user.evaluate(`[...document.querySelectorAll('[role=dialog] input:not([type=file]),[role=dialog] textarea,[role=dialog] select')].filter(e=>e.checkVisibility()).every(e=>e.getAttribute('aria-label')||e.labels?.length)`);
    assert(fields,'Profile editor labels');await dialog(user,`Profile editor ${lang}/${width}`);

    for(const route of ['rankings','templates']) {
      await go(admin,'/admin/'+route,'tbody');
      await admin.click(`[...document.querySelectorAll('tbody button')].find(e=>e.querySelector('.lucide-eye'))`);
      await dialog(admin,`Admin ${route} preview ${lang}/${width}`);
    }
    await go(admin,'/admin','main h1');
    await admin.click(`[...document.querySelectorAll('button')].find(e=>e.textContent.includes(${JSON.stringify(copy[lang].admin.quickReportsTitle)}))`);
    await dialog(admin,`Admin quick reports ${lang}/${width}`);
    await go(user,'/profile','.profile-header-actions');
    await user.click(`document.querySelector('button[aria-label=${JSON.stringify(copy[lang].notifications.title)}]')`);
    await user.until(`!!document.querySelector('.notification-sheet')`,'notification menu');await delay(300);
    assert(await user.evaluate(`(()=>{const r=document.querySelector('.notification-sheet').getBoundingClientRect();return r.left>=0&&r.right<=document.documentElement.clientWidth})()`));
    await key(user,'Escape');await user.until(`!document.querySelector('.notification-sheet')`,'notification Escape');
    checks.push(`Notification panel fit and Escape ${lang}/${width}`);
    for (const route of ['users','rankings','templates','reports']) {
      await go(admin,'/admin/'+route,'tbody');
      const region=`document.querySelector('main [role=region][aria-label]')`;
      const scrolls=await admin.evaluate(`${region}.scrollWidth>${region}.clientWidth+1`);
      assert.equal(await admin.evaluate(`${region}.tabIndex`),scrolls?0:-1);
      assert.equal(await admin.evaluate(`${region}.previousElementSibling.hidden`),!scrolls);
      if (scrolls) {
        await admin.evaluate(`${region}.focus()`);await key(admin,'ArrowRight');
        await admin.until(`${region}.scrollLeft>0`,'table arrow key');
        assert(await admin.evaluate(`${region}===document.activeElement`),'Table retains keyboard focus');
      }
    }
    checks.push(`Admin tables announce overflow and scroll by keyboard ${lang}/${width}`);
  }
  // Reduced motion applies to page entries, popovers, dialogs and book turning.
  await user.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await go(user,`/template/${topic}/community`,'.community-board button');
  assert.equal(await user.evaluate(`getComputedStyle(document.querySelector('main')).animationName`),'none');
  await user.click(`document.querySelector('.community-board button')`);
  assert.equal(await user.evaluate(`getComputedStyle(document.querySelector('.dialog-panel')).animationName`),'none');
  await key(user,'Escape');
  await go(user,'/discover/templates','.sort-control');await user.click(`document.querySelector('.sort-control>button')`);
  assert.equal(await user.evaluate(`getComputedStyle(document.querySelector('.ui-popover')).animationName`),'none');await key(user,'Escape');
  await guest.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await go(guest,'/login','#login-email');assert(await guest.evaluate(`parseFloat(getComputedStyle(document.querySelector('.auth-book-leaf')).transitionDuration)<=0.0001`),'Book transition is effectively instantaneous');
  checks.push('Reduced motion: page, dialog, menu and book');

  // UI-only password recovery responses. Ordinary auth/navigation above is real.
  let pending, recoveryCalls=0;
  const faults=[];
  guest.on('Fetch.requestPaused',event=>void(async()=>{
    const action=event.request.postData ? JSON.parse(event.request.postData).action : '';
    if(['forgot_password','verify_reset_code','reset_password'].includes(action)) {pending=event;recoveryCalls++;}
    else await guest.send('Fetch.continueRequest',{requestId:event.requestId});
  })().catch(error=>faults.push(String(error))));
  await guest.send('Fetch.enable',{patterns:[{urlPattern:base+'/api/auth',requestStage:'Request'}]});
  const respond=async(body,status=200)=>{const event=pending;pending=null;await guest.send('Fetch.fulfillRequest',{requestId:event.requestId,responseCode:status,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify(body)).toString('base64')});};
  const waitPending=async()=>{for(let index=0;index<100;index++){if(pending)return;await delay(50);}throw Error('Recovery request missing');};
  await go(guest,'/forgot-password','#recovery-email');await guest.field('#recovery-email','ui-qa@example.test');
  await guest.click(`document.querySelector('#recovery-email').form.querySelector('[type=submit]')`);await waitPending();
  assert(await guest.evaluate(`document.querySelector('button[type=submit]').textContent.trim().length>0 && document.querySelector('button[type=submit]').disabled`));
  await respond({success:false,error:'Temporary QA failure'},503);await guest.until(`!!document.querySelector('[role=alert]')`,'recovery error');
  await guest.click(`document.querySelector('#recovery-email').form.querySelector('[type=submit]')`);await waitPending();await respond({success:true});
  await guest.until(`!!document.querySelector('a[href="/reset-password"]')`,'recovery success');
  checks.push('Recovery loading name, failure/retry, success; email API intercepted');
  await go(guest,'/reset-password','#reset-code');await guest.field('#reset-email','ui-qa@example.test');
  const started=Date.now();await guest.field('#reset-code','123456');await waitPending();
  await respond({success:false,error:'Invalid verification code'},400);
  await guest.until(`!!document.querySelector('.reset-code-stage--error')`,'OTP invalid',7000);
  assert(Date.now()-started>=1900,'Keep requested two-second minimum check');
  assert.equal(await guest.evaluate(`document.querySelectorAll('.reset-code-slot').length`),6);
  await guest.field('#reset-code','654321');await waitPending();await respond({success:true,token:'ui-only-qa-token'});
  await guest.until(`!!document.querySelector('#reset-password')`,'OTP success password stage',7000);
  await guest.field('#reset-password','LocalDummy123!');await guest.field('#reset-confirm','LocalDummy123!');
  await guest.click(`document.querySelector('#reset-password').form.querySelector('[type=submit]')`);await waitPending();
  assert(await guest.evaluate(`document.querySelector('button[type=submit]').textContent.trim().length>0 && document.querySelector('button[type=submit]').disabled`));
  await respond({success:false,error:'Expired reset token'},400);await guest.until(`!!document.querySelector('[role=alert]')`,'reset error');
  checks.push('OTP six digits, failure, two-second minimum, verified transition and expired-token UI; API intercepted');
  assert(recoveryCalls===5);assert.deepEqual(faults,[]);
  assert.deepEqual(voteResponses,Array(8).fill(200),'Every isolated keyboard vote reached the real backend successfully');
  for(const page of [guest,user,admin]) assert.deepEqual(page.errors,[]);
  console.log(`PASS ${checks.length} site interaction checks`);
} finally {
  fs.writeFileSync(path.join(output,'site-interactions.json'),JSON.stringify({browser:browser?.version,checks},null,2));
  if(browser)await browser.close();
}
