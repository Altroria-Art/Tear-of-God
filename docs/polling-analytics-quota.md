# Polling and analytics request reduction

Implemented locally after the quota deployment; not deployed. No migration required.

| Change | Expected impact | Trade-off |
|---|---|---|
| Pause admin and notification polling after five minutes without pointer, keyboard or scroll activity | Simulated uninterrupted idle foreground hour: admin 60 → 4 periodic requests, notifications 12 → 0; initial load excluded. Each avoided request also avoids its authentication and endpoint D1 queries. | Badges stop updating while idle. Interaction/tab return refreshes stale data; opening notifications still uses the existing freshness checks. |
| Guard admin polling against overlapping calls and returns within 60 seconds | Coalesces repeated visibility triggers and slow-request overlaps | Automatic retry waits for the existing polling freshness window. |
| Batch same-microtask analytics events, maximum 20 per request | Challenge start/publish/share pairs: 2 → 1 Worker request and authenticated session lookup. All event rows remain; no D1 event-write reduction claimed. | Batch rejected as a unit for invalid events/rate limit. Dispatch waits one microtask, no timer. |

Server preserves legacy single-event requests, validates all batched events before writing, derives user identity from the verified session, charges rate limits per event, and writes batches transactionally. Client preserves event IDs, once-per-session dedup and retry-on-revisit behavior.

Validation: `node tests/local/analytics-batching-idle.mjs` verifies idle/resume/cleanup, request counts, batching limits, successful dedup, failed-request retry, server event retention, forged-user rejection by attribution, invalid-batch atomicity, legacy payloads, duplicate IDs and per-event rate enforcement. Existing notification-polling, security-headers, maintenance-read-only and quota-optimization checks passed.

Remaining consumers: active-use polling, uncached personalized feed/aggregate work, one indexed D1 write set per analytics event, and real image uploads/first loads. No R2 changes: these polling/analytics paths do not use R2.
