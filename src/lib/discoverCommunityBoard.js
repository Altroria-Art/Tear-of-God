import { buildCommunityRows } from './communityComparison.js';

export function buildDiscoverCommunityBoard(board) {
  const rows = buildCommunityRows({ ...board.template, ...board });
  const rankedIds = new Set(rows.flatMap(row => row.items.map(item => item.id)));
  const unranked = board.template_items.filter(entry => !rankedIds.has(String(entry.item_id)))
    .map(entry => ({ id: String(entry.item_id), name: entry.item?.name || entry.item_id, image_url: entry.item?.image_url }));
  return { rows, unranked, itemCount: rankedIds.size + unranked.length };
}
