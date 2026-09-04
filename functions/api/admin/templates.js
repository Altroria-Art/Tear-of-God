// 📍 หน้าแอดมิน: จัดการ template (ดูรายการ, ลบ template)
// ทุก action เริ่มด้วย requireAdmin(env, user_id) — ตรวจสิทธิ์จาก DB ก่อนจึงทำงาน
// (ดู functions/api/admin/_check.js)
import { requireAdmin } from './_check.js';

function parseTiers(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function onRequest({ request, env }) {
  const db = env.tear_of_god_db;
  const jsonResponse = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

  const url = new URL(request.url);

  // 📍 user_id อาจมาใน query param (GET) หรือ body (POST) — อ่านให้ครอบคลุมทั้งสองแบบ
  let user_id = url.searchParams.get('user_id');
  if (request.method === 'POST' && user_id == null) {
    try {
      const body = await request.clone().json();
      user_id = body.user_id;
    } catch {
      // body ไม่ใช่ JSON — ปล่อยให้ requireAdmin จัดการ (user_id ยังเป็น null → 403)
    }
  }

  if (!(await requireAdmin(env, user_id))) {
    return jsonResponse({ success: false, error: 'ไม่มีสิทธิ์เข้าถึง (ต้องเป็นแอดมิน)' }, 403);
  }

  // =====================
  // GET — รายการ template (ค้นหา + แบ่งหน้า)
  // =====================
  if (request.method === 'GET') {
    try {
      const q = url.searchParams.get('q');
      const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
      const limit = Math.min(Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10) || 20), 100);
      const offset = (page - 1) * limit;

      let whereSql = ` WHERE 1=1`;
      const whereParams = [];
      if (q) {
        whereSql += ` AND t.title LIKE ?`;
        whereParams.push(`%${q}%`);
      }

      const { results: templates } = await db.prepare(`
        SELECT t.*, p.username, p.email,
          (SELECT COUNT(*) FROM rankings r WHERE r.template_id = t.id) AS live_uses,
          (SELECT COUNT(*) FROM template_views v WHERE v.template_id = t.id) AS live_views
        FROM templates t
        LEFT JOIN profiles p ON t.creator_id = p.id
        ${whereSql}
        ORDER BY t.created_at DESC, t.id DESC
        LIMIT ? OFFSET ?
      `).bind(...whereParams, limit, offset).all();

      const { results: totalRows } = await db.prepare(
        `SELECT COUNT(*) as n FROM templates t${whereSql}`
      ).bind(...whereParams).all();

      const data = templates.map(t => ({
        id: t.id,
        title: t.title,
        description: t.description,
        category: t.category,
        tier_count: (parseTiers(t.tiers) || []).length,
        use_count: t.live_uses || 0,
        view_count: t.live_views || 0,
        creator: { id: t.creator_id, username: t.username, email: t.email },
        created_at: t.created_at,
      }));

      return jsonResponse({ success: true, data, page, limit, total: totalRows[0]?.n || 0 });
    } catch (err) {
      console.error(err);
      return jsonResponse({ success: false, error: err.message }, 500);
    }
  }

  // =====================
  // POST — ลบ template (รายการที่ผูกอยู่จะ cascade ตาม FK)
  // body: { action: 'delete', target_id }
  // =====================
  if (request.method === 'POST') {
    try {
      const { action, target_id } = await request.json();
      if (!target_id) return jsonResponse({ success: false, error: 'Missing target_id' }, 400);

      if (action === 'delete') {
        await db.prepare('DELETE FROM templates WHERE id = ?').bind(target_id).run();
        return jsonResponse({ success: true, data: { id: target_id } });
      }

      return jsonResponse({ success: false, error: 'Invalid action' }, 400);
    } catch (err) {
      console.error(err);
      return jsonResponse({ success: false, error: err.message }, 500);
    }
  }

  return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
}
