import { compactHashtags, fallbackDescription, serveAppWithMeta } from '../lib/page-meta.js';

export async function onRequestGet(context) {
  const id = String(context.params.id || '');
  let metadata = {};

  try {
    const template = await context.env.tear_of_god_db.prepare(`
      SELECT t.title, t.description, t.hashtags, p.username,
        (SELECT COUNT(*) FROM template_items ti WHERE ti.template_id = t.id) AS item_count,
        (SELECT COUNT(*) FROM rankings r WHERE r.template_id = t.id) AS use_count
      FROM templates t
      LEFT JOIN profiles p ON p.id = t.creator_id
      WHERE t.id = ?
    `).bind(id).first();

    if (template) {
      const hashtags = compactHashtags(template.hashtags);
      const socialProof = Number(template.use_count) > 0 ? ` · จัดแล้ว ${template.use_count} ครั้ง` : '';
      metadata = {
        title: `${template.title} — เทมเพลต Tier List`,
        description: template.description
          || `${fallbackDescription(template.title, template.item_count)}${socialProof}${hashtags ? ` · ${hashtags}` : ''}`
      };
    }
  } catch (error) {
    console.error('Template metadata query failed:', { name: error?.name, message: error?.message });
  }

  return serveAppWithMeta(context, metadata);
}
