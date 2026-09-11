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
  if (!(await requireAdmin(env, request))) {
    return jsonResponse({ success: false, error: 'ไม่มีสิทธิ์เข้าถึง (ต้องเป็นแอดมิน)' }, 403);
  }

  const action = url.searchParams.get('action') || 'stats';

  if (action === 'stats') {
    try {
      const [
        users,
        rankings,
        templates,
        votes,
        comments,
        follows,
        pendingReportsRow,
        recentPostsRows,
        recentReportsRows,
        topCategoriesRows,
        topTemplatesRows
      ] = await Promise.all([
        db.prepare('SELECT COUNT(*) as n FROM profiles').first(),
        db.prepare('SELECT COUNT(*) as n FROM rankings').first(),
        db.prepare('SELECT COUNT(*) as n FROM templates').first(),
        db.prepare('SELECT COUNT(*) as n FROM votes').first(),
        db.prepare('SELECT COUNT(*) as n FROM comments').first(),
        db.prepare('SELECT COUNT(*) as n FROM follows').first(),
        db.prepare("SELECT COUNT(*) as n FROM reports WHERE status = 'pending'").first(),
        db.prepare(`
          SELECT r.id, r.title, r.category, r.created_at,
                 p.id as author_id, p.username as author_name, p.avatar_url as author_avatar
          FROM rankings r
          LEFT JOIN profiles p ON r.user_id = p.id
          ORDER BY r.created_at DESC, r.id DESC
          LIMIT 5
        `).all(),
        db.prepare(`
          SELECT rp.id, rp.reason, rp.status, rp.created_at,
                 rp.ranking_id, rp.template_id,
                 rk.title AS ranking_title, t.title AS template_title,
                 p.id AS reporter_id, p.username AS reporter_name
          FROM reports rp
          LEFT JOIN rankings rk ON rp.ranking_id = rk.id
          LEFT JOIN templates t ON rp.template_id = t.id
          LEFT JOIN profiles p ON rp.reporter_id = p.id
          WHERE rp.status = 'pending'
          ORDER BY rp.created_at DESC, rp.id DESC
          LIMIT 5
        `).all(),
        db.prepare(`
          SELECT category, COUNT(*) as count
          FROM rankings
          WHERE category IS NOT NULL AND category != ''
          GROUP BY category
          ORDER BY count DESC
        `).all(),
        db.prepare(`
          SELECT t.id, t.title, t.category,
                 (SELECT COUNT(*) FROM rankings r WHERE r.template_id = t.id) AS live_uses,
                 (SELECT COUNT(*) FROM template_views v WHERE v.template_id = t.id) AS live_views,
                 p.username as author_name
          FROM templates t
          LEFT JOIN profiles p ON t.creator_id = p.id
          ORDER BY live_uses DESC, live_views DESC, t.id DESC
          LIMIT 4
        `).all(),
      ]);

      const stats = {
        users: users?.n || 0,
        rankings: rankings?.n || 0,
        templates: templates?.n || 0,
        votes: votes?.n || 0,
        comments: comments?.n || 0,
        follows: follows?.n || 0,
        pending_reports: pendingReportsRow?.n || 0,
        recent_posts: (recentPostsRows?.results || []).map(r => ({
          id: r.id,
          title: r.title,
          category: r.category,
          created_at: r.created_at,
          author: { id: r.author_id, username: r.author_name, avatar_url: r.author_avatar }
        })),
        recent_reports: (recentReportsRows?.results || []).map(rp => ({
          id: rp.id,
          kind: rp.ranking_id ? 'post' : 'template',
          title: rp.ranking_id ? rp.ranking_title : rp.template_title,
          target_id: rp.ranking_id || rp.template_id,
          reason: rp.reason,
          status: rp.status,
          created_at: rp.created_at,
          reporter: { id: rp.reporter_id, username: rp.reporter_name }
        })),
        top_categories: (topCategoriesRows?.results || []).map(c => ({
          category: c.category,
          count: c.count
        })),
        top_templates: (topTemplatesRows?.results || []).map(t => ({
          id: t.id,
          title: t.title,
          category: t.category,
          uses: t.live_uses ?? 0,
          views: t.live_views ?? 0,
          author: t.author_name
        }))
      };

      return jsonResponse({ success: true, data: stats });
    } catch (err) {
      console.error(err);
      return jsonResponse({ success: false, error: err.message }, 500);
    }
  }

  return jsonResponse({ success: false, error: 'Invalid action' }, 400);
}
