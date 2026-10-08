# Polling and analytics request reduction

This records the earlier polling/analytics optimization. Notification polling was superseded by the visible/online live scheduler in `docs/live-social-updates.md`, deployed on 9 October 2026. The five-minute idle policy below still applies to admin polling, not notifications. No migration was required for these client scheduling changes.

| Change | Expected impact | Trade-off |
|---|---|---|
| Pause admin polling after five minutes without pointer, keyboard or scroll activity | Simulated uninterrupted idle foreground hour: admin 60 → 4 periodic requests; initial load excluded. Notification savings from the old policy are historical and no longer describe the current scheduler. | Admin badges pause while idle; notification badges continue refreshing every 10 seconds while visible/online, with scoped mutation refreshes. |
| Guard admin polling against overlapping calls and returns within 60 seconds | Coalesces repeated visibility triggers and slow-request overlaps | Automatic retry waits for the existing polling freshness window. |
| Batch same-microtask analytics events, maximum 20 per request | Publish/share pairs and template-view events: 2 → 1 Worker request and authenticated session lookup. All event rows remain; no D1 event-write reduction claimed. | Batch rejected as a unit for invalid events/rate limit. Dispatch waits one microtask, no timer. |

Server preserves legacy single-event requests, validates all batched events before writing, derives user identity from the verified session, charges rate limits per event, and writes batches transactionally. Client preserves event IDs, once-per-session dedup and retry-on-revisit behavior.

Validation: `node tests/local/analytics-batching-idle.mjs` verifies idle/resume/cleanup, request counts, batching limits, successful dedup, failed-request retry, server event retention, forged-user rejection by attribution, invalid-batch atomicity, legacy payloads, duplicate IDs and per-event rate enforcement. Existing notification-polling, security-headers, maintenance-read-only and quota-optimization checks passed.

Remaining consumers: active-use polling, uncached personalized feed/aggregate work, one indexed D1 write set per analytics event, and real image uploads/first loads. No R2 changes: these polling/analytics paths do not use R2.
