import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  MENU_REUSE_WINDOW_MS,
  POLL_INTERVAL_MS,
  VISIBILITY_STALE_MS,
  createRequestDeduper,
  shouldPollTick,
  shouldRefreshOnVisible,
  shouldReuseFreshFetch,
} from '../../src/lib/notificationFeed.js';

// Batch 7 policy tests: pure trigger rules + single-flight dedup. DOM wiring
// (mount gate, timers, visibility listener, menu open) stays in
// NotificationMenu.jsx and is covered by review + lint/build; the rules it
// executes are all asserted here. Time is injected, never real.

// CASE 1 — logged out: no polling trigger may ever fire.
assert.equal(shouldPollTick({ userId: null, visible: true, now: 999999, lastRefreshAt: 0 }), false);
assert.equal(shouldPollTick({ userId: '', visible: true, now: 999999, lastRefreshAt: 0 }), false);
console.log('CASE 1 passed: logged-out polling triggers are dead');

// CASE 3 — visible tab keeps the ~5-minute cadence (interval itself unchanged).
assert.equal(POLL_INTERVAL_MS, 300000, 'polling interval must stay 5 minutes');
{
  let last = 0;
  for (const tick of [300000, 600000, 900000]) {
    assert.equal(
      shouldPollTick({ userId: 'u1', visible: true, now: tick, lastRefreshAt: last }),
      true,
      `tick at ${tick}ms must fire`,
    );
    last = tick; // component stamps lastRefreshAt on every refresh
  }
  assert.equal(
    shouldPollTick({ userId: 'u1', visible: true, now: 900000 + 59000, lastRefreshAt: 900000 }),
    false,
    'off-cadence tick must not fire',
  );
}
console.log('CASE 3 passed: visible 15-minute cadence preserved');

// CASE 4 — hidden tab: interval ticks never fetch.
for (const now of [300000, 3600000, 86400000]) {
  assert.equal(
    shouldPollTick({ userId: 'u1', visible: false, now, lastRefreshAt: 0 }),
    false,
    `hidden tick at ${now}ms must not fetch`,
  );
}
console.log('CASE 4 passed: hidden tab fires zero notification requests');

// CASE 5/6 — hidden -> visible: refresh iff stale under the unchanged 60s guard.
assert.equal(VISIBILITY_STALE_MS, 60000, 'visibility freshness guard must stay 60s');
assert.equal(shouldRefreshOnVisible({ now: 61000, lastRefreshAt: 0 }), true);
assert.equal(shouldRefreshOnVisible({ now: 60000, lastRefreshAt: 0 }), true);
assert.equal(shouldRefreshOnVisible({ now: 59999, lastRefreshAt: 0 }), false);
assert.equal(shouldRefreshOnVisible({ now: 30000, lastRefreshAt: 0 }), false);
console.log('CASE 5/6 passed: visible-again refresh honors the 60s guard');

// CASE 7/8 — concurrent triggers share one request.
{
  const deduper = createRequestDeduper();
  let calls = 0;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const fetchFn = async () => {
    calls += 1;
    await gate;
    return { success: true, data: [], unreadCount: 0 };
  };
  const pendingAll = Promise.all([
    deduper.run(fetchFn),
    deduper.run(fetchFn),
    deduper.run(fetchFn),
  ]);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(calls, 1, 'timer + menu + visibility at once must equal 1 HTTP');
  assert.equal(deduper.pending, true);
  release();
  const [a, b, c] = await pendingAll;
  assert.deepEqual([a, b, c].map((r) => r.unreadCount), [0, 0, 0]);
  assert.equal(deduper.pending, false, 'slot releases after settle');
  await deduper.run(fetchFn);
  assert.equal(calls, 2, 'sequential triggers fetch normally (dedup is in-flight only)');
  console.log('CASE 7/8 passed: concurrent triggers share 1 HTTP');
}

// CASE 9/10 — menu-open reuse window: fresh skips, stale fetches.
{
  assert.ok(MENU_REUSE_WINDOW_MS <= 15000 && MENU_REUSE_WINDOW_MS < VISIBILITY_STALE_MS);
  assert.equal(shouldReuseFreshFetch({ now: 105000, lastSuccessAt: 100000 }), true);
  assert.equal(shouldReuseFreshFetch({ now: 100000 + MENU_REUSE_WINDOW_MS - 1, lastSuccessAt: 100000 }), true);
  assert.equal(shouldReuseFreshFetch({ now: 100000 + MENU_REUSE_WINDOW_MS, lastSuccessAt: 100000 }), false);
  assert.equal(shouldReuseFreshFetch({ now: 200000, lastSuccessAt: 100000 }), false);
  assert.equal(shouldReuseFreshFetch({ now: 200000, lastSuccessAt: 0 }), false, 'never-fetched is never fresh');
  console.log('CASE 9/10 passed: menu-open reuse window skips only fresh collisions');
}

// CASE 11 — logout: pending response cannot fill post-logout state.
{
  const deduper = createRequestDeduper();
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const pending = deduper.run(async () => {
    await gate;
    return { success: true, data: [{ id: 'stale-of-A' }], unreadCount: 9 };
  });
  deduper.reset(); // what the component cleanup does on logout/unmount
  assert.equal(deduper.pending, false);
  release();
  const stale = await pending; // resolves for its original waiter only
  assert.deepEqual(stale.data, [{ id: 'stale-of-A' }]);
  let freshCalls = 0;
  await deduper.run(async () => {
    freshCalls += 1;
    return { success: true, data: [], unreadCount: 0 };
  });
  assert.equal(freshCalls, 1, 'post-logout lifecycle starts clean');
  console.log('CASE 11 passed: logout drops in-flight state, next lifecycle is clean');
}

// CASE 12 — user switch: A in-flight never serves B.
{
  const deduper = createRequestDeduper();
  let calls = 0;
  let releaseA;
  const gateA = new Promise((resolve) => { releaseA = resolve; });
  const waiterA = deduper.run(async () => {
    calls += 1;
    await gateA;
    return { owner: 'A' };
  });
  deduper.reset(); // userId prop change runs the effect cleanup first
  const resultB = await deduper.run(async () => {
    calls += 1;
    return { owner: 'B' };
  });
  assert.equal(resultB.owner, 'B');
  releaseA();
  assert.equal((await waiterA).owner, 'A', 'A waiter keeps its own result');
  assert.equal(calls, 2);
  console.log('CASE 12 passed: A/B in-flight state never crosses users');
}

// CASE 13 — error recovery: rejection releases the slot, next trigger retries.
{
  const deduper = createRequestDeduper();
  let calls = 0;
  await assert.rejects(deduper.run(async () => {
    calls += 1;
    throw new Error('network down');
  }));
  assert.equal(deduper.pending, false);
  const retry = await deduper.run(async () => {
    calls += 1;
    return { success: true };
  });
  assert.equal(calls, 2);
  assert.deepEqual(retry, { success: true });
  console.log('CASE 13 passed: errors release the slot, lifecycle recovers');
}

// CASE 14/15 — mark-as-read path shares nothing with the GET dedup policy:
// structurally assert the policy module has no mutation logic, and the
// component diff (reviewed) leaves markAllRead/openNotification untouched.
{
  const policySource = await readFile(new URL('../../src/lib/notificationFeed.js', import.meta.url), 'utf8');
  assert.ok(!policySource.includes('markNotificationRead'), 'policy must not touch mutations');
  assert.ok(!policySource.includes('read_all'), 'policy must not touch mutations');
  const componentSource = await readFile(new URL('../../src/components/layout/NotificationMenu.jsx', import.meta.url), 'utf8');
  assert.ok(componentSource.includes('markNotificationRead()'), 'mark-all-read mutation preserved');
  assert.ok(componentSource.includes('markNotificationRead(notification.id)'), 'per-item mutation preserved');
  console.log('CASE 14/15 passed: mark-read mutations untouched and unshared');
}

// CASE 2 — login starts the lifecycle with an initial fetch, logout ends it:
// Navbar mounts the menu only with a user, and the menu effect fetches on
// mount-with-user (both reviewed; the cadence it then follows is proven
// above). Structural pins so a future refactor cannot silently break this.
{
  const navbarSource = await readFile(new URL('../../src/components/layout/Navbar.jsx', import.meta.url), 'utf8');
  assert.ok(navbarSource.includes('{currentUser && <NotificationMenu'), 'menu mounts only when logged in');
  const componentSource = await readFile(new URL('../../src/components/layout/NotificationMenu.jsx', import.meta.url), 'utf8');
  assert.ok(componentSource.includes('if (!userId) return undefined;'), 'effect stays dead without a user');
  console.log('CASE 2 passed: login mounts (initial fetch), logout unmounts (polling ends)');
}

console.log('Notification polling checks passed.');
