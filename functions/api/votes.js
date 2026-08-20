export async function onRequestPost({ request, env }) {
  const db = env.tear_of_god_db;

  try {
    const { rankingId, userId, action } = await request.json();

    if (!rankingId || !userId || !['like', 'dislike', 'cancel'].includes(action)) {
      return Response.json({ success: false, error: 'rankingId, userId, and a valid action (like/dislike/cancel) are required' }, { status: 400 });
    }

    await db.prepare(
      'INSERT OR IGNORE INTO profiles (id, username, avatar_url) VALUES (?, ?, ?)'
    ).bind(userId, userId, '').run();

    const existing = await db.prepare(
      'SELECT id FROM votes WHERE user_id = ? AND ranking_id = ?'
    ).bind(userId, rankingId).first();

    if (action === 'cancel') {
      if (existing) {
        await db.prepare('DELETE FROM votes WHERE id = ?').bind(existing.id).run();
      }
      return Response.json({ success: true, vote: null });
    }

    if (existing) {
      if (existing.vote_type === action) {
        return Response.json({ success: true, vote: { id: existing.id, vote_type: action } });
      }
      await db.prepare('UPDATE votes SET vote_type = ? WHERE id = ?').bind(action, existing.id).run();
      return Response.json({ success: true, vote: { id: existing.id, vote_type: action } });
    }

    const id = crypto.randomUUID();
    await db.prepare(
      'INSERT INTO votes (id, user_id, ranking_id, vote_type) VALUES (?, ?, ?, ?)'
    ).bind(id, userId, rankingId, action).run();

    return Response.json({ success: true, vote: { id, vote_type: action } });
  } catch (err) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}
