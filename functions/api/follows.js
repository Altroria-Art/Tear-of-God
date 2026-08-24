export async function onRequest({ request, env }) {
  const db = env.tear_of_god_db;
  const jsonResponse = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

  if (request.method === 'POST') {
    try {
      const { action, follower_id, following_id } = await request.json();
      if (!follower_id || !following_id) return jsonResponse({ error: 'Missing params' }, 400);

      if (action === 'follow') {
        await db.prepare('INSERT OR IGNORE INTO follows (follower_id, following_id) VALUES (?, ?)').bind(follower_id, following_id).run();
        return jsonResponse({ success: true, is_following: true });
      } else if (action === 'unfollow') {
        await db.prepare('DELETE FROM follows WHERE follower_id = ? AND following_id = ?').bind(follower_id, following_id).run();
        return jsonResponse({ success: true, is_following: false });
      }
      return jsonResponse({ error: 'Invalid action' }, 400);
    } catch (e) {
      return jsonResponse({ error: e.message }, 500);
    }
  }

  return jsonResponse({ error: 'Method not allowed' }, 405);
}
