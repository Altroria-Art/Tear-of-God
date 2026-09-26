import assert from 'node:assert/strict';
import {
  calculateTierSimilarity,
  calculateCommunitySimilarity,
  MIN_COMMUNITY_SAMPLES,
} from '../../functions/lib/similarity.js';

const standardTiers = [
  { label: 'S', color: '#f87171' },
  { label: 'A', color: '#fdba74' },
  { label: 'B', color: '#fcd34d' },
  { label: 'C', color: '#4ade80' },
  { label: 'D', color: '#60a5fa' },
];

console.log('--- Testing calculateTierSimilarity ---');

// 1. Identical placements -> 100%
{
  const placementsA = [
    { item_id: 'item1', tier: 'S' },
    { item_id: 'item2', tier: 'A' },
    { item_id: 'item3', tier: 'B' },
  ];
  const placementsB = [
    { item_id: 'item1', tier: 'S' },
    { item_id: 'item2', tier: 'A' },
    { item_id: 'item3', tier: 'B' },
  ];
  const res = calculateTierSimilarity(placementsA, placementsB, standardTiers);
  assert.equal(res.score, 100, 'Identical placements should yield 100%');
  assert.equal(res.matchedItems, 3);
  assert.equal(res.sharedItems, 3);
  console.log('✓ 100% match when identical');
}

// 2. Completely opposite placements -> 0%
{
  const placementsA = [
    { item_id: 'item1', tier: 'S' }, // index 0
    { item_id: 'item2', tier: 'S' },
  ];
  const placementsB = [
    { item_id: 'item1', tier: 'D' }, // index 4 (diff = 4/4 = 1.0)
    { item_id: 'item2', tier: 'D' },
  ];
  const res = calculateTierSimilarity(placementsA, placementsB, standardTiers);
  assert.equal(res.score, 0, 'Opposite placements should yield 0%');
  assert.equal(res.matchedItems, 0);
  console.log('✓ 0% match when completely opposite');
}

// 3. Monotonic decrease as difference grows
{
  const base = [{ item_id: 'item1', tier: 'S' }];
  const close = [{ item_id: 'item1', tier: 'A' }]; // dist = 1/4 = 0.25 -> 75%
  const medium = [{ item_id: 'item1', tier: 'B' }]; // dist = 2/4 = 0.50 -> 50%
  const far = [{ item_id: 'item1', tier: 'C' }]; // dist = 3/4 = 0.75 -> 25%
  const opposite = [{ item_id: 'item1', tier: 'D' }]; // dist = 4/4 = 1.0 -> 0%

  const resClose = calculateTierSimilarity(base, close, standardTiers);
  const resMedium = calculateTierSimilarity(base, medium, standardTiers);
  const resFar = calculateTierSimilarity(base, far, standardTiers);
  const resOpposite = calculateTierSimilarity(base, opposite, standardTiers);

  assert.equal(resClose.score, 75);
  assert.equal(resMedium.score, 50);
  assert.equal(resFar.score, 25);
  assert.equal(resOpposite.score, 0);
  assert.ok(resClose.score > resMedium.score && resMedium.score > resFar.score && resFar.score > resOpposite.score);
  console.log('✓ Monotonicity holds: 75% > 50% > 25% > 0%');
}

// 4. Missing items handled gracefully (penalty = 1.0)
{
  const placementsA = [
    { item_id: 'item1', tier: 'S' },
    { item_id: 'item2', tier: 'S' }, // B does not have item2
  ];
  const placementsB = [
    { item_id: 'item1', tier: 'S' }, // distance = 0
  ];
  // item1: dist 0, item2: dist 1.0 -> avg dist = 0.5 -> 50%
  const res = calculateTierSimilarity(placementsA, placementsB, standardTiers);
  assert.equal(res.score, 50);
  assert.equal(res.totalItems, 2);
  assert.equal(res.sharedItems, 1);
  console.log('✓ Missing items penalized gracefully');
}

// 5. Empty inputs -> 0%
{
  const res = calculateTierSimilarity([], [], standardTiers);
  assert.equal(res.score, 0);
  assert.equal(res.totalItems, 0);
  console.log('✓ Empty inputs handled cleanly');
}

// 6. Determinism (same input = same output)
{
  const placementsA = [
    { item_id: 'item1', tier: 'A' },
    { item_id: 'item2', tier: 'C' },
    { item_id: 'item3', tier: 'S' },
  ];
  const placementsB = [
    { item_id: 'item1', tier: 'B' },
    { item_id: 'item2', tier: 'B' },
    { item_id: 'item3', tier: 'S' },
  ];
  const res1 = calculateTierSimilarity(placementsA, placementsB, standardTiers);
  const res2 = calculateTierSimilarity(placementsA, placementsB, standardTiers);
  assert.deepEqual(res1, res2);
  assert.ok(res1.score >= 0 && res1.score <= 100);
  console.log('✓ Calculation is completely deterministic');
}

console.log('\n--- Testing calculateCommunitySimilarity ---');

// 7. Insufficient community samples -> returns null
{
  const placementsA = [{ item_id: 'item1', tier: 'S' }];
  const commByItem = { item1: { sum: 0, count: 2 } };
  const res = calculateCommunitySimilarity(placementsA, commByItem, standardTiers, MIN_COMMUNITY_SAMPLES - 1);
  assert.equal(res, null, 'Should return null when sample count < MIN_COMMUNITY_SAMPLES');
  console.log('✓ Sample count below threshold (2 < 3) returns null');
}

// 8. Sufficient community samples -> calculates percentage
{
  const placementsA = [
    { item_id: 'item1', tier: 'S' }, // index 0
    { item_id: 'item2', tier: 'B' }, // index 2
  ];
  // Community averages:
  // item1: 3 votes on S (0) -> avg index 0 (dist = 0)
  // item2: 3 votes on B (2) -> avg index 2 (dist = 0)
  const commByItem = {
    item1: { sum: 0, count: 3 },
    item2: { sum: 6, count: 3 },
  };
  const res = calculateCommunitySimilarity(placementsA, commByItem, standardTiers, 3);
  assert.equal(res, 100, 'Should match community 100% when exactly aligned');
  console.log('✓ Matches community average accurately');
}

console.log('\nAll similarity unit tests passed successfully!');
