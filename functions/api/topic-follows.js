import {
  assertEnum,
  assertId,
  assertString,
  consumeMemoryRateLimit,
  isPlainObject,
  rateLimitResponse,
  readJsonBody,
  requestErrorResponse,
} from '../lib/request-guard.js';

const TOPIC_TYPES = ['hashtag', 'category', 'template'];

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function normalizeTopic(type, value) {
  if (type === 'template') return assertId(value, 'topic_key');
  const text = assertString(value, 'topic_key', { min: 1, max: type === 'hashtag' ? 50 : 100, trim: true });
  const normalized = type === 'hashtag'
    ? text.replace(/^#+/, '').trim().toLowerCase()
    : text.toLowerCase();
  return assertString(normalized, 'topic_key', { min: 1, max: type === 'hashtag' ? 50 : 100 });
}

async function topicStatus(db, userId, topicType, topicKey) {
  const countRow = await db.prepare(`
    SELECT COUNT(*) AS follower_count
    FROM topic_follows
    WHERE topic_type = ? AND topic_key = ?
  `).bind(topicType, topicKey).first();
  const isFollowing = userId
    ? !!(await db.prepare(`
        SELECT 1 AS followed
        FROM topic_follows
        WHERE user_id = ? AND topic_type = ? AND topic_key = ?
        LIMIT 1
      `).bind(userId, topicType, topicKey).first())
    : false;
  const followerCount = Number(countRow?.follower_count || 0);
  return { isFollowing, followerCount };
}

export async function onRequest({ request, env, data: auth }) {
  const db = env.tear_of_god_db;
  const viewerId = auth?.user?.id || null;

  if (request.method === 'GET') {
    try {
      if (request.url) {
        const url = new URL(request.url);
        if (url.searchParams.get('mine') === '1') {
          if (!viewerId) return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
          const { results } = await db.prepare(`
            SELECT topic_type AS topicType, topic_key AS topicKey, created_at AS createdAt
            FROM topic_follows
            WHERE user_id = ?
            ORDER BY created_at DESC, topic_type, topic_key
            LIMIT 500
          `).bind(viewerId).all();
          return jsonResponse({ success: true, data: results || [] });
        }
        const topicType = assertEnum(url.searchParams.get('topic_type') || url.searchParams.get('type'), 'topic_type', TOPIC_TYPES);
        const topicKey = normalizeTopic(topicType, url.searchParams.get('topic_key') || url.searchParams.get('key'));
        const status = await topicStatus(db, viewerId, topicType, topicKey);
        return jsonResponse({ success: true, topicType, topicKey, ...status });
      }
    } catch (e) {
      const invalid = requestErrorResponse(e);
      if (invalid) return invalid;
      console.error('Topic follow status failed:', e.message);
      return jsonResponse({ success: false, error: 'Service temporarily unavailable' }, 500);
    }
  }

  if (request.method === 'POST') {
    try {
      if (!viewerId) return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
      const gate = consumeMemoryRateLimit('topic-follow-mutation', viewerId, { limit: 120, windowSeconds: 3600 });
      if (!gate.allowed) return rateLimitResponse(gate);
      const body = await readJsonBody(request);
      if (!isPlainObject(body)) return jsonResponse({ success: false, error: 'Invalid request' }, 400);
      const action = assertEnum(body.action, 'action', ['follow', 'unfollow']);
      const topicType = assertEnum(body.topic_type || body.topicType, 'topic_type', TOPIC_TYPES);
      const topicKey = normalizeTopic(topicType, body.topic_key || body.topicKey);

      if (topicType === 'template') {
        const template = await db.prepare('SELECT id FROM templates WHERE id = ?').bind(topicKey).first();
        if (!template) return jsonResponse({ success: false, error: 'ไม่พบเทมเพลตนี้' }, 404);
      }

      if (action === 'follow') {
        await db.prepare(`
          INSERT OR IGNORE INTO topic_follows (user_id, topic_type, topic_key)
          VALUES (?, ?, ?)
        `).bind(viewerId, topicType, topicKey).run();
      } else {
        await db.prepare(`
          DELETE FROM topic_follows
          WHERE user_id = ? AND topic_type = ? AND topic_key = ?
        `).bind(viewerId, topicType, topicKey).run();
      }

      const status = await topicStatus(db, viewerId, topicType, topicKey);
      return jsonResponse({ success: true, topicType, topicKey, ...status });
    } catch (e) {
      const invalid = requestErrorResponse(e);
      if (invalid) return invalid;
      console.error('Topic follow mutation failed:', e.message);
      return jsonResponse({ success: false, error: 'Service temporarily unavailable' }, 500);
    }
  }

  return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
}
