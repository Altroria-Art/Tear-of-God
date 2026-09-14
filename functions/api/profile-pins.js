import { assertId, assertInteger, assertEnum, consumeMemoryRateLimit, isPlainObject, rateLimitResponse, readJsonBody, requestErrorResponse } from '../lib/request-guard.js';

// Pin/unpin a user's own published rankings for the Taste Identity section.
export async function onRequestPost({ request, env, data: auth }) {
  const db = env.tear_of_god_db;

  try {
    const userId = auth.user?.id;
    const gate = consumeMemoryRateLimit('profile-pin-mutation', userId, { limit: 60, windowSeconds: 3600 });
    if (!gate.allowed) return rateLimitResponse(gate);

    const body = await readJsonBody(request);
    if (!isPlainObject(body)) return Response.json({ success: false, error: 'Invalid request' }, { status: 400 });

    const action = assertEnum(body.action, 'action', ['pin', 'unpin']);
    const rankingId = assertId(body.ranking_id, 'ranking_id');
    const position = body.position === undefined ? 0 : assertInteger(body.position, 'position', { min: 0, max: 2 });

    const ranking = await db.prepare('SELECT id FROM rankings WHERE id = ? AND user_id = ?').bind(rankingId, userId).first();
    if (!ranking) return Response.json({ success: false, error: 'Ranking not found' }, { status: 404 });

    if (action === 'unpin') {
      await db.prepare('DELETE FROM profile_pins WHERE user_id = ? AND ranking_id = ?').bind(userId, rankingId).run();
      return Response.json({ success: true, pinned: false, ranking_id: rankingId });
    }

    const existing = await db.prepare('SELECT ranking_id FROM profile_pins WHERE user_id = ? AND ranking_id = ?').bind(userId, rankingId).first();
    if (!existing) {
      const countRow = await db.prepare('SELECT COUNT(*) AS count FROM profile_pins WHERE user_id = ?').bind(userId).first();
      if (Number(countRow?.count || 0) >= 3) {
        return Response.json({ success: false, error: 'You can pin up to 3 lists' }, { status: 409 });
      }
    }

    await db.prepare(`
      INSERT INTO profile_pins (user_id, ranking_id, position)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id, ranking_id) DO UPDATE SET position = excluded.position
    `).bind(userId, rankingId, position).run();

    return Response.json({ success: true, pinned: true, ranking_id: rankingId, position });
  } catch (error) {
    const invalid = requestErrorResponse(error);
    if (invalid) return invalid;
    console.error('Profile pin request failed:', { name: error?.name, message: error?.message });
    return Response.json({ success: false, error: 'Service temporarily unavailable' }, { status: 500 });
  }
}

