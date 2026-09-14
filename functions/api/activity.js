// Read-only activity feed for the people the current viewer follows.
// Events are derived from existing follows, rankings, and votes tables so the
// feed stays useful without introducing a second activity log to maintain.
import { assertInteger, requestErrorResponse } from '../lib/request-guard.js';

const jsonResponse = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
});

export async function onRequest({ request, env, data: auth }) {
  const userId = auth.user?.id;
  if (!userId) return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
  if (request.method !== 'GET') return jsonResponse({ success: false, error: 'Method not allowed' }, 405);

  try {
    const url = new URL(request.url);
    const rawLimit = parseInt(url.searchParams.get('limit') || '20', 10);
    const limit = assertInteger(Number.isFinite(rawLimit) ? rawLimit : 20, 'limit', { min: 1, max: 50 });

    const { results } = await env.tear_of_god_db.prepare(`
      WITH followed AS (
        SELECT following_id
        FROM follows
        WHERE follower_id = ?
      ), events AS (
        -- A ranking made from a template is more useful to describe as
        -- “joined a template”; a free-form ranking remains a new ranking event.
        SELECT
          CASE WHEN r.template_id IS NULL THEN 'ranking_created' ELSE 'template_used' END AS type,
          r.id AS ranking_id,
          r.user_id AS actor_id,
          r.created_at AS occurred_at,
          r.title AS ranking_title,
          r.category AS ranking_category,
          r.template_id,
          t.title AS template_title,
          r.user_id AS target_user_id
        FROM rankings r
        JOIN followed f ON f.following_id = r.user_id
        LEFT JOIN templates t ON t.id = r.template_id
        WHERE r.created_at >= datetime('now', '-90 days')

        UNION ALL

        SELECT
          'liked_ranking' AS type,
          r.id AS ranking_id,
          v.user_id AS actor_id,
          v.created_at AS occurred_at,
          r.title AS ranking_title,
          r.category AS ranking_category,
          r.template_id,
          t.title AS template_title,
          r.user_id AS target_user_id
        FROM votes v
        JOIN followed f ON f.following_id = v.user_id
        JOIN rankings r ON r.id = v.ranking_id
        LEFT JOIN templates t ON t.id = r.template_id
        WHERE v.vote_type = 'like'
          AND v.created_at >= datetime('now', '-90 days')
      )
      SELECT
        e.*,
        actor.username AS actor_username,
        actor.avatar_url AS actor_avatar_url,
        target.username AS target_username,
        target.avatar_url AS target_avatar_url
      FROM events e
      LEFT JOIN profiles actor ON actor.id = e.actor_id
      LEFT JOIN profiles target ON target.id = e.target_user_id
      ORDER BY datetime(e.occurred_at) DESC, e.ranking_id DESC, e.type ASC
      LIMIT ?
    `).bind(userId, limit).all();

    const data = (results || []).map((event) => ({
      id: `${event.type}:${event.ranking_id}:${event.occurred_at}`,
      type: event.type,
      occurred_at: event.occurred_at,
      actor: {
        id: event.actor_id,
        username: event.actor_username || 'Unknown',
        avatar_url: event.actor_avatar_url || null,
      },
      ranking: {
        id: event.ranking_id,
        title: event.ranking_title || 'Untitled',
        category: event.ranking_category || 'general',
        author: event.target_user_id ? {
          id: event.target_user_id,
          username: event.target_username || 'Unknown',
          avatar_url: event.target_avatar_url || null,
        } : null,
      },
      template: event.template_id ? {
        id: event.template_id,
        title: event.template_title || 'Untitled template',
      } : null,
    }));

    return jsonResponse({ success: true, data });
  } catch (error) {
    const invalid = requestErrorResponse(error);
    if (invalid) return invalid;
    console.error('Activity request failed:', error.message);
    return jsonResponse({ success: false, data: [], error: 'Service temporarily unavailable' }, 503);
  }
}
