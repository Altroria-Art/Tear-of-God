// like/dislike ให้กับ Community Average ของ template (เช่นเดียวกับ votes.js ของ ranking
// แต่ผูกกับ template_id เพราะตาราง Community Average เป็นข้อมูลรวมของเทมเพลต)
// - GET  /api/template-votes?template_id=..&user_id=..  → คืน user_vote + จำนวน like/dislike
// - POST /api/template-votes  body: { template_id, user_id, voteType }  → โหวต/สลับ/ยกเลิก
import { assertId, consumeMemoryRateLimit, isPlainObject, rateLimitResponse, readJsonBody, requestErrorResponse } from '../lib/request-guard.js';

export async function onRequest({ request, env, data: auth }) {
  const db = env.tear_of_god_db;
  const jsonResponse = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' } });

  const fetchCounts = async (templateId, userId) => {
    // นับสดจากตารางเสมอ (ไม่พึ่ง counter ที่ drift ได้) — คล้ายวิธีคำนวณ views/uses ของ templates.js
    const { results } = await db.prepare(
      `SELECT
         COALESCE(SUM(r.vote_type = 'like'), 0) AS likes,
         COALESCE(SUM(r.vote_type = 'dislike'), 0) AS dislikes,
         (SELECT vote_type FROM template_reactions WHERE template_id = ?1 AND user_id = ?2) AS user_vote
       FROM template_reactions r WHERE r.template_id = ?1`
    ).bind(templateId, userId).all();
    const row = results[0] || {};
    return { userVote: row.user_vote ?? null, likes: row.likes || 0, dislikes: row.dislikes || 0 };
  };

  try {
    const url = new URL(request.url);
    const templateId = url.searchParams.get('template_id');

    // 🟢 [GET] อ่านสถานะโหวตของผู้ใช้ + จำนวนรวม (ใช้ตอนเปิดหน้าเพื่อ seed การ์ด)
    if (request.method === 'GET') {
      if (!templateId) return jsonResponse({ success: false, error: 'Missing template_id' }, 400);
      assertId(templateId, 'template_id');
      const userId = auth.user?.id || null;
      const counts = await fetchCounts(templateId, userId);
      return jsonResponse({ success: true, ...counts });
    }

    // 🟢 [POST] โหวต/สลับ/ยกเลิก
    if (request.method === 'POST') {
      const user_id = auth.user.id;
      const gate = consumeMemoryRateLimit('template-vote', user_id, { limit: 120, windowSeconds: 3600 });
      if (!gate.allowed) return rateLimitResponse(gate);
      const body = await readJsonBody(request);
      if (!isPlainObject(body)) return jsonResponse({ success: false, error: 'Invalid request' }, 400);
      const template_id = assertId(body.template_id, 'template_id');
      const { voteType } = body;
      if (voteType !== null && voteType !== undefined && voteType !== 'like' && voteType !== 'dislike') {
        return jsonResponse({ success: false, error: 'Invalid vote type' }, 400);
      }

      if (!await db.prepare('SELECT id FROM templates WHERE id = ?').bind(template_id).first()) {
        return jsonResponse({ success: false, error: 'Template not found' }, 404);
      }
      // Callers send the desired state (including null to cancel). Repeating a
      // like must remain a like, as with ranking votes, and concurrent inserts
      // must resolve through the unique key instead of throwing a 500.
      if (voteType == null) {
        await db.prepare('DELETE FROM template_reactions WHERE template_id = ? AND user_id = ?')
          .bind(template_id, user_id).run();
      } else {
        await db.prepare(`INSERT INTO template_reactions (id, template_id, user_id, vote_type)
          SELECT ?1, ?2, ?3, ?4 FROM templates WHERE id = ?2
          ON CONFLICT(template_id, user_id) DO UPDATE SET vote_type = excluded.vote_type
          WHERE template_reactions.vote_type IS NOT excluded.vote_type`
        ).bind(crypto.randomUUID(), template_id, user_id, voteType).run();
      }

      const counts = await fetchCounts(template_id, user_id);
      return jsonResponse({ success: true, ...counts });
    }

    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  } catch (err) {
    const invalid = requestErrorResponse(err);
    if (invalid) return invalid;
    console.error('Template vote request failed:', err.message);
    return jsonResponse({ success: false, error: 'Service temporarily unavailable' }, 500);
  }
}
