/**
 * Taste Similarity Calculation Service for Tear-of-God
 *
 * Implements deterministic tier-based comparison between:
 * 1. User A (Challenger) vs User B (Template Owner)
 * 2. User A vs Community Average (excluding User A's current submission)
 *
 * Scores are normalized to 0–100 integer percentages.
 * Consistent with the community disagreement formula in functions/api/rankings.js.
 */

export const MIN_COMMUNITY_SAMPLES = 3;

/**
 * Calculates similarity between two sets of tier placements for a given template.
 *
 * @param {Array<{ item_id: string, tier: string }>} placementsA
 * @param {Array<{ item_id: string, tier: string }>} placementsB
 * @param {Array<{ label: string }>} tierDefinitions - Ordered from highest (index 0) to lowest
 * @returns {{
 *   score: number,
 *   totalItems: number,
 *   sharedItems: number,
 *   matchedItems: number,
 *   itemDetails: Array<{
 *     itemId: string,
 *     tierA: string|null,
 *     tierB: string|null,
 *     tierIndexA: number|null,
 *     tierIndexB: number|null,
 *     distance: number,
 *     isMatch: boolean
 *   }>
 * }}
 */
export function calculateTierSimilarity(placementsA = [], placementsB = [], tierDefinitions = []) {
  const tierIndexByLabel = new Map();
  (tierDefinitions || []).forEach((t, i) => {
    if (t && typeof t.label === 'string') {
      tierIndexByLabel.set(String(t.label), i);
    }
  });

  const tierCount = tierDefinitions?.length || 0;
  const divisor = Math.max(1, tierCount - 1);

  // Map placements by item ID
  const mapA = new Map();
  (placementsA || []).forEach((p) => {
    const id = String(p.item_id || p.id || '');
    if (id && p.tier !== undefined && p.tier !== null) {
      const idx = tierIndexByLabel.has(String(p.tier)) ? tierIndexByLabel.get(String(p.tier)) : null;
      mapA.set(id, { tier: String(p.tier), index: idx });
    }
  });

  const mapB = new Map();
  (placementsB || []).forEach((p) => {
    const id = String(p.item_id || p.id || '');
    if (id && p.tier !== undefined && p.tier !== null) {
      const idx = tierIndexByLabel.has(String(p.tier)) ? tierIndexByLabel.get(String(p.tier)) : null;
      mapB.set(id, { tier: String(p.tier), index: idx });
    }
  });

  // All unique item IDs placed by either user
  const allItemIds = Array.from(new Set([...mapA.keys(), ...mapB.keys()]));
  if (allItemIds.length === 0) {
    return {
      score: 0,
      totalItems: 0,
      sharedItems: 0,
      matchedItems: 0,
      itemDetails: [],
    };
  }

  let totalDistance = 0;
  let sharedItems = 0;
  let matchedItems = 0;
  const itemDetails = [];

  for (const itemId of allItemIds) {
    const a = mapA.get(itemId);
    const b = mapB.get(itemId);

    if (a && b && a.index !== null && b.index !== null) {
      sharedItems += 1;
      const dist = Math.abs(a.index - b.index) / divisor;
      const isMatch = a.index === b.index;
      if (isMatch) matchedItems += 1;
      totalDistance += dist;
      itemDetails.push({
        itemId,
        tierA: a.tier,
        tierB: b.tier,
        tierIndexA: a.index,
        tierIndexB: b.index,
        distance: dist,
        isMatch,
      });
    } else {
      // Item missing from one side — maximum distance penalty
      totalDistance += 1.0;
      itemDetails.push({
        itemId,
        tierA: a?.tier || null,
        tierB: b?.tier || null,
        tierIndexA: a?.index ?? null,
        tierIndexB: b?.index ?? null,
        distance: 1.0,
        isMatch: false,
      });
    }
  }

  const averageDistance = totalDistance / allItemIds.length;
  const score = Math.max(0, Math.min(100, Math.round((1 - averageDistance) * 100)));

  return {
    score,
    totalItems: allItemIds.length,
    sharedItems,
    matchedItems,
    itemDetails,
  };
}

/**
 * Calculates similarity between User A's placements and the Community Average.
 *
 * @param {Array<{ item_id: string, tier: string }>} placementsA
 * @param {Record<string, { sum: number, count: number }>} communityByItem - Item averages from community
 * @param {Array<{ label: string }>} tierDefinitions - Ordered from highest (0) to lowest
 * @param {number} sampleCount - Number of valid community ranking submissions (excluding User A)
 * @param {number} [minSamples=MIN_COMMUNITY_SAMPLES] - Minimum sample threshold
 * @returns {number|null} Similarity score (0–100) or null if insufficient samples
 */
export function calculateCommunitySimilarity(
  placementsA = [],
  communityByItem = {},
  tierDefinitions = [],
  sampleCount = 0,
  minSamples = MIN_COMMUNITY_SAMPLES
) {
  if (typeof sampleCount !== 'number' || sampleCount < minSamples) {
    return null;
  }

  const tierIndexByLabel = new Map();
  (tierDefinitions || []).forEach((t, i) => {
    if (t && typeof t.label === 'string') {
      tierIndexByLabel.set(String(t.label), i);
    }
  });

  const tierCount = tierDefinitions?.length || 0;
  const divisor = Math.max(1, tierCount - 1);

  const validPlacements = (placementsA || []).filter(
    (p) => p && p.item_id && tierIndexByLabel.has(String(p.tier))
  );

  if (validPlacements.length === 0) {
    return null;
  }

  let totalDistance = 0;
  let evaluatedItems = 0;

  for (const placement of validPlacements) {
    const ownIndex = tierIndexByLabel.get(String(placement.tier));
    const comm = communityByItem[placement.item_id];

    if (comm && comm.count > 0) {
      const avgIndex = comm.sum / comm.count;
      totalDistance += Math.abs(ownIndex - avgIndex) / divisor;
      evaluatedItems += 1;
    } else {
      // Community has no data for this specific item
      totalDistance += 1.0;
      evaluatedItems += 1;
    }
  }

  if (evaluatedItems === 0) return null;

  const averageDistance = totalDistance / evaluatedItems;
  return Math.max(0, Math.min(100, Math.round((1 - averageDistance) * 100)));
}
