// คอมเมนต์ของ Community Average — ผูกกับ template_id (ดู template-votes.js ทำไมถึงเป็น template)
// - GET  /api/template-comments?template_id=..  → รายการคอมเมนต์ (LIMIT 200)
// - POST /api/template-comments  body: { template_id, user_id, content } → สร้างคอมเมนต์
import { INPUT_LIMITS, assertId, assertString, consumeMemoryRateLimit, isPlainObject, rateLimitResponse, readJsonBody, requestErrorResponse } from '../lib/request-guard.js';

export async function onRequest({ request, env, data: auth }) {
  const db = env.tear_of_god_db;
  const jsonResponse = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

  const url = new URL(request.url);
  const templateId = url.searchParams.get('template_id');

  try {
    // 🟢 [GET] ดึงคอมเมนต์ทั้งหมดของ Community Average ของเทมเพลตนี้
    if (request.method === 'GET') {
      if (!templateId) return jsonResponse({ success: false, error: 'Missing template_id' }, 400);
      assertId(templateId, 'template_id');

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
      const user_id = auth.user.id;
      const gate = consumeMemoryRateLimit('template-comment-create', user_id, { limit: 10, windowSeconds: 3600 });
      if (!gate.allowed) return rateLimitResponse(gate);
      const body = await readJsonBody(request);
      if (!isPlainObject(body)) return jsonResponse({ success: false, error: 'Invalid request' }, 400);
      const template_id = assertId(body.template_id, 'template_id');
      const parent_id = assertId(body.parent_id, 'parent_id', { optional: true }) || null;
      const content = assertString(body.content, 'content', { min: 1, max: INPUT_LIMITS.comment, trim: true });

      // เช็คว่า user มีจริง และ template มีอยู่จริง (กัน insert กับ target ที่ไม่มีอยู่)
      const user = await db.prepare('SELECT id FROM profiles WHERE id = ?').bind(user_id).first();
      if (!user) return jsonResponse({ success: false, error: 'ผู้ใช้ไม่มีอยู่ในระบบ' }, 400);
      const template = await db.prepare('SELECT id FROM templates WHERE id = ?').bind(template_id).first();
      if (!template) return jsonResponse({ success: false, error: 'เทมเพลตไม่มีอยู่ในระบบ' }, 404);

      if (parent_id) {
        const parent = await db.prepare('SELECT id FROM template_comments WHERE id = ? AND template_id = ?').bind(parent_id, template_id).first();
        if (!parent) return jsonResponse({ success: false, error: 'คอมเมนต์ที่ต้องการตอบกลับไม่มีอยู่จริง' }, 404);
      }

      const commentId = crypto.randomUUID();
      await db.prepare(
        'INSERT INTO template_comments (id, template_id, user_id, content, parent_id) VALUES (?1, ?2, ?3, ?4, ?5)'
      ).bind(commentId, template_id, user_id, content, parent_id).run();

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
    const invalid = requestErrorResponse(err);
    if (invalid) return invalid;
    console.error('Template comment request failed:', err.message);
    return jsonResponse({ success: false, error: 'Service temporarily unavailable' }, 500);
  }
}
