import {
  assertEnum,
  assertId,
  consumeMemoryRateLimit,
  isPlainObject,
  rateLimitResponse,
  readJsonBody,
  requestErrorResponse,
  RequestError,
} from '../lib/request-guard.js';

const EVENT_NAMES = [
  'feed_view',
  'template_view',
  'post_view',
  'community_view',
  'ranking_start',
  'ranking_publish',
  'share_complete',
  'challenge_start',
  'challenge_share',
  'challenge_complete',
  'comparison_view',
];

const ENTITY_TYPES = ['feed', 'template', 'ranking', 'challenge', 'comparison'];

function shouldRunCleanup() {
  const sample = new Uint8Array(1);
  crypto.getRandomValues(sample);
  return (sample[0] & 63) === 0;
}

export async function onRequestPost({ request, env, data: auth, waitUntil }) {
  try {
    const body = await readJsonBody(request);
    if (!isPlainObject(body)) {
      return Response.json({ success: false, error: 'Invalid request' }, { status: 400 });
    }

    const batch = body.events === undefined ? [body] : body.events;
    if (!Array.isArray(batch) || batch.length < 1 || batch.length > 20) {
      throw new RequestError('Expected 1 to 20 events');
    }
    // Validate the entire batch before consuming quota or writing any event.
    const events = batch.map(event => {
      if (!isPlainObject(event)) throw new RequestError('Invalid event');
      const eventId = assertId(event.event_id, 'event_id');
      const sessionId = assertId(event.session_id, 'session_id');
      const eventName = assertEnum(event.event_name, 'event_name', EVENT_NAMES);
      const entityType = event.entity_type == null
        ? null
        : assertEnum(event.entity_type, 'entity_type', ENTITY_TYPES);
      const entityId = event.entity_id == null
        ? null
        : assertId(event.entity_id, 'entity_id');

      if ((entityType && !entityId) || (!entityType && entityId)) {
        throw new RequestError('entity_type and entity_id must be provided together');
      }
      return { eventId, sessionId, eventName, entityType, entityId };
    });
    if (events.some(event => event.sessionId !== events[0].sessionId)) throw new RequestError('Mixed sessions');

    // The IP is used only as an in-memory abuse-control key and is never written
    // to D1. Authenticated users use their account id; local development falls
    // back to the short-lived browser session id.
    const rateSubject = auth.user?.id
      || request.headers.get('CF-Connecting-IP')
      || events[0].sessionId;
    // Charge per event, not per HTTP request: batching must not bypass limits.
    for (let index = 0; index < events.length; index++) {
      const gate = consumeMemoryRateLimit('analytics-event', rateSubject, { limit: 240, windowSeconds: 3600 });
      if (!gate.allowed) return rateLimitResponse(gate);
    }

    const statements = events.map(({ eventId, sessionId, eventName, entityType, entityId }) => env.tear_of_god_db.prepare(`
      INSERT OR IGNORE INTO analytics_events
        (id, event_name, session_id, user_id, entity_type, entity_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      eventId,
      eventName,
      sessionId,
      auth.user?.id || null,
      entityType,
      entityId
    ));
    const results = statements.length === 1
      ? [await statements[0].run()]
      : await env.tear_of_god_db.batch(statements);

    // Opportunistic retention cleanup keeps the table bounded without adding a
    // cron dependency. Roughly 1/64 newly-inserted events trigger the same idempotent job.
    // Duplicate events (changes === 0) never trigger cleanup.
    if (results.some(result => (result.meta?.changes ?? 0) > 0 && shouldRunCleanup())) {
      waitUntil(env.tear_of_god_db.prepare(
        `DELETE FROM analytics_events WHERE created_at < datetime('now', '-180 days')`
      ).run());
    }

    return Response.json({ success: true }, { status: 202, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const invalid = requestErrorResponse(error);
    if (invalid) return invalid;
    console.error('Analytics event failed:', error.message);
    return Response.json({ success: false, error: 'Service temporarily unavailable' }, { status: 500 });
  }
}
