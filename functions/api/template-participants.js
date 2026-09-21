// GET /api/template-participants?template_id={id}
// Returns all rankings for a template with user profile and ranking items
// Used by the Community Participants page to show every user's tier-list results
//
// A1: admin-only — response มี faculty/major/year ของผู้ใช้ทุกคน จึงต้อง requireAdmin
// ทั้ง endpoint (ซ่อนปุ่มฝั่ง UI อย่างเดียวไม่พอ); guest → 401, non-admin → 403,
// admin ได้ contract เดิม 100%
import { requireAdmin } from './admin/_check.js';

export async function onRequestGet(context) {
  const { request, env, data: auth } = context;
  const url = new URL(request.url);
  const db = env.tear_of_god_db;

  const userId = auth?.user?.id;
  if (!userId) {
    return Response.json({ success: false, error: 'กรุณาเข้าสู่ระบบอีกครั้ง / Please log in again' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
  if (!(await requireAdmin(env, userId))) {
    return Response.json({ success: false, error: 'ไม่มีสิทธิ์เข้าถึง (ต้องเป็นแอดมิน)' }, { status: 403 });
  }

  const templateId = url.searchParams.get('template_id');
  if (!templateId) {
    return Response.json({ success: false, error: 'Missing template_id' }, { status: 400 });
  }

  try {
    // 1. Get template tiers definition
    const { results: tplRows } = await db.prepare(
      `SELECT tiers FROM templates WHERE id = ?`
    ).bind(templateId).all();

    if (tplRows.length === 0) {
      return Response.json({ success: false, error: 'Template not found' }, { status: 404 });
    }

    let tiersDef = [];
    try {
      tiersDef = tplRows[0].tiers ? JSON.parse(tplRows[0].tiers) : [];
    } catch {
      tiersDef = [];
    }

    // 2. Get all rankings for this template with user profile data
    const { results: rankings } = await db.prepare(`
      SELECT
        r.id as ranking_id,
        r.user_id,
        r.created_at,
        p.username,
        p.avatar_url,
        p.faculty,
        p.major,
        p.year
      FROM rankings r
      LEFT JOIN profiles p ON r.user_id = p.id
      WHERE r.template_id = ?
      ORDER BY r.created_at DESC
    `).bind(templateId).all();

    if (rankings.length === 0) {
      return Response.json({ success: true, data: [], total: 0 });
    }

    // 3. Get ranking items through the template relation without binding one ID per ranking.
    const { results: items } = await db.prepare(`
      SELECT
        ri.ranking_id,
        ri.item_id,
        ri.tier,
        ri.position,
        i.name as item_name
      FROM ranking_items ri
      INNER JOIN rankings r ON r.id = ri.ranking_id
      LEFT JOIN items i ON ri.item_id = i.id
      WHERE r.template_id = ?
      ORDER BY ri.ranking_id, ri.position ASC, ri.rowid ASC
    `).bind(templateId).all();

    // 4. Group items by ranking_id
    const itemsByRanking = {};
    items.forEach(item => {
      if (!itemsByRanking[item.ranking_id]) itemsByRanking[item.ranking_id] = [];
      itemsByRanking[item.ranking_id].push({
        item_id: item.item_id,
        item_name: item.item_name || item.item_id,
        tier: item.tier,
        position: item.position
      });
    });

    // 5. Combine data
    const data = rankings.map(r => ({
      ranking_id: r.ranking_id,
      user_id: r.user_id,
      username: r.username || 'Unknown',
      avatar_url: r.avatar_url,
      faculty: r.faculty || null,
      major: r.major || null,
      year: r.year || null,
      created_at: r.created_at,
      ranking_items: itemsByRanking[r.ranking_id] || [],
      tiers: tiersDef
    }));

    return Response.json({ success: true, data, total: data.length });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
