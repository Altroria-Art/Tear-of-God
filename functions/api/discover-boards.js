import { assertId, RequestError, requestErrorResponse, internalErrorResponse } from '../lib/request-guard.js';
import { publicResponseCache } from '../lib/public-response-cache.js';
import { templateUsageSql } from '../lib/template-usage.js';
import { buildCommunityAverage } from '../lib/community-average.js';

function parseTiers(raw) {
  try { const tiers = JSON.parse(raw || '[]'); return Array.isArray(tiers) ? tiers : []; } catch { return []; }
}

// Public board snapshots contain no comments, sessions, or viewer overlays.
export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const raw = (url.searchParams.get('ids') || '').split(',');
    if (raw.length > 12) throw new RequestError('ids must contain 1-12 topic IDs');
    const ids = [...new Set(raw.map(id => assertId(id, 'ids')))];
    const key = new URL('/api/__discover_boards_v2', url);
    key.searchParams.set('ids', [...ids].sort().join(','));
    return await publicResponseCache(context, new Request(key), 10, () => loadBoards(context.env, ids));
  } catch (error) {
    const invalid = requestErrorResponse(error);
    if (invalid) return invalid;
    console.error('Discover boards failed:', { name: error?.name, message: error?.message });
    return internalErrorResponse();
  }
}

async function loadBoards(env, ids) {
  const db = env.tear_of_god_db;
  const slots = ids.map(() => '?').join(',');
  const { results: topics } = await db.prepare(`
    SELECT t.id, t.title, t.description, t.hashtags, t.tiers,
      ${templateUsageSql(env)} AS uses,
      (SELECT r.created_at FROM rankings r WHERE r.template_id = t.id
        ORDER BY r.created_at DESC, r.id DESC LIMIT 1) AS updated_at,
      (SELECT COUNT(*) FROM template_user_contributions tuc
        WHERE tuc.template_id = t.id AND tuc.current_ranking_id IS NOT NULL) AS participants,
      (SELECT COUNT(*) FROM template_comments c WHERE c.template_id = t.id) AS comments
    FROM templates t WHERE t.id IN (${slots})
  `).bind(...ids).all();

  if (!topics.length) return Response.json({ success: true, data: [] }, { headers: { 'Cache-Control': 'public, max-age=10' } });
  const selectedIds = topics.map(topic => topic.id);
  const selectedSlots = selectedIds.map(() => '?').join(',');
  // Three batch queries, no per-card requests or full ranking histories.
  // Unary + on the template equality keeps SQLite on the ranking/item unique
  // index, avoiding a scan of the topic's history for each contributor.
  const [{ results: pool }, { results: scores }] = await Promise.all([
    db.prepare(`
      SELECT ti.*, COALESCE(i.name, ti.item_id) AS item_name, i.image_url
      FROM template_items ti LEFT JOIN items i ON i.id = ti.item_id
      WHERE ti.template_id IN (${selectedSlots})
      ORDER BY ti.template_id, ti.position, ti.id
    `).bind(...selectedIds).all(),
    db.prepare(`
      WITH histogram AS (
        SELECT tuc.template_id, ris.item_id, ris.score, COUNT(*) AS n
        FROM template_user_contributions tuc
        JOIN ranking_item_scores ris
          ON ris.ranking_id = tuc.current_ranking_id AND +ris.template_id = tuc.template_id
        WHERE tuc.template_id IN (${selectedSlots})
        GROUP BY tuc.template_id, ris.item_id, ris.score
      )
      SELECT h.*, COALESCE(i.name, h.item_id) AS item_name, i.image_url
      FROM histogram h LEFT JOIN items i ON i.id = h.item_id
      ORDER BY h.template_id, h.item_id, h.score
    `).bind(...selectedIds).all(),
  ]);
  const templateItems = new Map(selectedIds.map(id => [id, new Map()]));
  const histograms = new Map(selectedIds.map(id => [id, []]));
  for (const row of pool) {
    templateItems.get(row.template_id).set(row.item_id, { id: row.id, item_id: row.item_id,
      item: { id: row.item_id, name: row.item_name, image_url: row.image_url } });
  }
  for (const row of scores) {
    histograms.get(row.template_id).push(row);
    // Older contributions can reference an item removed from the topic's pool.
    // Preserve its name/image and identity, just as the community detail does.
    const items = templateItems.get(row.template_id);
    if (!items.has(row.item_id)) items.set(row.item_id, { id: row.item_id, item_id: row.item_id,
      item: { id: row.item_id, name: row.item_name, image_url: row.image_url } });
  }
  return Response.json({ success: true, data: topics.map(topic => {
    const tiers = parseTiers(topic.tiers);
    return {
      template: { id: topic.id, title: topic.title, description: topic.description, hashtags: topic.hashtags,
        tiers, use_count: Number(topic.uses) || 0 },
      community_average: buildCommunityAverage(tiers, histograms.get(topic.id), topic.updated_at),
      participant_count: Number(topic.participants) || 0,
      stats: { comments: Number(topic.comments) || 0 },
      template_items: [...templateItems.get(topic.id).values()],
    };
  }) }, { headers: { 'Cache-Control': 'public, max-age=10' } });
}
