// Local browser acceptance for both interface languages. No remote API writes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import i18next from 'i18next';
import { chromium, delay } from './helpers/chromium.mjs';
const base=process.env.UI_TEST_URL||'http://127.0.0.1:8807';
assert(['127.0.0.1','localhost'].includes(new URL(base).hostname));
const out=path.resolve('.wrangler/copy-audit-2026-10-09/browser');fs.mkdirSync(out,{recursive:true});
const resources=Object.fromEntries(['en','th'].map(lang=>[lang,{translation:JSON.parse(fs.readFileSync(`src/locales/${lang}.json`,'utf8'))}]));
const i18n=i18next.createInstance();await i18n.init({resources,lng:'en',fallbackLng:false,interpolation:{escapeValue:false}});
const tiers=['S','A','B','C','D'].map((label,i)=>({label,color:['#ff7777','#ffbb77','#ffff77','#77ff77','#77bbff'][i]}));
const person={id:'copy-user',username:'Campus friend',role:'admin',created_at:'2026-08-15 12:00:00',followers_count:2,following_count:3,total_likes:4,badges:[]};
const items=Array.from({length:8},(_,i)=>({id:`copy-item-${i}`,item_id:`copy-item-${i}`,tier:tiers[i%5].label,item_name:`Drink ${i+1}`,item:{name:`Drink ${i+1}`}}));
const template={id:'copy-topic',title:'Campus drinks',description:'Our campus picks',hashtags:'#Food,#UP',profile:person,creator_id:person.id,tiers,template_items:items,stats:{uses:3,views:8},community_average:{updated_at:'2026-10-09 00:00:00',items:items.map((item,i)=>({...item,name:item.item_name,avg:5-i%5,votes:3}))}};
const ranking={...template,id:'copy-post',template_id:template.id,user_id:person.id,created_at:'2026-10-09 00:00:00',ranking_items:items,stats:{likes:2,dislikes:0,comments:0},comments:[]};
const duel={id:'copy-duel',template,challenger:person,owner:{...person,id:'copy-other',username:'Tea friend'},similarity_score:80,comparison:{details:[]},created_at:'2026-10-09 00:00:00'};
const routes=[
 ['/', 'play.homeEyebrow'], ['/discover','discover.browseTitle'],['/discover/templates','discover.popularTemplates'],['/discover/hashtags','discover.popularHashtags'],
 ['/discover/hashtag/Food','#Food'],['/category/Food','#Food'],['/discover?q=drinks','discover.clearSearch'],['/discover?saved=1','discover.savedTemplates'],
 ['/create','play.createTitle'],['/rank?template=copy-topic','play.rankTitle'],['/template/copy-topic','Campus drinks'],['/template/copy-topic/community','template.communityAverage'],
 ['/template/copy-topic/participants','participants.exportExcel'],['/post/copy-post','Campus drinks'],['/profile','profile.joined'],['/profile/copy-other','profile.joined'],
 ['/duel/copy-duel','play.resultTitle'],['/not-a-real-route','play.missingBadge'],['/admin','admin.dashboardTitle'],['/admin/users','admin.manageUsers'],['/admin/rankings','admin.managePosts'],['/admin/templates','admin.manageTemplates'],['/admin/reports','admin.manageReports'],
 ['/login','auth.clubWelcomeTitle'],['/forgot-password','auth.forgotPasswordTitle'],['/reset-password?email=test%40example.invalid','auth.verifyEmailTitle']
];
const browser=await chromium({port:9354});const results=[];let guest=false;const interceptedErrors=[];
try {
 const page=await browser.page();
 page.on('Fetch.requestPaused',params=>void(async()=>{
  const url=new URL(params.request.url);let body={success:true,data:[],total:0,hasMore:false,comments_count:0},status=200;
  if(url.pathname==='/api/auth') {
   if(params.request.method==='GET')body.data=guest?null:person;
   else {status=401;body={success:false,error:'อีเมลหรือรหัสผ่านไม่ถูกต้อง'};}
  } else if(url.pathname==='/api/templates')body={...body,data:url.searchParams.has('id')?template:[template],total:1};
  else if(url.pathname==='/api/rankings')body={...body,data:url.searchParams.has('id')?ranking:[ranking],total:1,next_cursor:null};
  else if(url.pathname==='/api/users')body.data={...person,id:url.searchParams.get('id')||person.id};
  else if(url.pathname==='/api/hashtags')body={...body,data:[{tag:'Food',template_count:1,ranking_count:3}],total:1};
  else if(url.pathname==='/api/duels')body.data=url.searchParams.has('id')?duel:[];
  else if(url.pathname==='/api/template-participants')body.data=[{...person,user_id:person.id,ranking_items:items}];
  else if(url.pathname==='/api/template-votes')body={...body,likes:1,dislikes:0,userVote:null};
  else if(url.pathname==='/api/discover-pulse')body={success:true,window:'week',requested_window:'week',active_rankings:1,topics:[],rankings:[],discussions:[],hashtags:[],templates:[template]};
  else if(url.pathname==='/api/admin'&&url.searchParams.get('action')==='stats')body.data={users:2,rankings:1,templates:1,votes:2,comments:0,follows:3,pending_reports:0};
  else if(url.pathname==='/api/admin'&&url.searchParams.get('action')==='analytics')body.data=null;
  await page.send('Fetch.fulfillRequest',{requestId:params.requestId,responseCode:status,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify(body)).toString('base64')});
 })().catch(error=>interceptedErrors.push(String(error))));
 await page.send('Fetch.enable',{patterns:[{urlPattern:'*/api/*'}]});
 await page.goto(base);await page.until('!!document.querySelector("nav")','navigation');
 for(const lang of ['en','th']) {
  await i18n.changeLanguage(lang);
  await page.evaluate(`localStorage.clear();localStorage.setItem('tog-lang',${JSON.stringify(lang)})`);
  for(const width of [1440,390])for(const [route,key]of routes) {
   guest=['/login','/forgot-password'].includes(route)||route.startsWith('/reset-password');
   await page.viewport(width,900);await page.goto(base+route);
   const expected=key.includes('.')?i18n.t(key):key;
   try { await page.until(`document.documentElement.lang===${JSON.stringify(lang)} && document.body.innerText.toLowerCase().includes(${JSON.stringify(expected.toLowerCase())})`,`${route} ${lang}/${width}`,15000); }
   catch(error) { console.error({route,lang,width,expected,text:await page.evaluate('document.body.innerText'),runtime:page.errors});throw error; }
   await delay(100);
   const state=await page.evaluate(`({text:document.body.innerText,overflow:document.documentElement.scrollWidth>innerWidth+1,headings:[...document.querySelectorAll('h1,h2')].map(e=>e.innerText),route:location.pathname})`);
   assert(!state.overflow,`${route} ${lang}/${width}: no horizontal overflow`);
   assert(!/\b(?:apiMessages|apiFields|common|discover|profile|template|auth|shareExport)\.[A-Za-z]\w*/.test(state.text),`${route}: no untranslated keys`);
   assert(!state.text.includes(i18n.t('common.errorOccurred')),`${route}: no error boundary`);
   results.push({route,lang,width,headings:state.headings});
   if(['/','/discover','/create','/post/copy-post','/profile','/login','/reset-password?email=test%40example.invalid'].includes(route))await page.screenshot(path.join(out,`${lang}-${width}-${route.split(/[/?]/).filter(Boolean)[0]||'home'}.png`));
  }
  guest=false;await page.goto(base+'/profile');await page.until('!!document.querySelector(".profile-edit-button")','profile actions');
  await page.click('document.querySelector(".profile-edit-button")');await page.until('!!document.querySelector("[role=dialog]")','profile editor');
  assert((await page.evaluate('document.querySelector("[role=dialog]").innerText')).includes(i18n.t('profile.editProfile')));
  await page.screenshot(path.join(out,`${lang}-profile-editor.png`));
  await page.goto(base+'/post/copy-post');await page.until('!!document.querySelector(".post-board")','ranking to share');
  const share=i18n.t('common.share');
  await page.click(`[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(share)}||e.title===${JSON.stringify(share)})`);
  await page.until('!!document.querySelector("[role=dialog]")','share dialog');
  const cardLabel=i18n.t('shareExport.previewShareCard');
  await page.click(`[...document.querySelectorAll('[role=dialog] button')].find(e=>e.textContent.trim()===${JSON.stringify(cardLabel)})`);
  await page.until(`document.body.innerText.includes(${JSON.stringify(i18n.t('shareExport.shareCardCta'))})`,'localized share card');
  const modalText=await page.evaluate('document.querySelector("[role=dialog]").innerText');
  assert(modalText.includes(i18n.t('shareExport.shareCardCta'))&&modalText.includes(i18n.t('shareExport.qrHint')));
  await page.screenshot(path.join(out,`${lang}-share-card.png`));
  await page.goto(base+'/post/copy-post');await page.until('!!document.querySelector(".post-board")','ranking to download');
  await page.click(`[...document.querySelectorAll('button')].find(e=>e.title===${JSON.stringify(i18n.t('common.export'))})`);
  await page.until('!!document.querySelector("[role=dialog]")','download dialog');
  const exportText=(await page.evaluate('document.querySelector("[role=dialog]").innerText')).toLowerCase();
  assert(exportText.includes(i18n.t('common.lightTheme').toLowerCase())&&exportText.includes(i18n.t('common.darkTheme').toLowerCase()));
  await page.screenshot(path.join(out,`${lang}-download.png`));
  guest=true;await page.goto(base+'/login');await page.until(`document.body.innerText.toLowerCase().includes(${JSON.stringify(i18n.t('auth.clubWelcomeTitle').toLowerCase())})`,'login');
  await page.field('input[type=email]','test@example.invalid');await page.field('input[type=password]','wrong-passphrase');
  await page.click('document.querySelector("button[type=submit]")');
  await page.until(`document.body.innerText.includes(${JSON.stringify(i18n.t('apiMessages.loginInvalid'))})`,'localized sign-in error');
  assert.equal(page.errors.length,0,`No runtime exceptions (${lang})`);
 }
 assert.deepEqual(interceptedErrors,[]);
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({browser:browser.version,screens:results.length,results,errors:page.errors},null,2));
 console.log(`Browser copy passed: ${results.length} screens, English/Thai, desktop/mobile, localized sign-in errors, no runtime errors or horizontal overflow.`);
}finally{await browser.close();}
