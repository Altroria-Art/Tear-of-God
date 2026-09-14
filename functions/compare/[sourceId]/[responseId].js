import { serveAppWithMeta } from '../../lib/page-meta.js';

export async function onRequestGet(context) {
  const sourceId = String(context.params.sourceId || '');
  const responseId = String(context.params.responseId || '');
  let metadata = {};

  try {
    const comparison = await context.env.tear_of_god_db.prepare(`
      SELECT source.template_id,
        source_profile.username AS source_name,
        response_profile.username AS response_name,
        t.title AS template_title,
        (SELECT COUNT(*)
         FROM ranking_items source_item
         INNER JOIN ranking_items response_item
           ON response_item.ranking_id = response.id
          AND response_item.item_id = source_item.item_id
         WHERE source_item.ranking_id = source.id
           AND source_item.tier IS NOT NULL
           AND response_item.tier IS NOT NULL) AS total_items,
        (SELECT COUNT(*)
         FROM ranking_items source_item
         INNER JOIN ranking_items response_item
           ON response_item.ranking_id = response.id
          AND response_item.item_id = source_item.item_id
          AND response_item.tier = source_item.tier
         WHERE source_item.ranking_id = source.id
           AND source_item.tier IS NOT NULL) AS matching_items
      FROM rankings source
      INNER JOIN rankings response ON response.id = ? AND response.template_id = source.template_id
      LEFT JOIN profiles source_profile ON source_profile.id = source.user_id
      LEFT JOIN profiles response_profile ON response_profile.id = response.user_id
      LEFT JOIN templates t ON t.id = source.template_id
      WHERE source.id = ?
    `).bind(responseId, sourceId).first();

    if (comparison) {
      const sourceName = comparison.source_name || 'ผู้ท้า';
      const responseName = comparison.response_name || 'ผู้รับคำท้า';
      const total = Number(comparison.total_items) || 0;
      const matches = Number(comparison.matching_items) || 0;
      const score = total > 0 ? Math.round((matches / total) * 100) : 0;
      metadata = {
        title: `${sourceName} vs ${responseName}: ${score}% ใจตรงกัน`,
        description: `ดูผล Challenge “${comparison.template_title || 'Tier List'}” — จัดตรงกัน ${matches} จาก ${total} ไอเทม`
      };
    }
  } catch (error) {
    console.error('Challenge comparison metadata query failed:', { name: error?.name, message: error?.message });
  }

  return serveAppWithMeta(context, metadata);
}
