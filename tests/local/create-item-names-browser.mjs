// Run only against a Pages dev server with isolated BROWSER_QA_STATE.
// Real form submissions + D1: no API responses are intercepted.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium, delay } from './helpers/chromium.mjs';
import { siteFixture } from './helpers/site-audit-fixture.mjs';

const { base, accounts, password, output } = await siteFixture();
const names = ['มะม่วง', 'มะยม', 'มะขาม', 'มะขามป้อม', 'มะขามแขก', 'นู้นนี้', 'นู้นนั้น', 'นั้นนู้น'];
const copies = Object.fromEntries(['th', 'en'].map(lang => [lang, JSON.parse(fs.readFileSync(`src/locales/${lang}.json`, 'utf8'))]));
const results = [];
const browser = await chromium({ port: 9390 });

async function go(page, route, selector) {
  await page.goto(base + route); await delay(250);
  await page.until(`location.pathname===${JSON.stringify(route)} && !!document.querySelector(${JSON.stringify(selector)})`, route);
}
const visibleNames = page => page.evaluate(`[...document.querySelectorAll('.editor-item-main')].map(e=>e.textContent.trim())`);
const notify = (page, text) => page.until(`[...document.querySelectorAll('[aria-live]')].some(e=>e.textContent.includes(${JSON.stringify(text)}))`, text);
async function post(page, title, expectedNames) {
  await page.field('#create-list-name', title);
  await page.click(`[...document.querySelectorAll('.create-publish-panel button')].find(e=>e.textContent.includes('#'))`);
  await page.click(`document.querySelector('.editor-toolbar-float .play-button')`);
  await page.until(`location.pathname.startsWith('/post/') && !!document.querySelector('main h1')`, 'post saved');
  const data = await page.evaluate(`fetch('/api/rankings?id='+location.pathname.split('/').pop()).then(r=>r.json())`);
  assert(data.success);
  assert.deepEqual(data.data.ranking_items.map(item => item.item.name), expectedNames);
  await page.goto(base + '/post/' + data.data.id); await delay(250);
  await page.until(`!!document.querySelector('main h1')`, 'post refreshed');
  const refreshed = await page.evaluate(`fetch('/api/rankings?id='+location.pathname.split('/').pop()).then(r=>r.json())`);
  assert.deepEqual(refreshed.data.ranking_items.map(item => item.item.name), expectedNames);
  return data.data.id;
}

try {
  for (const lang of ['th', 'en']) for (const width of [390, 1440]) {
    const page = await browser.page(), copy = copies[lang];
    await page.viewport(width);
    await go(page, '/login', '#login-email');
    await page.evaluate(`localStorage.setItem('tog-lang',${JSON.stringify(lang)});localStorage.setItem('tog-theme',${JSON.stringify(width===390?'dark':'light')})`);
    await page.field('#login-email', accounts[width===390?1:2].email); await page.field('#login-password', password);
    await page.click(`document.querySelector('#login-email').closest('form').querySelector('[type=submit]')`);
    await page.until(`location.pathname!=='/login'`, 'login');
    const submissions = [];
    page.on('Network.requestWillBeSent', event => { if (event.request.url.endsWith('/api/rankings') && event.request.method==='POST') submissions.push(event.request.postData); });

    await go(page, '/create', '.quick-add-panel textarea');
    await page.field('.quick-add-panel textarea', [...names, 'มะขาม', 'มะขามหวาน'].join(', '));
    await page.click(`document.querySelector('.quick-add-panel>div:last-child button')`);
    const expected = [...names, 'มะขามหวาน'];
    await page.until(`document.querySelectorAll('[data-item-id]').length===9`, 'exact duplicates skipped');
    assert.deepEqual(await visibleNames(page), expected);
    await notify(page, copy.create.skippedDuplicateItems.split('{{names}}')[0]);
    await page.field('.quick-add-panel textarea', 'มะขามหวาน\nมะขามเปรี้ยว\nมะขาม');
    await page.click(`document.querySelector('.quick-add-panel>div:last-child button')`);
    expected.push('มะขามเปรี้ยว');
    await page.until(`document.querySelectorAll('[data-item-id]').length===10`, 'duplicates across batches skipped');
    assert.deepEqual(await visibleNames(page), expected);
    await delay(220); await go(page, '/create', '.quick-add-panel textarea');
    assert.deepEqual(await visibleNames(page), expected, 'draft restores every distinct name');
    for (let index=0; index<expected.length; index++) {
      await page.click(`document.querySelector('.create-unranked .editor-item-main')`);
      await page.until(`!!document.querySelector('[role=dialog]')`, 'tier picker'); await delay(240);
      await page.click(`document.querySelector('[role=dialog] button[aria-label=${JSON.stringify(copy.editor.moveTo.replace('{{tier}}','S'))}]')`);
      await page.until(`!document.querySelector('[role=dialog]')`, 'assigned');
    }
    const mixedPost = await post(page, `Similar Thai names ${lang}/${width} ${Date.now()}`, expected);
    assert.equal(submissions.length, 1);

    const tiers = [{ id:'t1', label:'มะขาม', color:'#f87171' }, { id:'t2', label:'มะขามป้อม', color:'#fdba74' }];
    const draft = { version:1, title:'Old draft repair', selectedHashtags:['#มพ'], tiers, items:names.map((content,index)=>({ id:'old-'+index, content, tierId:'t1' })) };
    draft.items.push({ id:'repeat', content:' มะขาม ', tierId:'t2' });
    await page.evaluate(`localStorage.setItem('tog-create-draft',${JSON.stringify(JSON.stringify(draft))})`);
    await go(page, '/create', '[data-create-duplicate-warning]');
    assert.equal((await visibleNames(page)).length, 9, 'no silent draft deletion');
    assert((await page.evaluate(`document.querySelector('[data-create-duplicate-warning]').textContent`)).includes('มะขาม'));
    await page.click(`document.querySelector('.editor-toolbar-float .play-button')`);
    await notify(page, copy.create.errDuplicateItems.split('{{names}}')[0]);
    await delay(200); assert.equal(submissions.length, 1, 'known duplicate blocked before API/quota');
    assert(await page.evaluate(`document.documentElement.scrollWidth<=document.documentElement.clientWidth+1`), 'no page overflow');
    assert(await page.evaluate(`document.querySelector('[data-create-duplicate-warning] button').getBoundingClientRect().height>=44`));
    const contrast = await page.evaluate(`(()=>{
      const box=document.querySelector('[data-create-duplicate-warning]');
      const luminance=color=>{const rgb=color.match(/[\\d.]+/g).slice(0,3).map(Number).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
      const background=luminance(getComputedStyle(box).backgroundColor);
      return [...box.querySelectorAll('p')].map(p=>{const foreground=luminance(getComputedStyle(p).color);return (Math.max(background,foreground)+.05)/(Math.min(background,foreground)+.05);});
    })()`);
    assert(contrast.every(ratio=>ratio>=4.5), 'warning text readable in both themes: '+contrast);
    await page.screenshot(path.join(output, `create-name-warning-${lang}-${width}.png`));
    await page.click(`document.querySelector('[data-create-duplicate-warning] button')`);
    await page.until(`!document.querySelector('[data-create-duplicate-warning]')`, 'repaired');
    assert.deepEqual(await visibleNames(page), names);
    // Allow the normal autosave debounce before inspecting placement persistence.
    await delay(220);
    const saved = await page.evaluate(`JSON.parse(localStorage.getItem('tog-create-draft')).items`);
    assert.equal(saved.length, 8); assert(saved.every(item=>item.tierId==='t1'));
    assert.equal(saved[2].id, 'old-2', 'first card retains its identity');
    const repairedPost = await post(page, `Repaired draft ${lang}/${width} ${Date.now()}`, names);
    assert.equal(submissions.length, 2);

    const badTiers = { ...draft, items:saved, tiers:[tiers[0],{ ...tiers[1], label:' มะขาม ' }] };
    await page.evaluate(`localStorage.setItem('tog-create-draft',${JSON.stringify(JSON.stringify(badTiers))})`);
    await go(page, '/create', '.quick-add-panel textarea');
    await page.click(`document.querySelector('.editor-toolbar-float .play-button')`);
    await notify(page, copy.create.errDuplicateTiers.split('{{names}}')[0]);
    await delay(200); assert.equal(submissions.length, 2, 'duplicate tiers give a specific message before API');
    assert.deepEqual(page.errors, []);
    results.push({ lang, width, theme:width===390?'dark':'light', posts:[mixedPost,repairedPost], checks:'similar names, mixed/old duplicates, custom tiers, draft/refresh, zero invalid API calls, layout' });
    console.log(`Create names Browser QA passed ${lang}/${width}: 2 real posts, draft repair and duplicate preflight.`);
  }
  fs.writeFileSync(path.join(output, 'create-item-names-browser.json'), JSON.stringify(results,null,2));
} finally { await browser.close(); }
