import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { writeFile, unlink } from 'node:fs/promises';
import { renderToString } from 'react-dom/server';
import { createElement } from 'react';

const output = new URL('./.client-request-audit.mjs', import.meta.url);
const pending = [];
globalThis.window = new EventTarget();
globalThis.document = { documentElement: { lang: '' } };
Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('Storage disabled'); } });
globalThis.fetch = (url) => typeof url === 'object'
  ? Promise.resolve(Response.json(url)) // esbuild treats Vite's JSON ?url import as JSON in this Node fixture.
  : new Promise(resolve => pending.push({ url, resolve }));
let expired = 0;
window.addEventListener('tog-session-expired', () => { expired += 1; });
const bundled = await build({
  stdin: { contents: "export * from './src/lib/api.js'; export { ThemeProvider } from './src/context/ThemeContext.jsx'; export { switchLanguage } from './src/i18n.js';", resolveDir: process.cwd() },
  bundle: true, platform: 'node', format: 'esm', packages: 'external', jsx: 'automatic', write: false,
});
await writeFile(output, bundled.outputFiles[0].text);
try {
  const api = await import(output.href);
  assert.equal(document.documentElement.lang, 'en');
  await api.switchLanguage('th');
  assert.equal(document.documentElement.lang, 'th', 'Language works when storage is blocked');
  assert.match(renderToString(createElement(api.ThemeProvider, null, createElement('span', null, 'working'))), /working/);
  const oldA = api.fetchNotifications();
  const oldB = api.fetchNotifications();
  assert.equal(pending.length, 1, 'Same-session requests deduplicate');
  api.invalidateSessionRequests();
  const freshA = api.fetchNotifications();
  assert.equal(pending.length, 2, 'New identity must not reuse previous request');
  pending[0].resolve(Response.json({ success: false }, { status: 401 }));
  await Promise.all([oldA, oldB]);
  assert.equal(expired, 0, 'Old 401 cannot log out the new session');
  const freshB = api.fetchNotifications();
  assert.equal(pending.length, 2, 'Old finally must not remove a newer pending request');
  pending[1].resolve(Response.json({ success: true, data: [{ id: 'new-user-only' }] }));
  assert.deepEqual((await freshA).data, (await freshB).data);
  const failedBookmarks = api.fetchBookmarkedTemplateIds();
  pending[2].resolve(Response.json({ success: false, error: 'unavailable' }, { status: 503 }));
  assert.equal(await failedBookmarks, null, 'Failure is distinguishable from an empty saved list');
  const oldSimilar = api.fetchSimilarUsers('profile', 'viewer');
  api.invalidateSessionRequests();
  pending[3].resolve(Response.json({ success: true, data: { taste_match: 'old' } }));
  await oldSimilar;
  const newSimilar = api.fetchSimilarUsers('profile', 'viewer');
  assert.equal(pending.length, 5, 'Late result cannot repopulate cleared session cache');
  pending[4].resolve(Response.json({ success: true, data: { taste_match: 'new' } }));
  assert.equal((await newSimilar).data.taste_match, 'new');
  for (const mutate of [() => api.updateProfile('old', { bio: 'old' }), () => api.equipBadge(null), () => api.setProfilePin('ranking', true)]) {
    const stale = mutate();
    api.invalidateSessionRequests();
    pending.at(-1).resolve(Response.json({ success: false }, { status: 401 }));
    await stale;
    assert.equal(expired, 0, 'Stale mutation 401 cannot expire the replacement session');
    const current = mutate();
    pending.at(-1).resolve(Response.json({ success: false }, { status: 401 }));
    await current;
    assert.equal(expired, 1, 'Current mutation expires the session exactly once');
    expired = 0;
  }
  console.log('Client session request isolation, failure states and blocked-storage boot passed.');
} finally {
  await unlink(output);
}
