export async function onRequest(context) {
  const { request, env } = context;
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
    const body = await request.json();
    const rankingId = body.rankingId || body.ranking_id;
    const userId = body.userId || body.user_id;
    const voteType = body.voteType; // 'like', 'dislike', หรือ null (กรณียกเลิกโหวต)

    if (!rankingId || !userId) {
      return jsonResponse({ success: false, error: 'Missing rankingId or userId' }, 400);
    }

    // 1. เช็คว่า User เคยโหวตโพสต์นี้ไปหรือยัง
    const { results: existing } = await db.prepare(
      `SELECT * FROM votes WHERE ranking_id = ? AND user_id = ?`
    ).bind(rankingId, userId).all();

    // 2. ถ้า voteType เป็น null แปลว่าผู้ใช้กดย้ำเพื่อ "ยกเลิกไลก์/ดิสไลก์"
    if (!voteType) {
      if (existing.length > 0) {
        await db.prepare(
          `DELETE FROM votes WHERE ranking_id = ? AND user_id = ?`
        ).bind(rankingId, userId).run();
      }
    } else {
      // 3. ตรวจสอบความถูกต้องของประเภทการโหวต
      if (voteType !== 'like' && voteType !== 'dislike') {
        return jsonResponse({ success: false, error: 'Invalid vote type' }, 400);
      }

      if (existing.length > 0) {
        // ถ้าเคยโหวตแล้ว ให้ Update เปลี่ยนสถานะ (เช่น จาก Like เป็น Dislike)
        await db.prepare(
          `UPDATE votes SET vote_type = ? WHERE ranking_id = ? AND user_id = ?`
        ).bind(voteType, rankingId, userId).run();
      } else {
        // ถ้ายังไม่เคย ให้ Insert ข้อมูลใหม่
        const voteId = crypto.randomUUID();
        await db.prepare(
          `INSERT INTO votes (id, ranking_id, user_id, vote_type) VALUES (?, ?, ?, ?)`
        ).bind(voteId, rankingId, userId, voteType).run();
      }
    }

    return jsonResponse({ success: true, message: 'Vote updated successfully' });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message }, 500);
  }
}