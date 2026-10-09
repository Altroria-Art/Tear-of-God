# Live social updates

Comments previously loaded only on page entry, and notification polling ran every five minutes with an interaction idle gate. Reading a page could therefore leave comments and the unread badge stale until reload.

- Post Detail and Community Average refresh comments and reactions every 10 seconds while visible, online and recently active. Community Average requests comments and reactions together with `include_reactions=1`, saving a second HTTP request and session lookup per tick. Replies and deletions preserve an unsent draft.
- An open notification bell refreshes every 10 seconds. While closed, it requests only the exact unread count every 30 seconds; it fetches the full list immediately on opening. The counter-only GET performs no purge or list joins. Full list reads and the existing scheduled worker still apply the 24h read-notification retention rule.
- Home refreshes counters for visible and nearby cards every 15 seconds through the bounded `/api/social-state` endpoint. Feed order, paging cursors, and scroll position stay intact. Reaction props synchronize into each card's local state.
- After five minutes without a pointer press, keystroke or scroll, live periodic reads stop even in the foreground. Interaction resumes a fresh read immediately. Returning to a tab/window or reconnecting refreshes if the current polling interval has elapsed or a known write invalidated the snapshot. Repeated focus events reuse the same interval.
- The API transport invalidates reads when a social write starts, then requests reconciliation when it settles. BroadcastChannel sends only endpoint and resource identifiers to other tabs; no comment text, credentials, or profile data.
- Reads are single-flight per mounted resource. A pre-mutation snapshot is discarded, and one replacement read follows. Unmount or user/resource changes abort outstanding reads and discard late responses.
- Live comment and reaction endpoints use `private, no-store`. Comment counts come from the server, including when the 200-comment response limit is reached.
- Periodic comment requests opt into `shared_snapshot=1`: only the public discussion and Community totals share an internal 5-second cache. Viewer votes and Post counters still read fresh from D1 on every request. Initial loads, explicit retries and mutation reconciliation omit that option. A busy topic can reuse public reads across viewers; a lone reader polling every 10 seconds still gets a cold read each tick. Cache outages fall back to D1.

This is polling, not server push; another device's comment changes normally appear on the next poll, or a later poll if the shared snapshot was still warm (up to roughly 15 seconds at the 10-second interval, plus network delay). Hidden tabs do not initiate periodic requests. Own successful actions retain their immediate local updates and fetch an uncached replacement.

Failures retain the previous snapshot and double the retry interval up to 60 seconds. Explicit retries and mutation reconciliation remain immediate. See `free-quota-audit-2026-10-10.md` for measurements and capacity assumptions.

Validation: `npm run lint`, `npm run build`, `node tests/local/live-refresh.mjs`, `node tests/local/social-updates.mjs`, and the notification polling/read/delete and comment self-delete regression checks.

The 9 October follow-up combines comment counter/activity updates in one statement and reads the canonical count with the newly-created comment. `verified-session-mutations.mjs` verifies the same response/security contract with seven statements for the original comment fixture, retaining its eight-statement budget; the reply case also stays within eight.
