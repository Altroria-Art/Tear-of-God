import { assertId, requestErrorResponse } from '../lib/request-guard.js';

// Refresh just counters for the cards already on screen; keep feed order and
// avoid repeatedly loading placements, profiles, and community averages.
export async function onRequestGet({ request, env, data: auth }) {
  const json = (body, status = 200) => Response.json(body, {
    status, headers: { 'Cache-Control': 'private, no-store' },
  });
  try {
    const raw = new URL(request.url).searchParams.get('ranking_ids') || '';
    const ids = [...new Set(raw.split(',').filter(Boolean))];
    if (ids.length > 40) return json({ success: false, error: 'Too many rankings' }, 400);
    if (!ids.length) return json({ success: true, data: [] });
    ids.forEach(id => assertId(id, 'ranking_id'));
    const placeholders = ids.map((_, index) => `?${index + 2}`).join(',');
    const { results } = await env.tear_of_god_db.prepare(`
      SELECT r.id, r.likes_count AS likes, r.dislikes_count AS dislikes,
             r.comments_count AS comments,
             (SELECT vote_type FROM votes WHERE ranking_id = r.id AND user_id = ?1) AS user_vote
      FROM rankings r WHERE r.id IN (${placeholders})
    `).bind(auth.user?.id || null, ...ids).all();
    return json({ success: true, data: results || [] });
  } catch (error) {
    return requestErrorResponse(error) || json({ success: false, error: 'Service temporarily unavailable' }, 500);
  }
}
