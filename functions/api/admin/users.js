// 📍 หน้าแอดมิน: จัดการผู้ใช้ (ดูรายชื่อ, ตั้งบทบาท admin/user, ลบผู้ใช้)
// ทุก action เริ่มด้วย requireAdmin(env, user_id) — ตรวจสิทธิ์จาก DB ก่อนจึงทำงาน
// (ดู functions/api/admin/_check.js)
import { requireAdmin } from './_check.js';
import { assertAllowedFields, assertEnum } from '../../lib/request-guard.js';
import { adminMutationRateLimitResponse, adminRequestErrorResponse, readAdminMutation } from './_request.js';

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
  // GET — รายชื่อผู้ใช้ (ค้นหา + แบ่งหน้า)
  // =====================
  if (request.method === 'GET') {
    try {
      const q = url.searchParams.get('q');
      const roleFilter = url.searchParams.get('role');
      const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
      const limit = Math.min(Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10) || 20), 100);
      const offset = (page - 1) * limit;

      let whereSql = ` WHERE 1=1`;
      const whereParams = [];
      if (q) {
        whereSql += ` AND (p.username LIKE ? OR p.email LIKE ?)`;
        whereParams.push(`%${q}%`, `%${q}%`);
      }
      if (roleFilter) {
        whereSql += ` AND p.role = ?`;
        whereParams.push(roleFilter);
      }

      const { results: users } = await db.prepare(`
        SELECT p.id, p.username, p.email, p.avatar_url, p.role, p.created_at,
          (SELECT COUNT(*) FROM rankings r WHERE r.user_id = p.id) AS posts_count,
          (SELECT COUNT(*) FROM follows f WHERE f.following_id = p.id) AS followers_count
        FROM profiles p
        ${whereSql}
        ORDER BY p.created_at DESC, p.id DESC
        LIMIT ? OFFSET ?
      `).bind(...whereParams, limit, offset).all();

      const { results: totalRows } = await db.prepare(
        `SELECT COUNT(*) as n FROM profiles p${whereSql}`
      ).bind(...whereParams).all();

      const data = users.map(u => ({
        id: u.id,
        username: u.username,
        email: u.email,
        avatar_url: u.avatar_url,
        role: u.role || 'user',
        posts_count: u.posts_count || 0,
        followers_count: u.followers_count || 0,
        created_at: u.created_at,
      }));

      return jsonResponse({ success: true, data, page, limit, total: totalRows[0]?.n || 0 });
    } catch (err) {
      return adminRequestErrorResponse(err, 'Admin user list');
    }
  }

  // =====================
  // POST — ตั้งบทบาท admin/user หรือลบผู้ใช้
  // body: { action: 'set_role'|'delete', target_id, role? }
  // =====================
  if (request.method === 'POST') {
    const limited = adminMutationRateLimitResponse(user_id);
    if (limited) return limited;
    try {
      const { payload, action, targetId } = await readAdminMutation(request, ['set_role', 'delete']);

      // ⚠️ กันแอดมินลบตัวเองโดยไม่ตั้งใจ (จะได้ไม่มี admin เหลือในระบบ)
      if (targetId === user_id) {
        return jsonResponse({ success: false, error: 'ไม่สามารถจัดการบัญชีแอดมินของตัวเองได้' }, 400);
      }

      if (action === 'set_role') {
        assertAllowedFields(payload, ['action', 'target_id', 'role']);
        const role = assertEnum(payload.role, 'role', ['admin', 'user']);
        await db.prepare('UPDATE profiles SET role = ? WHERE id = ?').bind(role, targetId).run();
        return jsonResponse({ success: true, data: { id: targetId, role } });
      }

      if (action === 'delete') {
        assertAllowedFields(payload, ['action', 'target_id']);
        await db.batch([
          db.prepare('DELETE FROM auth_sessions WHERE user_id = ?').bind(targetId),
          db.prepare('DELETE FROM auth_identities WHERE user_id = ?').bind(targetId),
          db.prepare('DELETE FROM password_resets WHERE user_id = ?').bind(targetId),
          db.prepare('DELETE FROM template_bookmarks WHERE user_id = ?').bind(targetId),
          db.prepare('DELETE FROM reports WHERE reporter_id = ?').bind(targetId),
          db.prepare('DELETE FROM template_reactions WHERE user_id = ?').bind(targetId),
          db.prepare('DELETE FROM template_comments WHERE user_id = ?').bind(targetId),
          db.prepare('DELETE FROM template_views WHERE user_id = ?').bind(targetId),
          db.prepare('DELETE FROM ranking_items WHERE ranking_id IN (SELECT id FROM rankings WHERE user_id = ?)').bind(targetId),
          db.prepare('DELETE FROM votes WHERE ranking_id IN (SELECT id FROM rankings WHERE user_id = ?)').bind(targetId),
          db.prepare('DELETE FROM comments WHERE ranking_id IN (SELECT id FROM rankings WHERE user_id = ?)').bind(targetId),
          db.prepare('DELETE FROM ranking_item_scores WHERE ranking_id IN (SELECT id FROM rankings WHERE user_id = ?)').bind(targetId),
          db.prepare('DELETE FROM rankings WHERE user_id = ?').bind(targetId),
          db.prepare('UPDATE templates SET creator_id = NULL WHERE creator_id = ?').bind(targetId),
          db.prepare('DELETE FROM votes WHERE user_id = ?').bind(targetId),
          db.prepare('DELETE FROM comments WHERE user_id = ?').bind(targetId),
          db.prepare('DELETE FROM follows WHERE follower_id = ? OR following_id = ?').bind(targetId, targetId),
          db.prepare('DELETE FROM profiles WHERE id = ?').bind(targetId)
        ]);
        return jsonResponse({ success: true, data: { id: targetId } });
      }

      return jsonResponse({ success: false, error: 'Invalid action' }, 400);
    } catch (err) {
      return adminRequestErrorResponse(err, 'Admin user mutation');
    }
  }

  return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
}
