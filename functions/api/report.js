import { INPUT_LIMITS, assertId, assertString, consumeMemoryRateLimit, isPlainObject, rateLimitResponse, readJsonBody, requestErrorResponse } from '../lib/request-guard.js';

// 📍 รายงาน template / โพสต์ (ranking) — ผู้ใช้แจ้งแอดมินว่าเนื้อหาไม่เหมาะสม
// POST body: { template_id? | ranking_id?, reporter_id, reason }
// ต้องส่งอย่างใดอย่างหนึ่ง (template_id สำหรับรายงานเทมเพลต, ranking_id สำหรับรายงานโพสต์)
// ผู้ใช้ทั่วไป (ทุกคนที่ล็อกอิน) ส่งรายงานได้ — ไม่ต้องเป็น admin (ฝั่ง admin อ่าน/จัดการแยกที่ /api/admin/reports)
export async function onRequest({ request, env, data: auth }) {
  const db = env.tear_of_god_db;
  const jsonResponse = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

  if (request.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }

  try {
    const reporter_id = auth.user.id;
    const gate = consumeMemoryRateLimit('report-create', reporter_id, { limit: 5, windowSeconds: 3600 });
    if (!gate.allowed) return rateLimitResponse(gate);
    const body = await readJsonBody(request);
    if (!isPlainObject(body)) return jsonResponse({ success: false, error: 'Invalid request' }, 400);
    const template_id = assertId(body.template_id, 'template_id', { optional: true }) || null;
    const ranking_id = assertId(body.ranking_id, 'ranking_id', { optional: true }) || null;
    const comment_id = assertId(body.comment_id, 'comment_id', { optional: true }) || null;
    const template_comment_id = assertId(body.template_comment_id, 'template_comment_id', { optional: true }) || null;
    const reason = assertString(body.reason, 'reason', { min: 1, max: INPUT_LIMITS.reportReason, trim: true });

    const targets = [template_id, ranking_id, comment_id, template_comment_id].filter(Boolean);
    if (targets.length !== 1) return jsonResponse({ success: false, error: 'ต้องระบุเป้าหมายเพียงหนึ่งอย่างเท่านั้น' }, 400);

    // เช็คว่า reporter มีอยู่จริงในระบบ (กัน FK constraint ปลอมๆ → 500)
    const reporter = await db.prepare('SELECT id FROM profiles WHERE id = ?').bind(reporter_id).first();
    if (!reporter) return jsonResponse({ success: false, error: 'ผู้ใช้ไม่มีอยู่ในระบบ' }, 401);

    // กันไม่ให้ user เดิมรายงาน item เดียวกันซ้ำถี่ยิบ — ตรวจว่ายังค้าง pending อยู่หรือไม่
    let existing;
    if (template_comment_id) {
      existing = await db.prepare(
        `SELECT id FROM reports WHERE template_comment_id = ? AND reporter_id = ? AND status = 'pending'`
      ).bind(template_comment_id, reporter_id).first();
    } else if (comment_id) {
      existing = await db.prepare(
        `SELECT id FROM reports WHERE comment_id = ? AND reporter_id = ? AND status = 'pending'`
      ).bind(comment_id, reporter_id).first();
    } else if (template_id) {
      existing = await db.prepare(
        `SELECT id FROM reports WHERE template_id = ? AND reporter_id = ? AND status = 'pending'`
      ).bind(template_id, reporter_id).first();
    } else {
      existing = await db.prepare(
        `SELECT id FROM reports WHERE ranking_id = ? AND reporter_id = ? AND status = 'pending'`
      ).bind(ranking_id, reporter_id).first();
    }
    if (existing) {
      return jsonResponse({ success: false, error: 'คุณได้รายงานรายการนี้แล้ว รอแอดมินตรวจสอบ' }, 409);
    }

    // กัน self-report — user รายงานเนื้อหาของตัวเองไม่ได้
    let ownerId = null;
    if (template_comment_id) {
      const owner = await db.prepare('SELECT user_id as uid FROM template_comments WHERE id = ?').bind(template_comment_id).first();
      if (!owner) return jsonResponse({ success: false, error: 'คอมเมนต์ไม่มีอยู่ในระบบ' }, 404);
      ownerId = owner.uid ?? null;
    } else if (comment_id) {
      const owner = await db.prepare('SELECT user_id as uid FROM comments WHERE id = ?').bind(comment_id).first();
      if (!owner) return jsonResponse({ success: false, error: 'คอมเมนต์ไม่มีอยู่ในระบบ' }, 404);
      ownerId = owner.uid ?? null;
    } else if (template_id) {
      const owner = await db.prepare('SELECT creator_id as uid FROM templates WHERE id = ?').bind(template_id).first();
      if (!owner) return jsonResponse({ success: false, error: 'เทมเพลตไม่มีอยู่ในระบบ' }, 404);
      ownerId = owner.uid ?? null;
    } else {
      const owner = await db.prepare('SELECT user_id as uid FROM rankings WHERE id = ?').bind(ranking_id).first();
      if (!owner) return jsonResponse({ success: false, error: 'โพสต์ไม่มีอยู่ในระบบ' }, 404);
      ownerId = owner.uid ?? null;
    }
    if (ownerId === reporter_id) {
      return jsonResponse({ success: false, error: 'ไม่สามารถรายงานเนื้อหาของตัวเองได้' }, 403);
    }

    const id = crypto.randomUUID();
    await db.prepare(
      `INSERT INTO reports (id, template_id, ranking_id, comment_id, template_comment_id, reporter_id, reason) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
    ).bind(id, template_id, ranking_id, comment_id, template_comment_id, reporter_id, reason).run();

    return jsonResponse({ success: true, data: { id } }, 201);
  } catch (err) {
    const invalid = requestErrorResponse(err);
    if (invalid) return invalid;
    console.error('Report request failed:', err.message);
    return jsonResponse({ success: false, error: 'Service temporarily unavailable' }, 500);
  }
}
