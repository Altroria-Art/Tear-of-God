import { serveAppWithMeta } from '../../lib/page-meta.js';
import { templateUsageSql } from '../../lib/template-usage.js';

export async function onRequestGet(context) {
  const id = String(context.params.id || '');
  let metadata = {};

  try {
    const template = await context.env.tear_of_god_db.prepare(`
      SELECT t.title, t.description,
        ${templateUsageSql(context.env)} AS ranking_count
      FROM templates t
      WHERE t.id = ?
    `).bind(id).first();

    if (template) {
      metadata = {
        title: `Community ranking: ${template.title}`,
        description: `หัวข้อนี้มีการจัดอันดับ ${Number(template.ranking_count) || 0} รายการ ดูอันดับรวมของชุมชน แล้วเทียบกับการจัดของคุณ`
      };
    }
  } catch (error) {
    console.error('Community metadata query failed:', { name: error?.name, message: error?.message });
  }

  return serveAppWithMeta(context, metadata);
}
