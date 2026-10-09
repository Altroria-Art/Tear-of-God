import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { transform } from 'esbuild';
import { isTrendingCardVisible } from '../../src/lib/trendingSeen.js';

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
  isTrendingCardVisible,
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
function visible(ratio, height = 100) {
  observer.callback([{ isIntersecting: ratio > 0, intersectionRatio: ratio,
    boundingClientRect: { width: 100, height }, rootBounds: { width: 100, height: 100 },
    intersectionRect: { width: 100, height: height * ratio } }]);
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
seen.length = 0;
mount();
visible(0.05, 400);
advance(701);
assert.deepEqual(seen, [], 'a sliver of a tall card is not enough');
visible(0.2, 400);
advance(701);
assert.deepEqual(seen, ['A'], 'tall card occupying most of the viewport is remembered even below 50% card intersection');
cleanup();
console.log('Trending visibility passed: dwell, exit, background, unmount, StrictMode and tall cards.');

// Run the actual click handler repeatedly before a React effect could acquire a lock.
const refreshStart = source.indexOf('  const refreshFeed = useCallback(');
const refreshEnd = source.indexOf('  refreshFeedRef.current = refreshFeed;', refreshStart);
assert.ok(refreshStart >= 0 && refreshEnd > refreshStart, 'Refresh handler must be found before executing it');
let requests = 0;
const loadingRef = { current: false };
const queuedRefreshRef = { current: null };
const refreshFeedRef = { current: null };
const activeRefreshKeyRef = { current: 'trending:guest' };
let queuedTimer;
const manuallySeen = new Set();
const refreshContext = vm.createContext({
  useCallback: callback => callback,
  loadingRef,
  inFlightRef: { current: false },
  feedLocked: false,
  activeTab: 'trending',
  queuedRefreshRef, refreshFeedRef, activeRefreshKeyRef,
  refreshTimerRef: { current: null },
  setTimeout: callback => { queuedTimer = callback; return 1; },
  clearTimeout() {},
  document: { querySelectorAll: () => [{ dataset: { socialRanking: 'tall-visible' },
    getBoundingClientRect: () => ({ top: 0, bottom: 1200, left: 0, right: 390, width: 390, height: 1200 }) }] },
  isTrendingCardVisible,
  markTrendingSeen: ids => ids.forEach(id => manuallySeen.add(id)),
  isManualRefreshRef: { current: false },
  postsRef: { current: [{ id: 'not-yet-visible' }] },
  cacheKey: 'trending:guest',
  seenFeedIdsRef: { current: {} },
  feedCacheRef: { current: {} },
  requestGenerationRef: { current: 0 },
  pageRef: { current: 1 },
  setIsLoading() {},
  setIsRefreshing() {},
  window: { innerWidth: 390, innerHeight: 300, scrollTo() {} },
  setRefreshTrigger: () => { requests += 1; },
});
vm.runInContext(source.slice(refreshStart, refreshEnd) + '\nglobalThis.refresh = refreshFeed;', refreshContext);
refreshFeedRef.current = refreshContext.refresh;
const flushStart = source.indexOf('  const flushQueuedRefresh = useCallback(');
const flushEnd = source.indexOf('  useEffect(', flushStart);
vm.runInContext(source.slice(flushStart, flushEnd) + '\nglobalThis.flush = flushQueuedRefresh;', refreshContext);
for (let i = 0; i < 20; i += 1) refreshContext.refresh();
assert.equal(requests, 1, 'rapid Home/Logo/Trending events schedule only one request');
assert.equal(queuedRefreshRef.current, 'trending:guest', 'clicks during load coalesce into one pending refresh');
assert.deepEqual([...manuallySeen], ['tall-visible'], 'explicit refresh records only the visible card before its dwell timer');
loadingRef.current = false;
refreshContext.flush();
queuedTimer();
assert.equal(requests, 2, 'queued refresh starts after the first request completes');
assert.equal(queuedRefreshRef.current, null);
loadingRef.current = false;
refreshContext.refresh();
assert.equal(requests, 3, 'a completed request has no arbitrary 1.5-second click cooldown');
refreshContext.refresh();
activeRefreshKeyRef.current = 'following:guest';
loadingRef.current = false;
queuedTimer = null;
refreshContext.flush();
assert.equal(queuedTimer, null, 'switching feeds drops the old feed queued click');
refreshContext.feedLocked = true;
refreshContext.refresh();
assert.equal(requests, 3, 'locked feed cannot schedule a request');
console.log('Trending refresh passed: one in-flight request, one coalesced follow-up, no cooldown, visible-card history and feed isolation.');
