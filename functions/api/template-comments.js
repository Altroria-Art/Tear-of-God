// คอมเมนต์ของ Community Average — ผูกกับ template_id (ดู template-votes.js ทำไมถึงเป็น template)
// - GET  /api/template-comments?template_id=..  → รายการคอมเมนต์ (LIMIT 200)
// - POST /api/template-comments  body: { template_id, user_id, content } → สร้างคอมเมนต์
export async function onRequest({ request, env }) {
  const db = env.tear_of_god_db;
  const jsonResponse = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

  const url = new URL(request.url);
  const templateId = url.searchParams.get('template_id');

  try {
    // 🟢 [GET] ดึงคอมเมนต์ทั้งหมดของ Community Average ของเทมเพลตนี้
    if (request.method === 'GET') {
      if (!templateId) return jsonResponse({ success: false, error: 'Missing template_id' }, 400);

      const { results } = await db.prepare(`
        SELECT c.*, p.username, p.avatar_url
        FROM template_comments c
        LEFT JOIN profiles p ON c.user_id = p.id
        WHERE c.template_id = ?
        ORDER BY c.created_at DESC
        LIMIT 200
      `).bind(templateId).all();

      return jsonResponse({ success: true, data: results });
    }

    // 🟢 [POST] สร้างคอมเมนต์ใหม่
    if (request.method === 'POST') {
      const { template_id, user_id, content } = await request.json();

      if (!template_id || !user_id || !content?.trim()) {
        return jsonResponse({ success: false, error: 'ข้อมูลไม่ครบถ้วน' }, 400);
      }

      const commentId = crypto.randomUUID();
      await db.prepare(
        'INSERT INTO template_comments (id, template_id, user_id, content) VALUES (?1, ?2, ?3, ?4)'
      ).bind(commentId, template_id, user_id, content.trim()).run();

      const { results } = await db.prepare(`
        SELECT c.*, p.username, p.avatar_url
        FROM template_comments c
        LEFT JOIN profiles p ON c.user_id = p.id
        WHERE c.id = ?
      `).bind(commentId).all();

      return jsonResponse({ success: true, data: results[0] }, 201);
    }

    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  } catch (err) {
    return jsonResponse({ success: false, error: err.message }, 500);
  }
}
