// 📍 หน้าแอดมิน: จัดการรายงาน template (ดูรายการ, เปลี่ยนสถานะ, ลบ)
// ทุก action เริ่มด้วย requireAdmin(env, user_id) — ตรวจสิทธิ์จาก DB ก่อนจึงทำงาน
// (ดู functions/api/admin/_check.js)
import { requireAdmin } from './_check.js';

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
  // GET — รายการรายงาน (กรองตามสถานะ + แบ่งหน้า)
  // =====================
  if (request.method === 'GET') {
    try {
      const status = url.searchParams.get('status'); // 'pending' | 'resolved' | 'dismissed'
      const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
      const limit = Math.min(Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10) || 20), 100);
      const offset = (page - 1) * limit;

      let whereSql = ` WHERE 1=1`;
      const whereParams = [];
      if (status && status !== 'all') {
        whereSql += ` AND rp.status = ?`;
        whereParams.push(status);
      }

      const { results: reports } = await db.prepare(`
        SELECT rp.*, t.title AS template_title, t.category AS template_category,
          rk.title AS ranking_title, rk.category AS ranking_category,
          p.username AS reporter_username, p.email AS reporter_email
        FROM reports rp
        LEFT JOIN templates t ON rp.template_id = t.id
        LEFT JOIN rankings rk ON rp.ranking_id = rk.id
        LEFT JOIN profiles p ON rp.reporter_id = p.id
        ${whereSql}
        ORDER BY rp.created_at DESC, rp.id DESC
        LIMIT ? OFFSET ?
      `).bind(...whereParams, limit, offset).all();

      const { results: totalRows } = await db.prepare(
        `SELECT COUNT(*) as n FROM reports rp${whereSql}`
      ).bind(...whereParams).all();

      // นับ pending ทั้งหมดไว้ให้ badge/หน้าแดชบอร์ด
      const { results: pendingRows } = await db.prepare(
        `SELECT COUNT(*) as n FROM reports WHERE status = 'pending'`
      ).all();

      const data = reports.map(r => ({
        id: r.id,
        kind: r.ranking_id ? 'post' : 'template', // 'post' = รายงานโพสต์ (ranking), 'template' = รายงานเทมเพลต
        template_id: r.template_id,
        template_title: r.template_title,
        template_category: r.template_category,
        ranking_id: r.ranking_id,
        ranking_title: r.ranking_title,
        ranking_category: r.ranking_category,
        reason: r.reason,
        status: r.status,
        reporter: r.reporter_id
          ? { id: r.reporter_id, username: r.reporter_username, email: r.reporter_email }
          : null,
        created_at: r.created_at,
      }));

      return jsonResponse({
        success: true,
        data,
        page,
        limit,
        total: totalRows[0]?.n || 0,
        pending_count: pendingRows[0]?.n || 0,
      });
    } catch (err) {
      console.error(err);
      return jsonResponse({ success: false, error: err.message }, 500);
    }
  }

  // =====================
  // POST — จัดการรายงาน
  // body: { action: 'set_status'|'delete', target_id, status? }
  // =====================
  if (request.method === 'POST') {
    try {
      const { action, target_id, status } = await request.json();
      if (!target_id) return jsonResponse({ success: false, error: 'Missing target_id' }, 400);

      if (action === 'set_status') {
        const valid = ['pending', 'resolved', 'dismissed'];
        if (!valid.includes(status)) return jsonResponse({ success: false, error: 'Invalid status' }, 400);
        await db.prepare('UPDATE reports SET status = ? WHERE id = ?').bind(status, target_id).run();
        return jsonResponse({ success: true, data: { id: target_id, status } });
      }

      if (action === 'delete') {
        await db.prepare('DELETE FROM reports WHERE id = ?').bind(target_id).run();
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
