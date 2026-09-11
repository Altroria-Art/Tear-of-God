// 📍 รายงาน template / โพสต์ (ranking) — ผู้ใช้แจ้งแอดมินว่าเนื้อหาไม่เหมาะสม
// POST body: { template_id? | ranking_id?, reason }
// ต้องส่งอย่างใดอย่างหนึ่ง (template_id สำหรับรายงานเทมเพลต, ranking_id สำหรับรายงานโพสต์)
// ผู้ใช้ทั่วไป (ทุกคนที่ล็อกอิน) ส่งรายงานได้ — ไม่ต้องเป็น admin (ฝั่ง admin อ่าน/จัดการแยกที่ /api/admin/reports)

export async function onRequest({ request, env, data: auth }) {

import { requireUser } from './_auth.js';

export async function onRequest({ request, env }) {

  const db = env.tear_of_god_db;
  const jsonResponse = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

  if (request.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }

  try {

    const { template_id, ranking_id, reason } = await request.json();
    const reporter_id = auth.user.id;

    const actor = await requireUser(request, env);
    if (!actor) return jsonResponse({ success: false, error: 'กรุณาเข้าสู่ระบบใหม่' }, 401);
    const { template_id, ranking_id, reason } = await request.json();
    const reporter_id = actor.id;


    if (!template_id && !ranking_id) return jsonResponse({ success: false, error: 'Missing template_id or ranking_id' }, 400);
    if (!reason || !reason.trim()) return jsonResponse({ success: false, error: 'กรุณาระบุเหตุผลการรายงาน' }, 400);

    // กันไม่ให้ user เดิมรายงาน item เดียวกันซ้ำถี่ยิบ — ตรวจว่ายังค้าง pending อยู่หรือไม่
    let existing;
    if (template_id) {
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
    if (template_id) {
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
      `INSERT INTO reports (id, template_id, ranking_id, reporter_id, reason) VALUES (?1, ?2, ?3, ?4, ?5)`
    ).bind(id, template_id || null, ranking_id || null, reporter_id, reason.trim()).run();

    return jsonResponse({ success: true, data: { id } }, 201);
  } catch (err) {
    console.error(err);
    return jsonResponse({ success: false, error: err.message }, 500);
  }
}
