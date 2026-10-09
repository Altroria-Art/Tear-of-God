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

    // An event below the first `limit` events of its person/type cannot enter
    // the combined top `limit`. Bound those indexed reads before joining details.
    const { results } = await env.tear_of_god_db.prepare(`
      WITH followed AS MATERIALIZED (
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
          r.created_at AS occurred_at
        FROM followed f
        JOIN json_each((
          SELECT json_group_array(id) FROM (
            SELECT id FROM rankings
            WHERE user_id = f.following_id
              AND created_at >= datetime('now', '-90 days')
            ORDER BY datetime(created_at) DESC, id DESC
            LIMIT ?2
          )
        )) selected
        JOIN rankings r ON r.id = selected.value

        UNION ALL

        SELECT
          'liked_ranking' AS type,
          r.id AS ranking_id,
          v.user_id AS actor_id,
          v.created_at AS occurred_at
        FROM followed f
        JOIN json_each((
          SELECT json_group_array(id) FROM (
            SELECT v.id FROM votes v
            JOIN rankings r ON r.id = v.ranking_id
            WHERE v.user_id = f.following_id
              AND v.vote_type = 'like'
              AND v.created_at >= datetime('now', '-90 days')
            ORDER BY datetime(v.created_at) DESC, v.ranking_id DESC
            LIMIT ?2
          )
        )) selected
        JOIN votes v ON v.id = selected.value
        JOIN rankings r ON r.id = v.ranking_id
      ), recent AS MATERIALIZED (
        SELECT * FROM events
        ORDER BY datetime(occurred_at) DESC, ranking_id DESC, type ASC
        LIMIT ?2
      )
      SELECT
        e.*,
        r.title AS ranking_title,
        r.hashtags AS ranking_hashtags,
        r.template_id,
        t.title AS template_title,
        r.user_id AS target_user_id,
        actor.username AS actor_username,
        actor.avatar_url AS actor_avatar_url,
        target.username AS target_username,
        target.avatar_url AS target_avatar_url
      FROM recent e
      -- Keep the bounded event list outermost; scanning all rankings here
      -- otherwise defeats the earlier limit on databases without ANALYZE stats.
      CROSS JOIN rankings r ON r.id = e.ranking_id
      LEFT JOIN templates t ON t.id = r.template_id
      LEFT JOIN profiles actor ON actor.id = e.actor_id
      LEFT JOIN profiles target ON target.id = r.user_id
      ORDER BY datetime(e.occurred_at) DESC, e.ranking_id DESC, e.type ASC
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
        hashtags: event.ranking_hashtags || '',
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
