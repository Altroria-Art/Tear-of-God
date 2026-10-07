// Community tiers are assigned by the backend before averages are rounded for display.
// Compare with those exact rows; re-rounding avg can move an item at a tier boundary.
export function buildCommunityRows(template) {
  const definitions = template.tiers || [];
  const itemsById = new Map((template.template_items || []).map(item => [String(item.item_id), item]));
  return definitions.map((tier, index) => ({
    tier: tier.label, color: tier.color, index,
    items: (template.community_average?.tiers?.find(row => row.label === tier.label)?.items || []).map(item => {
      const definition = itemsById.get(String(item.name));
      return { id: String(item.name), name: definition?.item?.name || item.name,
        image_url: definition?.item?.image_url || null, avg: item.avg, votes: item.votes ?? 0 };
    }),
  }));
}

export function compareCommunityRanking(rows, ranking) {
  const tierByLabel = new Map(rows.map(row => [String(row.tier), row]));
  const communityById = new Map(rows.flatMap(row => row.items.map(item => [item.id, { ...item, row }])));
  return (ranking?.ranking_items || []).flatMap(item => {
    const ownTier = tierByLabel.get(String(item.tier));
    const community = communityById.get(String(item.item_id ?? item.item?.id));
    if (!ownTier || !community) return [];
    return [{ id: community.id, name: item.item?.name || community.name,
      myTier: ownTier.tier, myColor: ownTier.color, commTier: community.row.tier,
      commColor: community.row.color, gap: ownTier.index - community.row.index }];
  }).sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));
}
