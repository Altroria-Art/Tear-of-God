import { serveAppWithMeta } from '../../lib/page-meta.js';

export async function onRequestGet(context) {
  const id = String(context.params.id || '');
  let metadata = {};

  try {
    const template = await context.env.tear_of_god_db.prepare(`
      SELECT t.title, t.description,
        (SELECT COUNT(*) FROM rankings r WHERE r.template_id = t.id) AS participant_count
      FROM templates t
      WHERE t.id = ?
    `).bind(id).first();

    if (template) {
      metadata = {
        title: `Community Average: ${template.title}`,
        description: `ดูอันดับเฉลี่ยจาก ${Number(template.participant_count) || 0} คน แล้วมาดูกันว่าชุมชนเห็นตรงกันแค่ไหน`
      };
    }
  } catch (error) {
    console.error('Community metadata query failed:', { name: error?.name, message: error?.message });
  }

  return serveAppWithMeta(context, metadata);
}
