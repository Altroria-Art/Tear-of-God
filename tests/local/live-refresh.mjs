import assert from 'node:assert/strict';
import { beginDataChange, DATA_CHANGE_EVENT, startLiveRefresh } from '../../src/lib/liveRefresh.js';

const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
function harness(load, apply, extra = {}) {
  const target = new EventTarget();
  target.navigator = { onLine: true };
  const doc = new EventTarget();
  doc.visibilityState = 'visible';
  let time = 0;
  let next = 0;
  const timers = new Map();
  const live = startLiveRefresh({ load, apply, target, doc, now: () => time,
    setTimer: (fn, delay) => { const id = ++next; timers.set(id, { fn, at: time + delay }); return id; },
    clearTimer: id => timers.delete(id), ...extra });
  return { live, target, doc, timers,
    async tick(ms) {
      time += ms;
      const due = [...timers].filter(([, timer]) => timer.at <= time);
      for (const [id, timer] of due) { timers.delete(id); timer.fn(); }
      await flush();
    },
    change(phase, id = 'write', path = '/api/comments') {
      target.dispatchEvent(new CustomEvent(DATA_CHANGE_EVENT, { detail: { phase, id, path } }));
    },
  };
}

// Shared public snapshots are only for periodic reads. Own/cross-tab writes,
// retries and the initial load must bypass them, including slow read races.
const policies=[];
const policy=harness(async (_signal,options)=>{policies.push(options);return {success:true};},()=>{});
await flush();
assert.equal(policies.at(-1).fresh,true);
await policy.tick(10000);
assert.equal(policies.at(-1).fresh,false);
policy.change('started');policy.change('settled');
await flush();
assert.equal(policies.at(-1).fresh,true);
await policy.live.refresh(true);
assert.equal(policies.at(-1).fresh,true);
policy.live.stop();

// Another user adds a comment while this visitor reads, without clicking.
let server = { success: true, data: [], unreadCount: 0 };
let calls = 0;
let screen;
const h = harness(async () => { calls++; return server; }, result => { screen = result; });
await flush();
assert.equal(calls, 1);
server = { success: true, data: [{ id: 'new-comment' }], unreadCount: 1 };
await h.tick(9999);
assert.equal(screen.unreadCount, 0);
await h.tick(1);
assert.equal(screen.unreadCount, 1);
assert.equal(screen.data[0].id, 'new-comment');

// Hidden/offline tabs make no requests; returning fetches without a reload.
h.doc.visibilityState = 'hidden';
h.doc.dispatchEvent(new Event('visibilitychange'));
await h.tick(60000);
assert.equal(calls, 2);
assert.equal(h.timers.size, 0);
h.doc.visibilityState = 'visible';
h.doc.dispatchEvent(new Event('visibilitychange'));
await flush();
assert.equal(calls, 3);
h.target.navigator.onLine = false;
await h.tick(10000);
assert.equal(calls, 3);
h.target.navigator.onLine = true;
h.target.dispatchEvent(new Event('online'));
await flush();
assert.equal(calls, 4);
h.live.stop();
assert.equal(h.timers.size, 0);

// A slow pre-mutation GET must never undo a submitted comment or read badge.
let resolveOld;
let raceCalls = 0;
const applied = [];
const race = harness(() => {
  raceCalls++;
  if (raceCalls === 1) return new Promise(resolve => { resolveOld = resolve; });
  return Promise.resolve({ success: true, data: [{ id: 'submitted' }], unreadCount: 0 });
}, result => applied.push(result));
await flush();
race.live.refresh(true);
race.target.dispatchEvent(new Event('focus'));
assert.equal(raceCalls, 1, 'concurrent menu/focus/timer triggers share one request');
race.change('started');
race.change('settled');
resolveOld({ success: true, data: [], unreadCount: 4 });
await flush();
assert.equal(raceCalls, 2, 'one fresh read follows the invalidated request');
assert.equal(applied.length, 1, 'stale snapshot never reaches the screen');
assert.deepEqual(applied[0].data, [{ id: 'submitted' }]);
race.live.stop();

// Do not reconcile half-finished concurrent actions; settle both then read.
let multiCalls = 0;
const multi = harness(async () => { multiCalls++; return { success: true }; }, () => {}, { initial: false });
multi.change('started', 'a');
multi.change('started', 'b');
multi.change('settled', 'a');
await multi.tick(10000);
assert.equal(multiCalls, 0);
multi.change('settled', 'b');
await flush();
assert.equal(multiCalls, 1);
multi.live.stop();

// Unmount/user switch aborts and discards old identity's response.
let finish;
let signal;
let leaked = false;
const userA = harness(s => { signal = s; return new Promise(resolve => { finish = resolve; }); }, () => { leaked = true; });
await flush();
userA.live.stop();
assert.equal(signal.aborted, true);
finish({ success: true, unreadCount: 9 });
await flush();
userA.change('settled');
assert.equal(leaked, false);
assert.equal(userA.timers.size, 0);

// A transient outage preserves the last good snapshot, then recovers.
let attempts = 0;
const recovery = harness(async () => {
  attempts++;
  if (attempts === 1) throw new Error('offline');
  return { success: true, data: ['recovered'] };
}, result => { screen = result; });
await flush();
await recovery.tick(19999);
assert.equal(attempts, 1, 'failed requests back off instead of hammering the API');
await recovery.tick(1);
assert.deepEqual(screen.data, ['recovered']);
recovery.live.stop();

// A foreground tab left alone stops after five minutes. User input resumes
// immediately; bursts of focus and background invalidations cost no extra GET.
let idleCalls = 0;
const idle = harness(async () => { idleCalls++; return { success: true }; }, () => {});
await flush();
for (let i = 0; i < 29; i++) await idle.tick(10000);
assert.equal(idleCalls, 30);
await idle.tick(10000);
await idle.tick(3600000);
assert.equal(idleCalls, 30, 'idle tab has no hourly background requests');
idle.change('settled');
await flush();
assert.equal(idleCalls, 30, 'cross-tab changes wait for an idle reader to return');
idle.target.dispatchEvent(new Event('scroll'));
await flush();
assert.equal(idleCalls, 31, 'interaction resumes with one fresh snapshot');
for (let i = 0; i < 10; i++) idle.target.dispatchEvent(new Event('focus'));
await flush();
assert.equal(idleCalls, 31, 'focus bursts reuse the current polling window');
idle.live.stop();

let badgeCalls = 0;
const badge = harness(async () => { badgeCalls++; return { success: true }; }, () => {}, { interval: 30000 });
await flush();
for (let i = 0; i < 120; i++) await badge.tick(30000);
assert.equal(badgeCalls, 10, 'idle hour: initial badge plus nine periodic requests, then stop');
badge.target.dispatchEvent(new Event('keydown'));
await flush();
assert.equal(badgeCalls, 11, 'typing resumes an idle badge immediately');
badge.live.stop();

let outageCalls = 0;
const outage = harness(async () => { outageCalls++; return { success: false, error: 'unavailable' }; }, () => {});
await flush();
await outage.tick(20000);
await outage.tick(40000);
assert.equal(outageCalls, 3);
await outage.tick(59999);
assert.equal(outageCalls, 3);
await outage.tick(1);
assert.equal(outageCalls, 4, 'retry delay caps at sixty seconds');
await outage.live.refresh(true);
assert.equal(outageCalls, 5, 'explicit retry remains immediate');
outage.live.stop();

// Cross-tab invalidation carries IDs only and still works in a background tab.
let sent;
let bus;
const browser = new EventTarget();
browser.BroadcastChannel = class {
  constructor() { bus = this; }
  postMessage(data) { sent = data; }
};
globalThis.window = browser;
const events = [];
browser.addEventListener(DATA_CHANGE_EVENT, event => events.push(event.detail));
const settle = beginDataChange('/api/comments', JSON.stringify({ ranking_id: 'post', content: 'private draft', user_id: 'reader' }));
assert.equal(events[0].phase, 'started');
settle();
assert.equal(sent.rankingId, 'post');
assert.equal(sent.phase, 'settled');
assert.equal(JSON.stringify(sent).includes('private draft'), false);
assert.equal(JSON.stringify(sent).includes('reader'), false);
bus.onmessage({ data: { ...sent, id: 'other-tab' } });
assert.equal(events.at(-1).id, 'other-tab');
bus.postMessage = () => { throw new Error('channel blocked'); };
assert.doesNotThrow(beginDataChange('/api/comments', 'null'));
delete globalThis.window;
console.log('Live refresh checks passed: arrival, hidden/offline, dedup, write races, cleanup, recovery.');
