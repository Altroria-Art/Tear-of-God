# Live social updates

Comments previously loaded only on page entry, and notification polling ran every five minutes with an interaction idle gate. Reading a page could therefore leave comments and the unread badge stale until reload.

- Post Detail and Community Average refresh comments and reactions every 10 seconds while visible and online. Replies and deletions are reflected without remounting CommentSection, preserving an unsent draft.
- Notifications refresh every 10 seconds, including while reading without clicking. Opening the bell requests fresh data unless a successful read completed less than a second ago.
- Home refreshes counters for visible and nearby cards every 15 seconds through the bounded `/api/social-state` endpoint. Feed order, paging cursors, and scroll position stay intact. Reaction props synchronize into each card's local state.
- Returning to a tab/window or reconnecting refreshes immediately, with a one-second guard against simultaneous focus/visibility events.
- The API transport invalidates reads when a social write starts, then requests reconciliation when it settles. BroadcastChannel sends only endpoint and resource identifiers to other tabs; no comment text, credentials, or profile data.
- Reads are single-flight per mounted resource. A pre-mutation snapshot is discarded, and one replacement read follows. Unmount or user/resource changes abort outstanding reads and discard late responses.
- Live comment and reaction endpoints use `private, no-store`. Comment counts come from the server, including when the 200-comment response limit is reached.

This is polling, not server push; another device's changes appear on the next poll. Hidden tabs do not initiate periodic requests. Own successful actions retain their immediate local updates.

Validation: `npm run lint`, `npm run build`, `node tests/local/live-refresh.mjs`, `node tests/local/social-updates.mjs`, and the notification polling/read/delete and comment self-delete regression checks.

The 9 October follow-up combines comment counter/activity updates in one statement and reads the canonical count with the newly-created comment. `verified-session-mutations.mjs` verifies the same response/security contract with seven statements for the original comment fixture, retaining its eight-statement budget; the reply case also stays within eight.
