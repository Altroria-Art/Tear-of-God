// 📍 หน้า Dashboard ของแอดมิน (สถิติภาพรวมของระบบ)
// Phase 1: สร้างเฉพาะ action=stats เป็นของขวัญ/พื้นฐานให้ UI ใน Phase 3 ใช้ต่อ
// ทุก action เริ่มด้วย requireAdmin(env, user_id) — ตรวจสิทธิ์จาก DB ก่อนจึงทำงาน
// (ดู functions/api/admin/_check.js)
import { requireAdmin } from './_check.js';

export async function onRequest({ request, env }) {
  const db = env.tear_of_god_db;
  const jsonResponse = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

  if (request.method !== 'GET') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }

  const url = new URL(request.url);
  const user_id = url.searchParams.get('user_id');

  if (!(await requireAdmin(env, user_id))) {
    return jsonResponse({ success: false, error: 'ไม่มีสิทธิ์เข้าถึง (ต้องเป็นแอดมิน)' }, 403);
  }

  const action = url.searchParams.get('action') || 'stats';

  if (action === 'stats') {
    try {
      const [users, rankings, templates, votes, comments, follows] = await Promise.all([
        db.prepare('SELECT COUNT(*) as n FROM profiles').first(),
        db.prepare('SELECT COUNT(*) as n FROM rankings').first(),
        db.prepare('SELECT COUNT(*) as n FROM templates').first(),
        db.prepare('SELECT COUNT(*) as n FROM votes').first(),
        db.prepare('SELECT COUNT(*) as n FROM comments').first(),
        db.prepare('SELECT COUNT(*) as n FROM follows').first(),
      ]);

      const stats = {
        users: users?.n || 0,
        rankings: rankings?.n || 0,
        templates: templates?.n || 0,
        votes: votes?.n || 0,
        comments: comments?.n || 0,
        follows: follows?.n || 0,
      };

      return jsonResponse({ success: true, data: stats });
    } catch (err) {
      console.error(err);
      return jsonResponse({ success: false, error: err.message }, 500);
    }
  }

  return jsonResponse({ success: false, error: 'Invalid action' }, 400);
}
