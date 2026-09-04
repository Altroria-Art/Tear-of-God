export async function onRequest({ request, env }) {
  const db = env.tear_of_god_db;
  const jsonResponse = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

  const url = new URL(request.url);
  const rankingId = url.searchParams.get('ranking_id');

  try {
    // 🟢 [GET] ดึงคอมเมนต์ทั้งหมดของโพสต์นั้น
    if (request.method === 'GET') {
      if (!rankingId) return jsonResponse({ success: false, error: 'Missing ranking_id' }, 400);

      // กัน unbounded growth (ดู docs/row-read-optimization-plan.md §4 hypothesis H4)
      const { results } = await db.prepare(`
        SELECT c.*, p.username, p.avatar_url
        FROM comments c
        LEFT JOIN profiles p ON c.user_id = p.id
        WHERE c.ranking_id = ?
        ORDER BY c.created_at DESC
        LIMIT 200
      `).bind(rankingId).all();

      return jsonResponse({ success: true, data: results });
    }

    // 🟢 [POST] สร้างคอมเมนต์ใหม่
    if (request.method === 'POST') {
      const { ranking_id, user_id, content } = await request.json();

      if (!ranking_id || !user_id || !content?.trim()) {
        return jsonResponse({ success: false, error: 'ข้อมูลไม่ครบถ้วน' }, 400);
      }
      if (content.trim().length > 1000) {
        return jsonResponse({ success: false, error: 'คอมเมนต์ยาวเกินไป — จำกัด 1000 ตัวอักษร' }, 400);
      }

      // เช็คว่า user มีจริง และ ranking มีอยู่จริง (กัน insert กับ target ที่ไม่มีอยู่ → FK fail เงียบๆ)
      const user = await db.prepare('SELECT id FROM profiles WHERE id = ?').bind(user_id).first();
      if (!user) return jsonResponse({ success: false, error: 'ผู้ใช้ไม่มีอยู่ในระบบ' }, 400);
      const ranking = await db.prepare('SELECT id FROM rankings WHERE id = ?').bind(ranking_id).first();
      if (!ranking) return jsonResponse({ success: false, error: 'โพสต์ไม่มีอยู่ในระบบ' }, 404);

      const commentId = crypto.randomUUID();
      await db.batch([
        db.prepare('INSERT INTO comments (id, ranking_id, user_id, content) VALUES (?1, ?2, ?3, ?4)').bind(commentId, ranking_id, user_id, content.trim()),
        db.prepare('UPDATE rankings SET comments_count = comments_count + 1 WHERE id = ?').bind(ranking_id)
      ]);

      // ดึงข้อมูลที่เพิ่งสร้างส่งกลับไปให้หน้าเว็บแสดงผลทันที
      const { results } = await db.prepare(`
        SELECT c.*, p.username, p.avatar_url 
        FROM comments c
        LEFT JOIN profiles p ON c.user_id = p.id
        WHERE c.id = ?
      `).bind(commentId).all();

      return jsonResponse({ success: true, data: results[0] }, 201);
    }

    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  } catch (err) {
    console.error(err);
    return jsonResponse({ success: false, error: err.message }, 500);
  }
}