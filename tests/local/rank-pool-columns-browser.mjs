// Local UI fixtures; never creates rankings or mutates real accounts.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium, delay } from './helpers/chromium.mjs';
const base = process.env.UI_TEST_URL || 'http://127.0.0.1:8788';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const browser = await chromium({ port: 9365 });
const tiers = ['S','A','B','C','D'].map(label=>({label,color:'#ff7f7f'}));
let count = 8;
try {
 const page = await browser.page(), failures = [];
 page.on('Fetch.requestPaused', params => void (async()=> {
  const url = new URL(params.request.url);
  let body = {success:true,data:[],total:0};
  if(url.pathname==='/api/auth') body.data=null;
  if(url.pathname==='/api/templates') body.data={id:'pool-qa',title:'Pool columns QA',description:'',hashtags:'#UP',tiers,template_items:Array.from({length:count},(_,i)=>({item_id:'pool-'+i,item:{name:'Item '+(i+1)}}))};
  assert(params.request.method==='GET'||url.pathname==='/api/analytics','No content writes');
  await page.send('Fetch.fulfillRequest',{requestId:params.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify(body)).toString('base64')});
 })().catch(e=>failures.push(String(e))));
 await page.send('Fetch.enable',{patterns:[{urlPattern:'*/api/*'}]});
 await page.goto(base); await page.until('!!document.querySelector("nav")','Navigation');
 const check = async expectedCount => {
  await page.until(`document.querySelectorAll('.rank-pool [data-item-id]').length===${expectedCount}`,'Pool items');
  await delay(250);
  const state=await page.evaluate(`(() => { const pool=document.querySelector('.rank-pool'),zone=pool.querySelector('.rank-pool-grid'),cards=[...zone.querySelectorAll('[data-item-id]')],r=cards.map(e=>e.getBoundingClientRect());return {columns:getComputedStyle(zone).gridTemplateColumns.split(' ').length,sameRow:Math.abs(r[0].top-r[1].top)<1,twoPositions:r[1].left>r[0].right,scrollable:pool.scrollHeight>pool.clientHeight,overflow:document.documentElement.scrollWidth>innerWidth+1,poolOverflow:zone.scrollWidth>zone.clientWidth+1,arrowSize:cards[0].querySelector('.absolute button').getBoundingClientRect().width};})()`);
  assert.equal(state.columns,2); assert(state.sameRow&&state.twoPositions,'First two cards share a row even with scrollbar');
  assert(!state.overflow&&!state.poolOverflow); assert.equal(state.arrowSize,44,'Reorder buttons retain 44px targets');
  return state;
 };
 let checks=0;
 for(const lang of ['en','th']) for(const [width,height] of [[768,1024],[1366,768],[1920,1080]]) for(const n of [6,7,8,18]) {
  count=n;
  await page.evaluate(`localStorage.clear();localStorage.setItem('tog-lang',${JSON.stringify(lang)})`);
  await page.viewport(width,height); await page.goto(base+`/rank?template=pool-${n}-${width}`);
  await check(n); checks++;
  if(n===18) {
   await page.evaluate("window.scrollTo(0,550);const p=document.querySelector('.rank-pool');p.scrollTop=p.scrollHeight");
   await delay(100);
   assert(await page.evaluate("document.querySelector('.rank-pool').scrollTop>0"),'Long pool still scrolls');
   await page.click("[...document.querySelectorAll('.rank-pool .editor-item-main')].at(-1)");
   await page.until('!!document.querySelector("[role=dialog]")','Scrolled final item is usable');
   await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});
   await page.until('!document.querySelector("[role=dialog]")','Picker closes');
  }
 }
 count=8;
 await page.evaluate("localStorage.clear();localStorage.setItem('tog-lang','en')");
 await page.viewport(1920,1080); await page.goto(base+'/rank?template=pool-transition'); await check(8);
 for(let i=0;i<2;i++) {
  await page.click("document.querySelector('.rank-pool .editor-item-main')");
  await page.until('!!document.querySelector("[role=dialog]")','Tier picker');
  await page.click("document.querySelector('[role=dialog] .grid > button')");
  await check(7-i);
 }
 assert.equal(await page.evaluate("document.querySelectorAll('.rank-board [data-item-id]').length"),2);
 const out='.wrangler/rank-pool-qa';fs.mkdirSync(out,{recursive:true});
 await page.screenshot(out+'/six-items.png');
 for(const i of [0,1]) {
  await page.click("document.querySelector('.rank-board .editor-item-main')");
  await page.until('!!document.querySelector("[role=dialog]")','Return picker');
  await page.click("document.querySelector('[role=dialog] button.col-span-2')");
  await check(7+i);
 }
 await page.screenshot(out+'/eight-items.png');
 for(const width of [390,430]) {
  await page.viewport(width,900); await page.goto(base+'/rank?template=pool-mobile-'+width);
  await page.until("document.querySelectorAll('.rank-pool [data-item-id]').length===8",'Mobile pool');
  assert.equal(await page.evaluate("getComputedStyle(document.querySelector('.rank-side')).display"),'contents');
  assert(!await page.evaluate('document.documentElement.scrollWidth>innerWidth+1'));
  await page.click("document.querySelector('.rank-pool .editor-item-main')");
  await page.until('!!document.querySelector("[role=dialog]")','Mobile item remains usable');
  await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});
  await page.until('!document.querySelector("[role=dialog]")','Mobile picker closes');
 }
 assert.deepEqual(failures,[]);assert.deepEqual(page.errors,[]);
 console.log(`PASS: ${checks} pool layouts (6/7/8/18 items, EN/TH tablet/desktop), 8→6→8 preserves two columns, scroll/tap and 44px controls, mobile layout.`);
} finally { await browser.close(); }
