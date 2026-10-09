// Physical emulated touch with local API fixtures; no published content.
import assert from 'node:assert/strict';
import { chromium, delay } from './helpers/chromium.mjs';
const base=process.env.UI_TEST_URL||'http://127.0.0.1:8788';
assert(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const tiers=['S','A','B','C','D'].map((label,i)=>({id:'t'+i,label,color:'#ff7f7f'}));
const browser=await chromium({port:9367});
try {
 const page=await browser.page(),failures=[];
 page.on('Fetch.requestPaused',params=>void(async()=>{
  const url=new URL(params.request.url);let body={success:true,data:[],total:0};
  if(url.pathname==='/api/auth')body.data=null;
  if(url.pathname==='/api/templates')body.data={id:'touch-qa',title:'Touch QA',description:'',hashtags:'#UP',tiers,template_items:Array.from({length:6},(_,i)=>({item_id:'touch-'+i,item:{name:'Item '+i}}))};
  assert(params.request.method==='GET'||url.pathname==='/api/analytics','No content writes');
  await page.send('Fetch.fulfillRequest',{requestId:params.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify(body)).toString('base64')});
 })().catch(e=>failures.push(String(e))));
 await page.send('Fetch.enable',{patterns:[{urlPattern:'*/api/*'}]});
 await page.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
 await page.goto(base);await page.until('!!document.querySelector("nav")','Navigation');
 const tier=index=>`[...document.querySelectorAll('.drop-zone')].filter(e=>e.parentElement.classList.contains('bg-tag'))[${index}]`;
 const pool=`[...document.querySelectorAll('.drop-zone')].find(e=>!e.parentElement.classList.contains('bg-tag'))`;
 const ids=zone=>page.evaluate(`[...(${zone}).querySelectorAll('[data-item-id]')].map(e=>e.dataset.itemId)`);
 const frameElement=async expression=>{
  await page.evaluate(`(() => {const e=(${expression});e.scrollIntoView({block:'nearest',inline:'center',behavior:'instant'});const r=e.getBoundingClientRect();window.scrollBy(0,r.top-220);})()`);await delay(100);
 };
 const point=expression=>page.evaluate(`(() => {const r=(${expression}).getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+24};})()`);
 const touch=async(type,p)=>page.send('Input.dispatchTouchEvent',{type,touchPoints:p?[{...p,id:0}]:[]});
 const drag=async(id,destination,{before=false,beforeId=null,append=false,cancel=false,outside=false}={})=>{
  const source=`document.querySelector('[data-item-id="${id}"] .editor-item-main')`;
  await frameElement(source);
  const from=await point(source);assert(from.x>0&&from.x<await page.evaluate('innerWidth'),'Drag source is visible');await touch('touchStart',from);await delay(250);
  await page.until('!!document.querySelector(".touch-drag-preview")','Hold starts touch drag');
  // Center the target by scrolling the page while the held preview stays attached.
  await frameElement(destination);
  const to=outside?{x:8,y:200}:await page.evaluate(`(() => {const z=(${destination}),r=z.getBoundingClientRect(),first=(${JSON.stringify(beforeId)}?z.querySelector('[data-item-id="'+${JSON.stringify(beforeId)}+'"]'):z.querySelector('[data-item-id]'))?.getBoundingClientRect();return {x:Math.min(innerWidth-24,${before}&&first?first.left+3:r.right-24),y:${before}&&first?first.top+24:${append}?r.bottom-16:r.top+Math.min(r.height/2,35)};})()`);
  for(let step=1;step<=8;step++){await touch('touchMove',{x:from.x+(to.x-from.x)*step/8,y:from.y+(to.y-from.y)*step/8});await delay(25);}
  await touch(cancel?'touchCancel':'touchEnd');
  await page.until('!document.querySelector(".touch-drag-preview")','Preview cleared');
  assert(!await page.evaluate('!!document.querySelector("[role=dialog]")'),'Dragging does not trigger a tap picker');
 };
 for(const route of ['rank','create'])for(const width of [390,430]){
  await page.evaluate(`localStorage.clear();localStorage.setItem('tog-lang','en');localStorage.setItem('tog-create-draft',${JSON.stringify(JSON.stringify({version:1,title:'Touch QA',description:'',tiers,items:Array.from({length:6},(_,i)=>({id:'touch-'+i,content:'Item '+i,tierId:null})),selectedHashtags:['#UP'],customHashtags:[]}))})`);
  await page.viewport(width,932);await page.goto(base+(route==='rank'?'/rank?template=touch-qa':'/create'));
  await page.until('document.querySelectorAll("[data-item-id]").length===6','Editor items');
  const [first,second]=await ids(pool);
  await drag(first,tier(0));assert.deepEqual(await ids(tier(0)),[first]);
  await drag(second,tier(0));assert.deepEqual(await ids(tier(0)),[first,second]);
  await drag(second,tier(0),{before:true});assert.deepEqual(await ids(tier(0)),[second,first]);
  await drag(second,tier(1));assert.deepEqual(await ids(tier(1)),[second]);
  await drag(second,pool);assert((await ids(pool)).includes(second),`${route}/${width}: return to pool, including its edge padding`);
  const originalPool=await ids(pool);
  await drag(second,tier(2),{cancel:true});assert.deepEqual(await ids(pool),originalPool);assert.deepEqual(await ids(tier(2)),[]);
  await drag(second,tier(2),{outside:true});assert.deepEqual(await ids(pool),originalPool);
  const extra=(await ids(pool)).slice(0,3);
  for(const id of extra)await drag(id,tier(0),{append:true});
  const wrapped=await page.evaluate(`(() => {const cards=(${tier(0)}).querySelectorAll('[data-item-id]');return cards[3].getBoundingClientRect().top>cards[0].getBoundingClientRect().top;})()`);
  assert(wrapped,'Four cards wrap on mobile');
  await drag(first,tier(0),{before:true,beforeId:extra[2]});
  assert.deepEqual(await ids(tier(0)),[extra[0],extra[1],first,extra[2]],'Drop before a card on a later row preserves order');
  const source=`document.querySelector('[data-item-id="${first}"] .editor-item-main')`;
  await frameElement(source);const tap=await point(source);
  await touch('touchStart',tap);await delay(80);await touch('touchEnd');
  await page.until('!!document.querySelector("[role=dialog]")','Short tap retains picker');
  await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});await page.until('!document.querySelector("[role=dialog]")','Picker closes');
  await frameElement(source);const swipe=await point(source),previous=await ids(tier(0));
  await touch('touchStart',swipe);await touch('touchMove',{x:swipe.x,y:swipe.y-100});await delay(450);await touch('touchEnd');
  assert(!await page.evaluate('!!document.querySelector(".touch-drag-preview")'),'Immediate swipe never starts a drag');assert.deepEqual(await ids(tier(0)),previous);
  await frameElement(source);const held=await point(source);
  await touch('touchStart',held);await delay(250);await page.until('!!document.querySelector(".touch-drag-preview")','Edge drag starts');
  await page.evaluate('window.scrollTo(0,0)');
  await touch('touchMove',{x:held.x,y:await page.evaluate('innerHeight-90')});await delay(500);
  assert(await page.evaluate('scrollY>80'),'Holding near the screen edge auto-scrolls the page');
  await touch('touchCancel');await page.until('!document.querySelector(".touch-drag-preview")','Edge cancel cleans up');
  assert.equal(await page.evaluate('document.querySelectorAll("[data-item-id]").length'),6,'No lost or duplicate cards');
 }
 // Native mouse drag must keep working after introducing touch listeners.
 await page.send('Emulation.setTouchEmulationEnabled',{enabled:false});
 await page.evaluate('localStorage.clear()');await page.viewport(1440,1600);await page.goto(base+'/rank?template=mouse-after-touch');
 await page.until('document.querySelectorAll("[data-item-id]").length===6','Mouse items');
 await frameElement(pool);
 const mouseId=(await ids(pool))[0],from=await point(`document.querySelector('[data-item-id="${mouseId}"] .editor-item-main')`),to=await point(tier(0));
 await page.send('Input.dispatchMouseEvent',{type:'mouseMoved',...from});
 await page.send('Input.dispatchMouseEvent',{type:'mousePressed',...from,button:'left',buttons:1,clickCount:1});
 for(let step=1;step<=12;step++){await page.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:from.x+(to.x-from.x)*step/12,y:from.y+(to.y-from.y)*step/12,button:'left',buttons:1});await delay(25);}
 await page.send('Input.dispatchMouseEvent',{type:'mouseReleased',...to,button:'left',buttons:0,clickCount:1});
 await page.until(`!!(${tier(0)}).querySelector('[data-item-id="${mouseId}"]')`,'Native mouse drop');
 assert.deepEqual(failures,[]);assert.deepEqual(page.errors,[]);
 console.log('PASS: physical touch hold/drag, cross-tier moves, wrapped reorder, pool edge drops, cancel/outside, short tap/swipe, edge auto-scroll; Rank/Create at 390/430px; native desktop mouse drag.');
}finally{await browser.close();}
