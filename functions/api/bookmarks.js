import { assertId, consumeMemoryRateLimit, isPlainObject, rateLimitResponse, readJsonBody, requestErrorResponse } from '../lib/request-guard.js';

export async function onRequestPost({ request, env, data: auth }) {
  try {
    const gate = consumeMemoryRateLimit('bookmark-mutation', auth.user.id, { limit: 60, windowSeconds: 3600 });
    if (!gate.allowed) return rateLimitResponse(gate);
    const body = await readJsonBody(request);
    if (!isPlainObject(body)) return Response.json({ success: false, error: 'Invalid request' }, { status: 400 });
    const template_id = assertId(body.template_id, 'template_id');
    const { saved } = body;
    if (typeof saved !== 'boolean') return Response.json({ success: false, error: 'Invalid bookmark' }, { status: 400 });
    const db = env.tear_of_god_db;
    if (!await db.prepare('SELECT id FROM templates WHERE id = ?').bind(template_id).first()) return Response.json({ success: false, error: 'Template not found' }, { status: 404 });
    await db.prepare(saved ? 'INSERT OR IGNORE INTO template_bookmarks (user_id, template_id) VALUES (?, ?)' : 'DELETE FROM template_bookmarks WHERE user_id = ? AND template_id = ?').bind(auth.user.id, template_id).run();
    return Response.json({ success: true, saved });
  } catch (error) {
    const invalid = requestErrorResponse(error);
    if (invalid) return invalid;
    console.error('Bookmark request failed:', error.message);
    return Response.json({ success: false, error: 'Service temporarily unavailable' }, { status: 500 });
  }
}
