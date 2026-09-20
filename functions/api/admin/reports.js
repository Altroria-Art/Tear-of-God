// 📍 หน้าแอดมิน: จัดการรายงาน template (ดูรายการ, เปลี่ยนสถานะ, ลบ)
// ทุก action เริ่มด้วย requireAdmin(env, user_id) — ตรวจสิทธิ์จาก DB ก่อนจึงทำงาน
// (ดู functions/api/admin/_check.js)
import { requireAdmin } from './_check.js';
import { assertAllowedFields, assertEnum } from '../../lib/request-guard.js';
import { adminMutationRateLimitResponse, adminRequestErrorResponse, readAdminMutation } from './_request.js';

// Closed reports (resolved/dismissed) stay in D1 for 24 hours after closing so
// admin can reopen them; after that they are physically deleted. Pending reports
// are never touched — status guard keeps the window mechanics honest even if a
// closed_at somehow leaked through on a pending row. Time comparison stays in
// SQLite (datetime('now', '-24 hours'), UTC) so it matches closed_at storage.
const EXPIRY_AT = "datetime('now', '-24 hours')";

async function purgeExpiredReports(db) {
  await db.prepare(
    `DELETE FROM reports
     WHERE status != 'pending'
       AND closed_at IS NOT NULL
       AND closed_at < ${EXPIRY_AT}`
  ).run();
}

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
      // Physically drop closed reports past the 24h reopen window before
      // answering — the list and the pending badge must reflect post-purge state.
      await purgeExpiredReports(db);

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
        SELECT rp.*, t.title AS template_title, t.hashtags AS template_hashtags,
          rk.title AS ranking_title, rk.hashtags AS ranking_hashtags,
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
          template_hashtags: r.template_hashtags,
          ranking_id: r.ranking_id,
          ranking_title: r.ranking_title,
          ranking_hashtags: r.ranking_hashtags,
          comment_id: r.comment_id,
          template_comment_id: r.template_comment_id,
          comment_content: r.comment_content,
          template_comment_content: r.template_comment_content,
          reason: r.reason,
          status: r.status,
          closed_at: r.closed_at,
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
      return adminRequestErrorResponse(err, 'Admin report list');
    }
  }

  // =====================
  // POST — จัดการรายงาน
  // body: { action: 'set_status'|'delete', target_id, status? }
  // =====================
  if (request.method === 'POST') {
    const limited = adminMutationRateLimitResponse(user_id);
    if (limited) return limited;
    try {
      const { payload, action, targetId } = await readAdminMutation(request, ['set_status', 'delete']);

      if (action === 'set_status') {
        assertAllowedFields(payload, ['action', 'target_id', 'status']);
        const status = assertEnum(payload.status, 'status', ['pending', 'resolved', 'dismissed']);

        // Drop rows whose reopen window already passed so the mutation never
        // operates on an expired report. Runs after field validation so
        // rejected requests leave the store untouched.
        await purgeExpiredReports(db);

        if (status === 'pending') {
          // Reopen: only while the report exists and its 24h window has not elapsed.
          const row = await db.prepare(
            `SELECT status,
                    CASE WHEN closed_at IS NOT NULL AND closed_at < ${EXPIRY_AT}
                         THEN 1 ELSE 0 END AS expired
             FROM reports WHERE id = ?`
          ).bind(targetId).first();
          if (!row) {
            return jsonResponse({ success: false, error: 'รายงานไม่พบหรือถูกลบอัตโนมัติแล้ว' }, 404);
          }
          if (row.status === 'pending') {
            // Already pending — idempotent success.
            return jsonResponse({ success: true, data: { id: targetId, status: 'pending' } });
          }
          if (row.expired === 1) {
            await db.prepare('DELETE FROM reports WHERE id = ?').bind(targetId).run();
            return jsonResponse({ success: false, error: 'เกิน 24 ชั่วโมงแล้ว ไม่สามารถเปิดใหม่ได้' }, 410);
          }
          await db.prepare(
            `UPDATE reports SET status = 'pending', closed_at = NULL WHERE id = ?`
          ).bind(targetId).run();
          return jsonResponse({ success: true, data: { id: targetId, status: 'pending' } });
        }

        // Close: set status and stamp the 24h window. An already-closed report
        // keeps its original closed_at (re-closing must not restart the window).
        await db.prepare(
          `UPDATE reports
           SET status = ?, closed_at = CASE WHEN status = 'pending' THEN CURRENT_TIMESTAMP ELSE closed_at END
           WHERE id = ?`
        ).bind(status, targetId).run();
        return jsonResponse({ success: true, data: { id: targetId, status } });
      }

      if (action === 'delete') {
        assertAllowedFields(payload, ['action', 'target_id']);
        await db.prepare('DELETE FROM reports WHERE id = ?').bind(targetId).run();
        return jsonResponse({ success: true, data: { id: targetId } });
      }

      return jsonResponse({ success: false, error: 'Invalid action' }, 400);
    } catch (err) {
      return adminRequestErrorResponse(err, 'Admin report mutation');
    }
  }

  return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
}
