// An open bell refreshes every ten seconds; its closed badge every thirty.
// Timer, focus, mutation, and cross-tab triggers are coordinated by liveRefresh.

export const POLL_INTERVAL_MS = 10000;
export const BADGE_POLL_INTERVAL_MS = 30000;
export const VISIBILITY_STALE_MS = 1000;

// Reuse only a fetch that just completed, so opening the bell stays fresh.
export const MENU_REUSE_WINDOW_MS = 1000;

// Compatibility helpers for callers using the notification freshness policy.
export function shouldPollTick({ userId, visible, now, lastRefreshAt }) {
  if (!userId) return false;
  if (!visible) return false;
  return now - lastRefreshAt >= VISIBILITY_STALE_MS;
}

// Returning to the tab refreshes unless the last attempt was a moment ago.
export function shouldRefreshOnVisible({ now, lastRefreshAt }) {
  return now - lastRefreshAt >= VISIBILITY_STALE_MS;
}

// Menu-open decision: skip only when a fetch SUCCEEDED within the reuse
// window. Failures never count (lastSuccessAt stays old), so an error is
// always followed by a real retry on next open.
export function shouldReuseFreshFetch({ now, lastSuccessAt }) {
  if (!lastSuccessAt) return false;
  return now - lastSuccessAt < MENU_REUSE_WINDOW_MS;
}

// Single-flight dedup for the one notification GET the component issues.
// Concurrent triggers share the pending promise (1 HTTP, not N); sequential
// triggers fetch normally. reset() drops the shared slot so a user change or
// unmount can never hand one identity's response to another — combined with
// the component's request-id guard, a late resolve can never fill new state.
// The finally-clear is slot-checked so a reset racing a settle cannot wipe a
// newer entry.
export function createRequestDeduper() {
  let current = null;
  return {
    run(fetchFn) {
      if (current) return current.promise;
      const slot = {};
      const promise = (async () => {
        try {
          return await fetchFn();
        } finally {
          if (current === slot) current = null;
        }
      })();
      slot.promise = promise;
      current = slot;
      return promise;
    },
    reset() {
      current = null;
    },
    get pending() {
      return current !== null;
    },
  };
}
