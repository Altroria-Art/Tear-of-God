// Notification polling policy + single-flight dedup (Batch 7).
//
// Pure, DOM-free helpers so the trigger rules are unit-testable without a
// browser harness. NotificationMenu.jsx wires them to timers/visibility/menu;
// every threshold below preserves the current UX contract:
//
// - background freshness stays ~5 minutes while the tab is visible,
// - returning to a stale tab refreshes (60s guard, unchanged),
// - opening the menu right after a fresh fetch does not refetch.
//
// No response caching here beyond in-flight sharing: opening the menu with
// stale data must still fetch. Server/security semantics are untouched.

export const POLL_INTERVAL_MS = 300000; // 5 minutes — DO NOT lengthen in Batch 7.
export const VISIBILITY_STALE_MS = 60000; // existing freshness guard, unchanged.

// Menu-open reuse window: only skips a fetch seconds after a SUCCESSFUL one
// (timer/visibility collision). Far below the 5-minute cadence, so it can
// only dedup collisions — never replace a needed refresh.
export const MENU_REUSE_WINDOW_MS = 15000;

// Interval tick decision. Mirrors the current inline check exactly:
// logged-in + visible + previous attempt (any trigger) is old enough.
export function shouldPollTick({ userId, visible, now, lastRefreshAt }) {
  if (!userId) return false;
  if (!visible) return false;
  return now - lastRefreshAt >= VISIBILITY_STALE_MS;
}

// Tab-visible-again decision. Same 60s threshold as the current handler.
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
