// Isolated Local browser fixtures; no real login or account creation.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium, delay } from './helpers/chromium.mjs';
const base = process.env.UI_TEST_URL || 'http://127.0.0.1:8788';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const browser = await chromium({ port: 9363 });
try {
  const page = await browser.page();
  const requests = [], failures = [];
  page.on('Fetch.requestPaused', params => void (async () => {
    let body = { success: true, data: null }, status = 200;
    const pathname = new URL(params.request.url).pathname;
    if (params.request.method !== 'GET' && pathname === '/api/auth') {
      requests.push(JSON.parse(params.request.postData));
      status = 401; body = { success: false, error: 'Invalid email or password' };
    }
    assert(params.request.method === 'GET' || ['/api/auth', '/api/analytics'].includes(pathname), 'Only auth fixtures and background analytics may write');
    await page.send('Fetch.fulfillRequest', { requestId: params.requestId, responseCode: status, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: Buffer.from(JSON.stringify(body)).toString('base64') });
  })().catch(error => failures.push(String(error))));
  await page.send('Fetch.enable', { patterns: [{ urlPattern: '*/api/*' }] });
  await page.goto(base); await page.until('!!document.querySelector("nav")', 'navigation');
  const value = selector => page.evaluate(`document.querySelector(${JSON.stringify(selector)}).value`);
  const switchMode = async (label, register) => {
    await page.click(`[...document.querySelectorAll('button')].find(b=>!b.closest('[inert]') && b.getBoundingClientRect().width>0 && b.textContent.includes(${JSON.stringify(label)}))`);
    await page.until(`document.querySelector('.auth-card').classList.contains('auth-card--register')===${register}`, 'Mode changed');
    await delay(1050);
    assert.equal(await value('#login-password'), '');
    assert.equal(await value('#register-password'), '');
    assert.equal(await value('#register-confirm-password'), '');
    assert.equal(await value('#login-email'), '');
    assert.equal(await value('#register-email'), '');
    assert.equal(await value('#register-username'), '');
    assert.equal(await page.evaluate('!!document.querySelector("[role=alert]")'), false);
  };
  for (const lang of ['en', 'th']) for (const width of [390, 1440]) {
    const labels = JSON.parse(fs.readFileSync(`src/locales/${lang}.json`, 'utf8')).auth;
    await page.evaluate(`localStorage.setItem('tog-lang',${JSON.stringify(lang)})`);
    await page.viewport(width, 900); await page.goto(base + '/login');
    await page.until(`document.documentElement.lang===${JSON.stringify(lang)} && !!document.querySelector('#login-email')`, 'Login form');
    await page.field('#login-email', 'login@example.invalid');
    await page.field('#login-password', 'Dummy-login-123');
    assert.equal(await value('#register-email'), '');
    assert.equal(await value('#register-password'), '');
    await switchMode(labels.createAccountBtn, true);
    assert.equal(await value('#register-email'), '');
    await page.field('#register-email', 'signup@example.invalid');
    await page.field('#register-username', 'Independent member');
    await page.field('#register-password', 'Dummy-signup-456');
    await page.field('#register-confirm-password', 'Dummy-signup-456');
    assert.equal(await value('#login-email'), '');
    assert.equal(await value('#login-password'), '');
    await switchMode(labels.backToLoginBtn, false);
    assert.equal(await value('#login-email'), '');
    await page.field('#login-email', 'login@example.invalid');
    await page.field('#login-password', 'Dummy-login-123');
    await page.click('document.querySelector("#login-email").form.querySelector("button[type=submit]")');
    await page.until('!!document.querySelector("[role=alert]")', 'Fixture login failure');
    assert.deepEqual(requests.at(-1), { action: 'login', email: 'login@example.invalid', password: 'Dummy-login-123' });
    await switchMode(labels.createAccountBtn, true);
    assert.equal(await value('#register-email'), '');
    await page.field('#register-email', 'signup@example.invalid');
    await page.field('#register-username', 'Independent member');
    await page.field('#register-password', 'Dummy-signup-456');
    await page.field('#register-confirm-password', 'Dummy-signup-456');
    await page.click('document.querySelector("#register-email").form.querySelector("button[type=submit]")');
    await page.until('!!document.querySelector("[role=alert]")', 'Fixture signup failure');
    assert.deepEqual(requests.at(-1), { action: 'register', email: 'signup@example.invalid', password: 'Dummy-signup-456', username: 'Independent member' });
    await switchMode(labels.backToLoginBtn, false);
    assert.equal(await value('#login-email'), '');
    assert(!await page.evaluate('document.documentElement.scrollWidth>innerWidth+1'));
  }
  assert.equal(requests.length, 8); assert.deepEqual(failures, []); assert.deepEqual(page.errors, []);
  console.log('PASS: all login/signup fields cleared in both directions and on returning, no hidden password mirroring, error clearing, correct request payloads; EN/TH desktop/mobile.');
} finally { await browser.close(); }
