import {
  assertEnum,
  assertId,
  consumeMemoryRateLimit,
  isPlainObject,
  rateLimitResponse,
  readJsonBody,
  requestErrorResponse,
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

function shouldRunCleanup(eventId) {
  let bucket = 0;
  for (const character of eventId) bucket = (bucket * 31 + character.charCodeAt(0)) % 64;
  return bucket === 0;
}

export async function onRequestPost({ request, env, data: auth, waitUntil }) {
  try {
    const body = await readJsonBody(request);
    if (!isPlainObject(body)) {
      return Response.json({ success: false, error: 'Invalid request' }, { status: 400 });
    }

    const eventId = assertId(body.event_id, 'event_id');
    const sessionId = assertId(body.session_id, 'session_id');
    const eventName = assertEnum(body.event_name, 'event_name', EVENT_NAMES);
    const entityType = body.entity_type == null
      ? null
      : assertEnum(body.entity_type, 'entity_type', ENTITY_TYPES);
    const entityId = body.entity_id == null
      ? null
      : assertId(body.entity_id, 'entity_id');

    if ((entityType && !entityId) || (!entityType && entityId)) {
      return Response.json({ success: false, error: 'entity_type and entity_id must be provided together' }, { status: 400 });
    }

    // The IP is used only as an in-memory abuse-control key and is never written
    // to D1. Authenticated users use their account id; local development falls
    // back to the short-lived browser session id.
    const rateSubject = auth.user?.id
      || request.headers.get('CF-Connecting-IP')
      || sessionId;
    const gate = consumeMemoryRateLimit('analytics-event', rateSubject, { limit: 240, windowSeconds: 3600 });
    if (!gate.allowed) return rateLimitResponse(gate);

    await env.tear_of_god_db.prepare(`
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
    ).run();

    // Opportunistic retention cleanup keeps the table bounded without adding a
    // cron dependency. Roughly 1/64 accepted events trigger the same idempotent job.
    if (shouldRunCleanup(eventId)) {
      waitUntil(env.tear_of_god_db.prepare(
        `DELETE FROM analytics_events WHERE created_at < datetime('now', '-180 days')`
      ).run());
    }

    return Response.json({ success: true }, { status: 202, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return requestErrorResponse(error, 'Analytics event');
  }
}
