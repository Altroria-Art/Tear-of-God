// Scores are frozen at publish time. Both detail and Discover assign tiers
// before rounding the displayed average, using one current contribution per user.
export function buildCommunityAverage(tiers, histogram, updatedAt, period = null) {
  const aggregates = new Map();
  for (const row of histogram) {
    const entry = aggregates.get(row.item_id) || { sum: 0, count: 0 };
    entry.sum += row.score * row.n;
    entry.count += row.n;
    aggregates.set(row.item_id, entry);
  }
  const items = [...aggregates].map(([id, entry]) => {
    const average = entry.sum / entry.count;
    const index = Math.max(0, Math.min(tiers.length - 1, tiers.length - Math.round(average)));
    return { id, average, index, votes: entry.count };
  });
  return {
    updated_at: updatedAt,
    period,
    tiers: tiers.map((tier, index) => ({
      label: tier.label, color: tier.color,
      items: items.filter(item => item.index === index)
        .sort((a, b) => b.average - a.average || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
        .map(item => ({ name: item.id, avg: Math.round(item.average * 100) / 100, votes: item.votes })),
    })),
  };
}
