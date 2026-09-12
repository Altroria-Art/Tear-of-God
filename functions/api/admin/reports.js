// 📍 หน้าแอดมิน: จัดการรายงาน template (ดูรายการ, เปลี่ยนสถานะ, ลบ)
// ทุก action เริ่มด้วย requireAdmin(env, user_id) — ตรวจสิทธิ์จาก DB ก่อนจึงทำงาน
// (ดู functions/api/admin/_check.js)
import { requireAdmin } from './_check.js';

export async function onRequest({ request, env, data: auth }) {
  const db = env.tear_of_god_db;
  const jsonResponse = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

  const url = new URL(request.url);

  // The API middleware supplies the verified session owner.
  const user_id = auth.user.id;

  if (!(await requireAdmin(env, user_id))) {
    return jsonResponse({ success: false, error: 'ไม่มีสิทธิ์เข้าถึง (ต้องเป็นแอดมิน)' }, 403);
  }

  // =====================
  // GET — รายการรายงาน (กรองตามสถานะ + แบ่งหน้า)
  // =====================
  if (request.method === 'GET') {
    try {
      if (url.searchParams.get('count') === 'pending') {
        const row = await db.prepare(
          `SELECT COUNT(*) as n FROM reports WHERE status = 'pending'`
        ).first();
        return jsonResponse({ success: true, pending_count: row?.n || 0 });
      }

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
          c.content AS comment_content, tc.content AS template_comment_content,
          p.username AS reporter_username, p.email AS reporter_email
        FROM reports rp
        LEFT JOIN templates t ON rp.template_id = t.id
        LEFT JOIN rankings rk ON rp.ranking_id = rk.id
        LEFT JOIN comments c ON rp.comment_id = c.id
        LEFT JOIN template_comments tc ON rp.template_comment_id = tc.id
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

      const data = reports.map(r => {
        let kind = 'template';
        if (r.template_comment_id) kind = 'template_comment';
        else if (r.comment_id) kind = 'comment';
        else if (r.ranking_id) kind = 'post';

        return {
          id: r.id,
          kind,
          template_id: r.template_id,
          template_title: r.template_title,
          template_category: r.template_category,
          ranking_id: r.ranking_id,
          ranking_title: r.ranking_title,
          ranking_category: r.ranking_category,
          comment_id: r.comment_id,
          template_comment_id: r.template_comment_id,
          comment_content: r.comment_content,
          template_comment_content: r.template_comment_content,
          reason: r.reason,
          status: r.status,
          reporter: r.reporter_id
            ? { id: r.reporter_id, username: r.reporter_username, email: r.reporter_email }
            : null,
          created_at: r.created_at,
        };
      });

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
