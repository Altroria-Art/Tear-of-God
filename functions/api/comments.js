import { INPUT_LIMITS, assertId, assertString, consumeMemoryRateLimit, isPlainObject, rateLimitResponse, readJsonBody, requestErrorResponse } from '../lib/request-guard.js';

export async function onRequest({ request, env, data: auth }) {
  const db = env.tear_of_god_db;
  const jsonResponse = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

  const url = new URL(request.url);
  const rankingId = url.searchParams.get('ranking_id');

  try {
    // 🟢 [GET] ดึงคอมเมนต์ทั้งหมดของโพสต์นั้น
    if (request.method === 'GET') {
      if (!rankingId) return jsonResponse({ success: false, error: 'Missing ranking_id' }, 400);
      assertId(rankingId, 'ranking_id');

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
      const user_id = auth.user.id;
      const gate = consumeMemoryRateLimit('comment-create', user_id, { limit: 10, windowSeconds: 3600 });
      if (!gate.allowed) return rateLimitResponse(gate);
      const body = await readJsonBody(request);
      if (!isPlainObject(body)) return jsonResponse({ success: false, error: 'Invalid request' }, 400);
      const ranking_id = assertId(body.ranking_id, 'ranking_id');
      const parent_id = assertId(body.parent_id, 'parent_id', { optional: true }) || null;
      const content = assertString(body.content, 'content', { min: 1, max: INPUT_LIMITS.comment, trim: true });

      // เช็คว่า user มีจริง และ ranking มีอยู่จริง
      const user = await db.prepare('SELECT id FROM profiles WHERE id = ?').bind(user_id).first();
      if (!user) return jsonResponse({ success: false, error: 'ผู้ใช้ไม่มีอยู่ในระบบ' }, 400);
      const ranking = await db.prepare('SELECT id FROM rankings WHERE id = ?').bind(ranking_id).first();
      if (!ranking) return jsonResponse({ success: false, error: 'โพสต์ไม่มีอยู่ในระบบ' }, 404);

      if (parent_id) {
        const parent = await db.prepare('SELECT id FROM comments WHERE id = ? AND ranking_id = ?').bind(parent_id, ranking_id).first();
        if (!parent) return jsonResponse({ success: false, error: 'คอมเมนต์ที่ต้องการตอบกลับไม่มีอยู่จริง' }, 404);
      }

      const commentId = crypto.randomUUID();
      await db.batch([
        db.prepare('INSERT INTO comments (id, ranking_id, user_id, content, parent_id) VALUES (?1, ?2, ?3, ?4, ?5)').bind(commentId, ranking_id, user_id, content, parent_id),
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
    const invalid = requestErrorResponse(err);
    if (invalid) return invalid;
    console.error('Comment request failed:', err.message);
    return jsonResponse({ success: false, error: 'Service temporarily unavailable' }, 500);
  }
}
