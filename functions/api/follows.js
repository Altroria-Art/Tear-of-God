import { assertId, assertString, consumeMemoryRateLimit, isPlainObject, rateLimitResponse, readJsonBody, requestErrorResponse } from '../lib/request-guard.js';

export async function onRequest({ request, env, data: auth }) {
  const db = env.tear_of_god_db;
  const url = new URL(request.url);
  const jsonResponse = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

  if (request.method === 'GET') {
    try {
      const userId = url.searchParams.get('user_id');
      const type = url.searchParams.get('type');
      if (!userId || !type) return jsonResponse({ error: 'Missing params' }, 400);

      let query = '';
      if (type === 'followers') {
        query = `
          SELECT p.id, p.username, p.avatar_url, p.bio
          FROM follows f
          JOIN profiles p ON f.follower_id = p.id
          WHERE f.following_id = ?
          ORDER BY f.created_at DESC
          LIMIT 500
        `;
      } else if (type === 'following') {
        query = `
          SELECT p.id, p.username, p.avatar_url, p.bio
          FROM follows f
          JOIN profiles p ON f.following_id = p.id
          WHERE f.follower_id = ?
          ORDER BY f.created_at DESC
          LIMIT 500
        `;
      } else {
        return jsonResponse({ error: 'Invalid type' }, 400);
      }

      const { results } = await db.prepare(query).bind(userId).all();
      return jsonResponse({ success: true, data: results, total: results.length });
    } catch (e) {
      return jsonResponse({ error: e.message }, 500);
    }
  }

  if (request.method === 'POST') {
    try {
      const follower_id = auth.user.id;
      const gate = consumeMemoryRateLimit('follow-mutation', follower_id, { limit: 60, windowSeconds: 3600 });
      if (!gate.allowed) return rateLimitResponse(gate);
      const body = await readJsonBody(request);
      if (!isPlainObject(body)) return jsonResponse({ error: 'Invalid request' }, 400);
      const action = assertString(body.action, 'action', { min: 1, max: 16, trim: true });
      const following_id = assertId(body.following_id, 'following_id');

      // กัน user follow ตัวเอง
      if (follower_id === following_id) {
        return jsonResponse({ error: 'ไม่สามารถ follow ตัวเองได้' }, 400);
      }

      if (action === 'follow') {
        await db.prepare('INSERT OR IGNORE INTO follows (follower_id, following_id) VALUES (?, ?)').bind(follower_id, following_id).run();
        return jsonResponse({ success: true, is_following: true });
      } else if (action === 'unfollow') {
        await db.prepare('DELETE FROM follows WHERE follower_id = ? AND following_id = ?').bind(follower_id, following_id).run();
        return jsonResponse({ success: true, is_following: false });
      }
      return jsonResponse({ error: 'Invalid action' }, 400);
    } catch (e) {
      const invalid = requestErrorResponse(e);
      if (invalid) return invalid;
      console.error('Follow request failed:', e.message);
      return jsonResponse({ error: 'Service temporarily unavailable' }, 500);
    }
  }

  return jsonResponse({ error: 'Method not allowed' }, 405);
}
