// Admin reports: retained snapshots, decisions, and atomic content deletion.
// ทุก action เริ่มด้วย requireAdmin(env, user_id) — ตรวจสิทธิ์จาก DB ก่อนจึงทำงาน
// (ดู functions/api/admin/_check.js)
import { requireAdmin } from './_check.js';
import { assertAllowedFields, assertEnum } from '../../lib/request-guard.js';
import { adminMutationRateLimitResponse, adminRequestErrorResponse, readAdminMutation } from './_request.js';
import { reportDeletePlan } from '../../lib/moderationDelete.js';
import { evictCommunityCache } from '../../lib/cooldown.js';
import { invalidateSpotlightsCache } from '../../lib/spotlight-cache.js';

const TARGETS = { template: ['template_id', 'templates'], post: ['ranking_id', 'rankings'], comment: ['comment_id', 'comments'], template_comment: ['template_comment_id', 'template_comments'] };

export async function onRequest({ request, env, data: auth }) {
  const db = env.tear_of_god_db;
  const jsonResponse = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

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
      if (status && !['all', 'pending', 'resolved', 'dismissed'].includes(status)) return jsonResponse({ success: false, error: 'Invalid status' }, 400);
      const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
      const limit = Math.min(Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10) || 20), 100);
      const offset = (page - 1) * limit;

      let whereSql = ` WHERE 1=1`;
      const whereParams = [];
      if (status === 'resolved') {
        whereSql += ` AND rp.status IN ('resolved', 'dismissed')`;
      } else if (status && status !== 'all') {
        whereSql += ` AND rp.status = ?`;
        whereParams.push(status);
      }

      const { results: reports } = await db.prepare(`
        SELECT rp.*, p.username AS reporter_username, p.email AS reporter_email,
          m.username AS moderator_username
        FROM reports rp
        LEFT JOIN profiles p ON rp.reporter_id = p.id
        LEFT JOIN profiles m ON rp.moderated_by = m.id
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

      const actions = reports.length ? (await db.prepare(`SELECT report_id, action, status, actor_id, actor_name, created_at FROM report_actions
        WHERE report_id IN (${reports.map(() => '?').join(',')}) ORDER BY id`).bind(...reports.map(r => r.id)).all()).results : [];
      const history = new Map();
      for (const action of actions) { if (!history.has(action.report_id)) history.set(action.report_id, []); history.get(action.report_id).push(action); }
      const data = reports.map(r => {
        const kind = r.target_kind || (r.template_comment_id ? 'template_comment' : r.comment_id ? 'comment' : r.ranking_id ? 'post' : 'template');

        return {
          id: r.id,
          kind,
          template_id: r.template_id,
          template_title: kind === 'template' ? r.content_title : r.context_title,
          template_hashtags: r.content_hashtags,
          ranking_id: r.ranking_id,
          ranking_title: kind === 'post' ? r.content_title : r.context_title,
          ranking_hashtags: r.content_hashtags,
          comment_id: r.comment_id,
          template_comment_id: r.template_comment_id,
          comment_content: kind === 'comment' ? r.content_text : null,
          template_comment_content: kind === 'template_comment' ? r.content_text : null,
          snapshot: { title: r.content_title, text: r.content_text, hashtags: r.content_hashtags, context_title: r.context_title },
          target_key: r.target_key,
          target_removed_at: r.target_removed_at,
          moderation_action: r.moderation_action,
          moderated_at: r.moderated_at,
          moderator: r.moderated_by ? { id: r.moderated_by, username: r.moderator_username } : null,
          history: history.get(r.id) || [],
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
  // body: { action: 'set_status'|'delete_content', target_id, status? }
  // =====================
  if (request.method === 'POST') {
    const limited = adminMutationRateLimitResponse(user_id);
    if (limited) return limited;
    try {
      const { payload, action, targetId } = await readAdminMutation(request, ['set_status', 'delete_content']);

      if (action === 'set_status') {
        assertAllowedFields(payload, ['action', 'target_id', 'status']);
        const status = assertEnum(payload.status, 'status', ['pending', 'resolved', 'dismissed']);

        const row = await db.prepare('SELECT status, moderation_action, target_removed_at FROM reports WHERE id = ?').bind(targetId).first();
        if (!row) return jsonResponse({ success: false, error: 'Report not found' }, 404);
        if (row.target_removed_at) return jsonResponse({ success: false, error: 'Reported content has been removed' }, 409);
        if (row.status !== status) {
          const result = await db.prepare(`UPDATE reports SET status = ?, moderation_action = ?, moderated_by = ?, moderated_at = CURRENT_TIMESTAMP,
            closed_at = CASE WHEN ? = 'pending' THEN NULL ELSE CURRENT_TIMESTAMP END
            WHERE id = ? AND target_removed_at IS NULL`).bind(status, status === 'pending' ? 'reopened' : 'kept', user_id, status, targetId).run();
          if (!result.meta.changes) return jsonResponse({ success: false, error: 'Reported content has been removed' }, 409);
        }
        return jsonResponse({ success: true, data: { id: targetId, status, moderation_action: row.status === status ? row.moderation_action : status === 'pending' ? 'reopened' : 'kept' } });
      }

      if (action === 'delete_content') {
        assertAllowedFields(payload, ['action', 'target_id']);
        const report = await db.prepare('SELECT * FROM reports WHERE id = ?').bind(targetId).first();
        if (!report) return jsonResponse({ success: false, error: 'Report not found' }, 404);
        if (!report.target_removed_at) {
          const target = TARGETS[report.target_kind];
          if (!target || !report[target[0]]) return jsonResponse({ success: false, error: 'Reported content has been removed' }, 409);
          const [column, table] = target;
          const plan = await reportDeletePlan(db, report);
          await db.batch([
            db.prepare(`UPDATE reports SET status = 'resolved', moderation_action = 'deleted', moderated_by = ?, moderated_at = CURRENT_TIMESTAMP, closed_at = CURRENT_TIMESTAMP
              WHERE ${column} = ? AND target_kind = ? AND target_removed_at IS NULL AND EXISTS (SELECT 1 FROM ${table} WHERE id = ?)`)
              .bind(user_id, report[column], report.target_kind, report[column]),
            ...plan.statements,
          ]);
          await Promise.all([
            ...(plan.templateId ? [evictCommunityCache(request, plan.templateId)] : []),
            ...(plan.spotlights ? [invalidateSpotlightsCache(request)] : []),
          ]);
        }
        return jsonResponse({ success: true, data: { id: targetId, status: 'resolved', moderation_action: report.target_removed_at ? report.moderation_action : 'deleted' } });
      }

      return jsonResponse({ success: false, error: 'Invalid action' }, 400);
    } catch (err) {
      return adminRequestErrorResponse(err, 'Admin report mutation');
    }
  }

  return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
}
