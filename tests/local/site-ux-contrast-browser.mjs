// Run site-ux-audit-browser first on an isolated Pages/D1 server. This check
// measures rendered text on solid backgrounds; gradients/images/opacity are
// excluded and reported. It is not a full WCAG conformance assessment.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium, delay } from './helpers/chromium.mjs';
import { siteFixture } from './helpers/site-audit-fixture.mjs';

const { base, output, accounts, password } = await siteFixture();
const audit = JSON.parse(fs.readFileSync(path.join(output, 'after-site-audit.json'), 'utf8'));
assert.equal(audit.phase, 'after');
const routes = [...new Map(audit.results.map(row => [row.name, { name: row.name, url: row.url, role: row.role }])).values()];

function inspectContrast() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const cache = new Map();
  const rgba = value => {
    if (!cache.has(value)) {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = value;
      context.fillRect(0, 0, 1, 1);
      const color = Array.from(context.getImageData(0, 0, 1, 1).data);
      color[3] /= 255;
      cache.set(value, color);
    }
    return cache.get(value);
  };
  const composite = (foreground, background) => foreground.slice(0, 3)
    .map((value, index) => value * foreground[3] + background[index] * (1 - foreground[3])).concat(1);
  const luminance = color => color.slice(0, 3).map(value => {
    value /= 255;
    return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
  }).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);

  const failures = [];
  let checked = 0, skipped = 0;
  for (const element of document.querySelectorAll('main *, nav *, .auth-book *')) {
    const text = [...element.childNodes].filter(node => node.nodeType === Node.TEXT_NODE)
      .map(node => node.textContent.trim()).join(' ').trim();
    if (!text || element.closest('svg,[inert],[aria-hidden=true],button:disabled') || !element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
    const bounds = element.getBoundingClientRect();
    if (bounds.right <= 0 || bounds.left >= innerWidth || bounds.bottom <= 0) continue;
    const ancestors = [];
    for (let parent = element; parent; parent = parent.parentElement) ancestors.push(parent);
    if (ancestors.some(parent => getComputedStyle(parent).backgroundImage !== 'none' || getComputedStyle(parent).opacity !== '1')) { skipped++; continue; }
    let background = [255, 255, 255, 1];
    for (const parent of ancestors.reverse()) background = composite(rgba(getComputedStyle(parent).backgroundColor), background);
    const style = getComputedStyle(element);
    const foreground = composite(rgba(style.color), background);
    const light = luminance(foreground), dark = luminance(background);
    const ratio = (Math.max(light, dark) + .05) / (Math.min(light, dark) + .05);
    const large = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.666 && parseInt(style.fontWeight) >= 700);
    const required = large ? 3 : 4.5;
    checked++;
    if (ratio < required) failures.push({ text: text.slice(0, 80), ratio: +ratio.toFixed(2), required, color: style.color, background: background.slice(0, 3).map(Math.round) });
  }
  return { checked, skipped, failures };
}

const browser = await chromium({ port: 9385 });
const results = [];
try {
  const pages = {};
  for (const role of ['guest', 'user', 'admin']) {
    const page = await browser.page();
    pages[role] = page;
    await page.viewport(390);
    await page.goto(base + '/login');
    await page.until('!!document.querySelector("#login-email")', 'login');
    if (role !== 'guest') {
      const account = accounts[role === 'admin' ? 2 : 0];
      await page.field('#login-email', account.email);
      await page.field('#login-password', password);
      await page.click(`document.querySelector('#login-email').form.querySelector('[type=submit]')`);
      await page.until(`location.pathname !== '/login'`, 'actual form login');
      assert.equal((await page.evaluate(`fetch('/api/auth').then(response => response.json())`)).data.id, account.id);
    }
  }
  for (const route of routes) for (const theme of ['light', 'dark']) {
    const page = pages[route.role];
    await page.evaluate(`localStorage.setItem('tog-theme',${JSON.stringify(theme)});localStorage.setItem('tog-lang','th');`);
    await page.goto(base + route.url);
    await page.until('!!document.querySelector("h1")', 'page heading');
    await delay(700);
    results.push({ ...route, theme, ...await page.evaluate(`(${inspectContrast.toString()})()`) });
  }
  for (const page of Object.values(pages)) assert.deepEqual(page.errors, []);
} finally {
  fs.writeFileSync(path.join(output, 'contrast.json'), JSON.stringify(results, null, 2));
  await browser.close();
}
const failures = results.flatMap(row => row.failures.map(failure => ({ name: row.name, theme: row.theme, ...failure })));
console.log(JSON.stringify({ screens: results.length, checked: results.reduce((sum, row) => sum + row.checked, 0), skipped: results.reduce((sum, row) => sum + row.skipped, 0), failures }, null, 2));
assert.equal(results.length, routes.length * 2, 'Both themes on every audited route case');
assert.equal(failures.length, 0, 'Text on measured solid backgrounds meets the applicable contrast threshold');
