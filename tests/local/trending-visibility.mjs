import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { transform } from 'esbuild';

// Exercise the actual observer component with deterministic viewport/clock events.
const source = await readFile(new URL('../../src/pages/HomeFeed.jsx', import.meta.url), 'utf8');
const component = source.slice(source.indexOf('function SeenCardObserver('), source.indexOf('export default function HomeFeed'));
const { code } = await transform(component, { loader: 'jsx' });
let effect;
let cleanup;
let observer;
let clock = 0;
let nextTimer = 0;
const timers = new Map();
const listeners = new Map();
const seen = [];
const document = {
  hidden: false,
  addEventListener: (event, callback) => listeners.set(event, callback),
  removeEventListener: event => listeners.delete(event),
};
const context = vm.createContext({
  document,
  useRef: () => ({ current: {} }),
  useEffect: callback => { effect = callback; },
  React: { createElement: () => null },
  setTimeout: (callback, delay) => { timers.set(++nextTimer, { callback, at: clock + delay }); return nextTimer; },
  clearTimeout: id => timers.delete(id),
  IntersectionObserver: class {
    constructor(callback) { this.callback = callback; observer = this; }
    observe() {}
    disconnect() { this.disconnected = true; }
  },
});
vm.runInContext(code, context);
function mount() {
  context.SeenCardObserver({ postId: 'A', onSeen: id => seen.push(id), children: null });
  cleanup = effect();
}
function visible(ratio) {
  observer.callback([{ isIntersecting: ratio > 0, intersectionRatio: ratio }]);
}
function advance(ms) {
  clock += ms;
  for (const [id, timer] of timers) {
    if (timer.at <= clock) { timers.delete(id); timer.callback(); }
  }
}
mount();
visible(0.6);
advance(700);
assert.deepEqual(seen, [], '700ms is not more than 700ms');
visible(0);
advance(1);
assert.deepEqual(seen, [], 'leaving viewport cancels pending seen');
visible(0.6);
advance(400);
document.hidden = true;
listeners.get('visibilitychange')();
advance(1000);
assert.deepEqual(seen, [], 'background tabs cannot mark seen');
document.hidden = false;
listeners.get('visibilitychange')();
advance(701);
assert.deepEqual(seen, ['A']);
assert.equal(observer.disconnected, true);
cleanup();
assert.equal(listeners.size, 0);
seen.length = 0;
mount();
visible(0.8);
cleanup();
advance(701);
assert.deepEqual(seen, [], 'unmount cancels seen');
// React StrictMode replays the effect, so observation must restart correctly.
cleanup = effect();
visible(0.8);
advance(701);
assert.deepEqual(seen, ['A']);
cleanup();
console.log('Trending visibility passed: >700ms, viewport exit, background tab, unmount, StrictMode replay.');

// Run the actual click handler repeatedly before a React effect could acquire a lock.
const refreshStart = source.indexOf('  const refreshFeed = useCallback(');
const refreshEnd = source.indexOf('}, [activeTab, cacheKey, posts, feedLocked]);', refreshStart) + '}, [activeTab, cacheKey, posts, feedLocked]);'.length;
let requests = 0;
const loadingRef = { current: false };
const refreshContext = vm.createContext({
  useCallback: callback => callback,
  loadingRef,
  feedLocked: false,
  activeTab: 'trending',
  Date: { now: () => clock + 10000 },
  lastRefreshRef: { current: 0 },
  isManualRefreshRef: { current: false },
  posts: [{ id: 'not-yet-visible' }],
  cacheKey: 'trending:guest',
  seenFeedIdsRef: { current: {} },
  feedCacheRef: { current: {} },
  requestGenerationRef: { current: 0 },
  pageRef: { current: 1 },
  setIsLoading() {},
  window: { scrollTo() {} },
  setRefreshTrigger: () => { requests += 1; },
});
vm.runInContext(source.slice(refreshStart, refreshEnd) + '\nglobalThis.refresh = refreshFeed;', refreshContext);
for (let i = 0; i < 20; i += 1) refreshContext.refresh();
assert.equal(requests, 1, 'rapid Home/Logo/Trending events schedule only one request');
loadingRef.current = false;
refreshContext.refresh();
assert.equal(requests, 1, 'cooldown also blocks rapid completed requests');
advance(3001);
refreshContext.refresh();
assert.equal(requests, 2, 'later refresh can discover a new ranking');
console.log('Trending refresh passed: synchronous request lock and cooldown.');
