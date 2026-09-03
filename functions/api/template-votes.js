// like/dislike ให้กับ Community Average ของ template (เช่นเดียวกับ votes.js ของ ranking
// แต่ผูกกับ template_id เพราะตาราง Community Average เป็นข้อมูลรวมของเทมเพลต)
// - GET  /api/template-votes?template_id=..&user_id=..  → คืน user_vote + จำนวน like/dislike
// - POST /api/template-votes  body: { template_id, user_id, voteType }  → โหวต/สลับ/ยกเลิก
export async function onRequest({ request, env }) {
  const db = env.tear_of_god_db;
  const jsonResponse = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

  const fetchCounts = async (templateId, userId) => {
    // นับสดจากตารางเสมอ (ไม่พึ่ง counter ที่ drift ได้) — คล้ายวิธีคำนวณ views/uses ของ templates.js
    const { results } = await db.prepare(
      `SELECT
         (SELECT COUNT(*) FROM template_reactions r WHERE r.template_id = ?1 AND r.vote_type = 'like') AS likes,
         (SELECT COUNT(*) FROM template_reactions r WHERE r.template_id = ?1 AND r.vote_type = 'dislike') AS dislikes,
         (SELECT vote_type FROM template_reactions r WHERE r.template_id = ?1 AND r.user_id = ?2) AS user_vote`
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
      const userId = url.searchParams.get('user_id') || null;
      const counts = await fetchCounts(templateId, userId);
      return jsonResponse({ success: true, ...counts });
    }

    // 🟢 [POST] โหวต/สลับ/ยกเลิก
    if (request.method === 'POST') {
      const { template_id, user_id, voteType } = await request.json();
      if (!template_id || !user_id) {
        return jsonResponse({ success: false, error: 'Missing template_id or user_id' }, 400);
      }

      const { results: existing } = await db.prepare(
        `SELECT * FROM template_reactions WHERE template_id = ? AND user_id = ?`
      ).bind(template_id, user_id).all();

      // ยกเลิกโหวต (voteType เป็น null/cancel)
      if (!voteType) {
        if (existing.length > 0) {
          await db.prepare(
            `DELETE FROM template_reactions WHERE template_id = ? AND user_id = ?`
          ).bind(template_id, user_id).run();
        }
      } else if (voteType !== 'like' && voteType !== 'dislike') {
        return jsonResponse({ success: false, error: 'Invalid vote type' }, 400);
      } else if (existing.length > 0 && existing[0].vote_type === voteType) {
        // กดย้ำอันเดิม = ยกเลิก (toggle off) — เช่นเดิมกับ votes.js
        await db.prepare(
          `DELETE FROM template_reactions WHERE template_id = ? AND user_id = ?`
        ).bind(template_id, user_id).run();
      } else if (existing.length > 0) {
        // สลับจาก like ↔ dislike
        await db.prepare(
          `UPDATE template_reactions SET vote_type = ? WHERE template_id = ? AND user_id = ?`
        ).bind(voteType, template_id, user_id).run();
      } else {
        await db.prepare(
          `INSERT INTO template_reactions (id, template_id, user_id, vote_type) VALUES (?, ?, ?, ?)`
        ).bind(crypto.randomUUID(), template_id, user_id, voteType).run();
      }

      const counts = await fetchCounts(template_id, user_id);
      return jsonResponse({ success: true, ...counts });
    }

    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  } catch (err) {
    return jsonResponse({ success: false, error: err.message }, 500);
  }
}
