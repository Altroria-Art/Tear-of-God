// Local fixture QA: no real accounts, content deletion or remote API requests.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium, delay } from './helpers/chromium.mjs';

const base = process.env.UI_TEST_URL || 'http://127.0.0.1:8807';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const out = path.resolve('.wrangler/admin-confirmation-qa');
fs.mkdirSync(out, { recursive: true });
const admin = { id: 'qa-admin', username: 'QA admin', role: 'admin', created_at: '2026-10-09 00:00:00' };
const target = { id: 'qa-target', username: 'QA member', role: 'user', title: 'QA topic with a long name — ' + 'Campus drinks '.repeat(10), email: 'qa@example.test', creator: admin, use_count: 3, view_count: 5, hashtags: '#UP', created_at: '2026-10-09 00:00:00' };
const browser = await chromium({ port: 9360 });
const page = await browser.page();
const errors = [], mutations = [], results = [];
let reportKind = 'template';
let reportResolved = false;
page.on('Page.javascriptDialogOpening', () => errors.push('Unexpected native dialog'));
page.on('Fetch.requestPaused', params => void (async () => {
  const url = new URL(params.request.url);
  if (params.request.method !== 'GET') { mutations.push(params); return; }
  let body = { success: true, data: [], total: 0 };
  if (url.pathname === '/api/auth') body.data = admin;
  else if (url.pathname === '/api/admin/users') {
    body.data = url.searchParams.get('role') === 'admin' ? [admin] : [target]; body.total = 1;
  } else if (['/api/admin/templates', '/api/admin/rankings'].includes(url.pathname)) { body.data = [target]; body.total = 1; }
  else if (url.pathname === '/api/admin/reports') {
    const record = { id: 'qa-report', kind: reportKind, status: reportResolved ? 'resolved' : 'pending', moderation_action: reportResolved ? 'deleted' : 'pending', target_removed_at: reportResolved ? target.created_at : null, reason: 'QA report', template_id: target.id, ranking_id: target.id, comment_id: target.id, template_comment_id: target.id, template_title: target.title, ranking_title: target.title, comment_content: 'QA comment', template_comment_content: 'QA comment', reporter: admin, created_at: target.created_at,
      snapshot: { title: 'Saved QA title', text: 'Saved QA text <script>test</script>' }, history: [{ action: 'pending', created_at: target.created_at }, ...(reportResolved ? [{ action: 'deleted', actor_name: admin.username, created_at: target.created_at }] : [])] };
    const included = !url.searchParams.has('count') && (url.searchParams.get('status') === 'all' || url.searchParams.get('status') === record.status);
    body = { success: true, pending_count: reportResolved ? 0 : 1, total: included ? 1 : 0, data: included ? [record] : [] };
  }
  await page.send('Fetch.fulfillRequest', { requestId: params.requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: Buffer.from(JSON.stringify(body)).toString('base64') });
})().catch(error => errors.push(String(error))));

const deleteButton = '[...document.querySelectorAll("tbody button")].find(b => b.querySelector("svg[class*=lucide-trash]"))';
const dialog = 'document.querySelector("[role=dialog]")';
const fulfill = (request, success) => {
  if (success && JSON.parse(request.request.postData).action === 'delete_content') reportResolved = true;
  return page.send('Fetch.fulfillRequest', { requestId: request.requestId, responseCode: success ? 200 : 500, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: Buffer.from(JSON.stringify(success ? { success: true } : { success: false, error: 'Internal server error' })).toString('base64') });
};
try {
  await page.send('Fetch.enable', { patterns: [{ urlPattern: '*/api/*' }] });
  await page.goto(base); await page.until('!!document.querySelector("nav")', 'navigation');
  const cases = [];
  for (const lang of ['en', 'th']) for (const width of [1440, 390]) for (const route of ['users', 'rankings', 'templates', 'reports']) cases.push({ lang, width, route, kind: 'template' });
  for (const kind of ['post', 'comment', 'template_comment']) cases.push({ lang: 'en', width: 1440, route: 'reports', kind });
  for (const scenario of cases) {
    const { lang, width, route, kind } = scenario;
    reportKind = kind;
    reportResolved = false;
    await page.evaluate(`localStorage.setItem('tog-lang',${JSON.stringify(lang)})`);
    await page.viewport(width); await page.goto(`${base}/admin/${route}`);
    await page.until(`location.pathname==='/admin/${route}' && document.documentElement.lang===${JSON.stringify(lang)} && !!(${deleteButton})`, 'admin row');
    const initial = mutations.length;
    await page.click(deleteButton);
    await page.until(`!!(${dialog})`, 'custom confirmation');
    assert.equal(mutations.length, initial, 'Opening confirmation does not delete');
    const appearance = await page.evaluate(`(() => { const d=${dialog},p=d.querySelector('.dialog-panel'),r=p.getBoundingClientRect();return {count:document.querySelectorAll('[role=dialog]').length,modal:d.getAttribute('aria-modal'),top:getComputedStyle(p).borderTopWidth,inside:r.left>=0 && r.right<=innerWidth,focus:d.contains(document.activeElement),overflow:p.scrollWidth>p.clientWidth+1}; })()`);
    assert.equal(appearance.count, 1); assert.equal(appearance.modal, 'true'); assert.equal(appearance.top, '5px');
    assert(appearance.inside && appearance.focus && !appearance.overflow, 'Dialog fits viewport and holds focus');
    if (route === 'templates') await page.screenshot(path.join(out, `${lang}-${width}.png`));
    await page.click("document.querySelector('.dialog-secondary')");
    await page.until(`!(${dialog})`, 'cancel closed');
    assert.equal(mutations.length, initial, 'Cancel never deletes');
    await page.click(deleteButton);
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' });
    await page.until(`!(${dialog})`, 'escape closed');
    assert.equal(mutations.length, initial);
    await page.click(deleteButton);
    await page.evaluate("document.querySelector('.modal--action > .absolute').click()");
    await page.until(`!(${dialog})`, 'backdrop closed');
    assert.equal(mutations.length, initial);
    await page.click(deleteButton);
    await page.click("document.querySelector('.dialog-danger')");
    for (let attempt = 0; mutations.length === initial && attempt < 100; attempt++) await delay(30);
    assert.equal(mutations.length, initial + 1, 'One confirmed mutation');
    assert.equal(JSON.parse(mutations.at(-1).request.postData).target_id, route === 'reports' ? 'qa-report' : target.id, 'Correct target');
    const expected = route;
    assert.equal(new URL(mutations.at(-1).request.url).pathname, `/api/admin/${expected}`);
    if (route === 'reports') assert.equal(JSON.parse(mutations.at(-1).request.postData).action, 'delete_content');
    await page.evaluate("document.querySelector('.dialog-danger').click();document.querySelector('.dialog-secondary').click();document.querySelector('.modal--action > .absolute').click()");
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' });
    await delay(100);
    assert(await page.evaluate(`!!(${dialog}) && document.querySelector('.dialog-danger').disabled && document.querySelector('.dialog-secondary').disabled`), 'Pending deletion locks confirmation');
    assert.equal(mutations.length, initial + 1, 'Repeated clicks do not duplicate deletion');
    await fulfill(mutations.at(-1), false);
    await page.until(`!!(${dialog}) && !document.querySelector('.dialog-danger').disabled`, 'Failure allows retry');
    assert(await page.evaluate(`!!(${deleteButton})`), 'Failed deletion keeps row');
    await page.click("document.querySelector('.dialog-danger')");
    for (let attempt = 0; mutations.length < initial + 2 && attempt < 100; attempt++) await delay(30);
    assert.equal(mutations.length, initial + 2);
    await fulfill(mutations.at(-1), true);
    await page.until(`!(${dialog}) && !(${deleteButton})`, 'Success closes dialog and removes row');
    if (route === 'reports') {
      const labels = JSON.parse(fs.readFileSync(`src/locales/${lang}.json`, 'utf8')).admin;
      assert.equal(await page.evaluate(`[...document.querySelectorAll('button')].filter(b=>${JSON.stringify([labels.statusPending, labels.statusResolved, 'All reports', 'รายงานทั้งหมด'])}.includes(b.textContent.trim())).length`), 2, 'Only Pending and Resolved tabs');
      await page.click(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(labels.statusResolved)})`);
      await page.until(`document.querySelector('tbody')?.textContent.includes(${JSON.stringify(labels.reportActionDeleted)})`, 'Deleted report remains in Resolved');
      await page.click(`[...document.querySelectorAll('tbody button')].find(b=>b.textContent.trim()===${JSON.stringify(labels.reportDetails)})`);
      await page.until(`${dialog}?.textContent.includes('Saved QA text <script>test</script>')`, 'Saved raw text and history');
      assert(await page.evaluate(`${dialog}.textContent.includes('QA admin')`));
      assert(!await page.evaluate(`${dialog}.querySelector('script') !== null`), 'Saved text is not HTML');
      await page.screenshot(path.join(out, `${lang}-${width}-${kind}-record.png`));
      await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' });
      await page.until(`!(${dialog})`, 'Record closed');
      await page.click(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(labels.statusPending)})`);
      await page.until(`!document.querySelector('tbody') && document.body.textContent.includes(${JSON.stringify(labels.noReports)})`, 'Reviewed report does not appear in Pending');
    }
    results.push(scenario);
  }
  assert.deepEqual(errors, []); assert.deepEqual(page.errors, []);
  fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(results, null, 2));
  console.log(`PASS: ${results.length} admin delete scenarios, cancel/Escape/backdrop, pending lock, no duplicate delete, failure/retry, correct target/API and successful row removal.`);
} finally { await browser.close(); }
