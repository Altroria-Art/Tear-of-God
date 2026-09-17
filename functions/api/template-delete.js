// POST /api/template-delete — creator ลบ template ของตัวเอง (หรือ admin)
// body: { template_id }
// A2: authorization = creator_id ตรงกับ session user, หรือ admin; ลบ dependencies
// ชุดเดียวกับ admin delete ผ่าน templateDeleteStatements (รวม topic_follows กัน orphan)
import { requireAdmin } from './admin/_check.js';
import { templateDeleteStatements } from '../lib/templateDelete.js';
import {
  assertId,
  consumeMemoryRateLimit,
  isPlainObject,
  rateLimitResponse,
  readJsonBody,
  requestErrorResponse,
} from '../lib/request-guard.js';

export async function onRequestPost({ request, env, data: auth }) {
  const db = env.tear_of_god_db;
  const jsonResponse = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

  const userId = auth.user?.id;
  if (!userId) {
    return jsonResponse({ success: false, error: 'กรุณาเข้าสู่ระบบอีกครั้ง / Please log in again' }, 401);
  }
  const gate = consumeMemoryRateLimit('template-delete', userId, { limit: 10, windowSeconds: 3600 });
  if (!gate.allowed) return rateLimitResponse(gate);

  try {
    const body = await readJsonBody(request);
    if (!isPlainObject(body)) return jsonResponse({ success: false, error: 'Invalid request' }, 400);
    const templateId = assertId(body.template_id, 'template_id');

    const tpl = await db.prepare('SELECT creator_id FROM templates WHERE id = ?').bind(templateId).first();
    if (!tpl) return jsonResponse({ success: false, error: 'Template not found' }, 404);
    if (tpl.creator_id !== userId && !(await requireAdmin(env, userId))) {
      return jsonResponse({ success: false, error: 'ไม่มีสิทธิ์ลบเทมเพลตนี้' }, 403);
    }

    await db.batch(templateDeleteStatements(db, templateId));
    return jsonResponse({ success: true, data: { id: templateId } });
  } catch (error) {
    const invalid = requestErrorResponse(error);
    if (invalid) return invalid;
    console.error('Template delete failed:', error.message);
    return jsonResponse({ success: false, error: 'Service temporarily unavailable' }, 500);
  }
}
