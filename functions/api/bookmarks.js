export async function onRequestPost({ request, env, data: auth }) {
  let body;
  try { body = await request.json(); } catch { return Response.json({ success: false, error: 'Invalid JSON body' }, { status: 400 }); }
  const { template_id, saved } = body;
  if (typeof template_id !== 'string' || typeof saved !== 'boolean') return Response.json({ success: false, error: 'Invalid bookmark' }, { status: 400 });
  const db = env.tear_of_god_db;
  if (!await db.prepare('SELECT id FROM templates WHERE id = ?').bind(template_id).first()) return Response.json({ success: false, error: 'Template not found' }, { status: 404 });
  await db.prepare(saved ? 'INSERT OR IGNORE INTO template_bookmarks (user_id, template_id) VALUES (?, ?)' : 'DELETE FROM template_bookmarks WHERE user_id = ? AND template_id = ?').bind(auth.user.id, template_id).run();
  return Response.json({ success: true, saved });
}
