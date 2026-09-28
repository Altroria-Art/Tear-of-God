import assert from 'node:assert/strict';
import { preloadableImport } from '../../src/lib/preloadableImport.js';

let calls = 0, resolve;
const module = { default: () => null };
const loader = preloadableImport(() => {
  calls++;
  return new Promise(done => { resolve = done; });
});
loader.preload();
loader.preload();
const first = loader.load();
assert.equal(calls, 1, 'Preload and route render share one import');
resolve(module);
assert.equal(await first, module);
assert.equal(await loader.load(), module);
assert.equal(calls, 1);

let attempts = 0;
const retry = preloadableImport(async () => {
  if (++attempts === 1) throw new Error('Temporary chunk download failure');
  return module;
});
retry.preload();
await new Promise(done => setImmediate(done));
assert.equal(await retry.load(), module, 'Failed preload does not poison navigation');
assert.equal(attempts, 2);
console.log('Route import reuse and failed-preload recovery passed.');
