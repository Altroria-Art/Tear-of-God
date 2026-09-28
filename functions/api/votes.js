import { assertId, consumeMemoryRateLimit, isPlainObject, rateLimitResponse, readJsonBody, requestErrorResponse } from '../lib/request-guard.js';
import { maybeNotifyTrending, recordLikeDigest } from '../lib/notifications.js';

export async function onRequest(context) {
  const { request, env, data: auth } = context;
  const db = env.tear_of_god_db; // 📍 ใช้ชื่อ binding ให้ตรงกับ wrangler.toml

  const jsonResponse = (data, status = 200) => {
    return new Response(JSON.stringify(data), { 
      status, 
      headers: { 'Content-Type': 'application/json' } 
    });
  };

  if (request.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }

  try {
    const userId = auth.user.id;
    const gate = consumeMemoryRateLimit('ranking-vote', userId, { limit: 120, windowSeconds: 3600 });
    if (!gate.allowed) return rateLimitResponse(gate);
    const body = await readJsonBody(request);
    if (!isPlainObject(body)) return jsonResponse({ success: false, error: 'Invalid request' }, 400);
    const rankingId = assertId(body.rankingId || body.ranking_id, 'rankingId');
    const voteType = body.voteType; // 'like', 'dislike', หรือ null (กรณียกเลิกโหวต)

    if (voteType !== null && voteType !== undefined && voteType !== 'like' && voteType !== 'dislike') {
      return jsonResponse({ success: false, error: 'Invalid vote type' }, 400);
    }

    // Read the previous vote inside the same transaction as the counter change.
    // A separate SELECT races with another tab and can double-increment counters.
    const nextVote = voteType ?? null;
    const results = await db.batch([
      db.prepare(`UPDATE rankings SET
        likes_count = MAX(0, COALESCE(likes_count, 0) + COALESCE(?3 = 'like', 0)
          - COALESCE((SELECT vote_type = 'like' FROM votes WHERE ranking_id = ?1 AND user_id = ?2), 0)),
        dislikes_count = MAX(0, COALESCE(dislikes_count, 0) + COALESCE(?3 = 'dislike', 0)
          - COALESCE((SELECT vote_type = 'dislike' FROM votes WHERE ranking_id = ?1 AND user_id = ?2), 0)),
        last_activity_at = CASE WHEN ?3 = 'like'
          AND (last_activity_at IS NULL OR last_activity_at < datetime('now', '-60 seconds'))
          THEN CURRENT_TIMESTAMP ELSE last_activity_at END
        WHERE id = ?1 AND COALESCE((SELECT vote_type FROM votes WHERE ranking_id = ?1 AND user_id = ?2), '') != COALESCE(?3, '')`
      ).bind(rankingId, userId, nextVote),
      nextVote === null
        ? db.prepare('DELETE FROM votes WHERE ranking_id = ? AND user_id = ?').bind(rankingId, userId)
        : db.prepare(`INSERT INTO votes (id, ranking_id, user_id, vote_type)
            SELECT ?1, ?2, ?3, ?4 FROM rankings WHERE id = ?2
            ON CONFLICT(ranking_id, user_id) DO UPDATE SET vote_type = excluded.vote_type
            WHERE votes.vote_type IS NOT excluded.vote_type`
          ).bind(crypto.randomUUID(), rankingId, userId, nextVote),
      db.prepare(
      `SELECT likes_count as likes, dislikes_count as dislikes, 
         (SELECT vote_type FROM votes WHERE ranking_id = ?1 AND user_id = ?2) AS user_vote
       FROM rankings WHERE id = ?1`
      ).bind(rankingId, userId),
    ]);
    const fresh = results[2].results;
    if (!fresh.length) return jsonResponse({ success: false, error: 'Ranking not found' }, 404);
    if (results[0].meta.changes > 0) {
      await maybeNotifyTrending(db, rankingId, userId);
      if (nextVote === 'like') await recordLikeDigest(db, rankingId, userId);
    }

    return jsonResponse({
      success: true,
      userVote: fresh[0]?.user_vote ?? null,
      likes: fresh[0]?.likes ?? 0,
      dislikes: fresh[0]?.dislikes ?? 0
    });
  } catch (err) {
    const invalid = requestErrorResponse(err);
    if (invalid) return invalid;
    console.error('Vote request failed:', err.message);
    return jsonResponse({ success: false, error: 'Service temporarily unavailable' }, 500);
  }
}
