import { assertId, assertString, isPlainObject, readJsonBody, requestErrorResponse } from '../lib/request-guard.js';

const jsonResponse = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
});

export async function onRequest({ request, env, data: auth }) {
  const db = env.tear_of_god_db;
  const userId = auth.user?.id;
  if (!userId) return jsonResponse({ success: false, error: 'Unauthorized' }, 401);

  try {
    if (request.method === 'GET') {
      const url = new URL(request.url);
      const limit = Math.min(Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10) || 20), 50);
      const [{ results }, unreadRow] = await Promise.all([
        db.prepare(`
          WITH recent AS (
            SELECT * FROM (
              SELECT * FROM notifications WHERE user_id = ?1 AND is_read = 0
              ORDER BY created_at DESC, id DESC LIMIT ?2
            )
            UNION ALL
            SELECT * FROM (
              SELECT * FROM notifications WHERE user_id = ?1 AND is_read = 1
              ORDER BY created_at DESC, id DESC LIMIT ?2
            )
          )
          SELECT n.*, actor.username AS actor_username, actor.avatar_url AS actor_avatar_url,
                 target.title AS ranking_title, source.title AS source_ranking_title,
                 topic_template.title AS template_title
          FROM recent n
          LEFT JOIN profiles actor ON actor.id = n.actor_id
          LEFT JOIN rankings target ON target.id = n.ranking_id
          LEFT JOIN rankings source ON source.id = n.source_ranking_id
          LEFT JOIN templates topic_template ON topic_template.id = n.template_id
          ORDER BY n.created_at DESC, n.id DESC
          LIMIT ?2
        `).bind(userId, limit).all(),
        // Opt in only after the transactional counter migration. The default
        // remains compatible with existing databases; counters are never cached.
        db.prepare(env.NOTIFICATION_UNREAD_COUNTS === 'true' ? `
          SELECT unread_count AS count FROM notification_unread_counts WHERE user_id = ?
        ` : `
          SELECT COUNT(*) AS count FROM notifications
          WHERE user_id = ? AND is_read = 0
        `).bind(userId).first(),
      ]);

      return jsonResponse({ success: true, data: results || [], unreadCount: unreadRow?.count || 0 });
    }

    if (request.method === 'POST') {
      const body = await readJsonBody(request);
      if (!isPlainObject(body)) return jsonResponse({ success: false, error: 'Invalid request' }, 400);
      const action = assertString(body.action, 'action', { min: 1, max: 20, trim: true });

      if (action === 'read') {
        const notificationId = assertId(body.id, 'id');
        await db.prepare(`
          UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ? AND is_read = 0
        `).bind(notificationId, userId).run();
        return jsonResponse({ success: true });
      }

      if (action === 'read_all') {
        await db.prepare(`
          UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0
        `).bind(userId).run();
        return jsonResponse({ success: true });
      }

      return jsonResponse({ success: false, error: 'Invalid action' }, 400);
    }

    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  } catch (error) {
    const invalid = requestErrorResponse(error);
    if (invalid) return invalid;
    console.error('Notification request failed:', error.message);
    return jsonResponse({ success: false, error: 'Service temporarily unavailable' }, 500);
  }
}
