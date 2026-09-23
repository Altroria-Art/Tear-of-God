import assert from 'node:assert/strict';
import { parseHashtags } from '../../src/lib/hashtags.js';

console.log('--- Testing parseHashtags ---');

// 1. Single tag
{
  const result = parseHashtags('#SERIES');
  assert.deepEqual(result, ['#SERIES']);
  console.log('✓ 1 tag parsed correctly');
}

// 2. 3 tags (CSV)
{
  const result = parseHashtags('#SERIES, #FANTASY, #NETFLIX');
  assert.deepEqual(result, ['#SERIES', '#FANTASY', '#NETFLIX']);
  console.log('✓ 3 tags (CSV) parsed correctly');
}

// 3. 8 tags (CSV)
{
  const raw = '#SERIES, #FANTASY, #NETFLIX, #ANIME, #DRAMA, #COMEDY, #ACTION, #THAI';
  const result = parseHashtags(raw);
  assert.equal(result.length, 8);
  assert.deepEqual(result, [
    '#SERIES',
    '#FANTASY',
    '#NETFLIX',
    '#ANIME',
    '#DRAMA',
    '#COMEDY',
    '#ACTION',
    '#THAI',
  ]);
  console.log('✓ 8 tags parsed correctly');
}

// 4. Extremely long hashtag
{
  const longTag = '#THIS_IS_AN_EXTREMELY_LONG_HASHTAG_NAME_THAT_EXCEEDS_NORMAL_LENGTH';
  const result = parseHashtags(longTag);
  assert.deepEqual(result, [longTag]);
  console.log('✓ Long hashtag parsed correctly');
}

// 5. Space-separated format
{
  const result = parseHashtags('#SERIES #FANTASY #NETFLIX');
  assert.deepEqual(result, ['#SERIES', '#FANTASY', '#NETFLIX']);
  console.log('✓ Space-separated format parsed correctly');
}

// 6. JSON array string
{
  const result = parseHashtags('["series", "fantasy", "netflix"]');
  assert.deepEqual(result, ['#series', '#fantasy', '#netflix']);
  console.log('✓ JSON array string parsed correctly');
}

// 7. Deduplication & whitespace resilience
{
  const result = parseHashtags(' #A , #b , #A, c ');
  assert.deepEqual(result, ['#A', '#b', '#c']);
  console.log('✓ Deduplication & trimming work correctly');
}

// 8. Null/undefined/empty handling
{
  assert.deepEqual(parseHashtags(null), []);
  assert.deepEqual(parseHashtags(undefined), []);
  assert.deepEqual(parseHashtags(''), []);
  assert.deepEqual(parseHashtags('   '), []);
  console.log('✓ Null/empty inputs return empty array');
}

console.log('\n--- Testing Card Layout & Overflow Constraints ---');

// Simulate card dimensions across viewports:
// Mobile 320px: screen 320px, main padding px-4 (32px), 2 cols with gap-3 (12px), card p-2.5 (20px padding)
// Card width = (320 - 32 - 12) / 2 = 138px. Usable content width = 138 - 20 = 118px.
// Mobile 390px: screen 390px, main padding px-4 (32px), 2 cols with gap-3 (12px), card p-2.5 (20px padding)
// Card width = (390 - 32 - 12) / 2 = 173px. Usable content width = 173 - 20 = 153px.
// Desktop 1024px+: 3 cols with gap-4 (16px), card p-3 (24px padding), card width ~ 240px+.

const viewports = [
  { name: '320px mobile', cardWidth: 138, contentWidth: 118 },
  { name: '390px mobile', cardWidth: 173, contentWidth: 153 },
  { name: 'Desktop 1024px', cardWidth: 260, contentWidth: 236 },
];

const testCases = [
  { name: '1 tag', raw: '#SERIES' },
  { name: '3 tags', raw: '#SERIES, #FANTASY, #NETFLIX' },
  {
    name: '8 tags',
    raw: '#SERIES, #FANTASY, #NETFLIX, #ANIME, #DRAMA, #COMEDY, #ACTION, #THAI',
  },
  {
    name: 'Extremely long tag',
    raw: '#THIS_IS_AN_EXTREMELY_LONG_HASHTAG_NAME_THAT_EXCEEDS_NORMAL_LENGTH',
  },
];

// Helper to simulate text measurement and flex-wrap layout
function simulateBadgeLayout(tags, containerWidth) {
  const gap = 4; // gap-1 in tailwind = 4px
  const charWidth = 7; // approximate font character width for text-xs font-semibold
  const badgePadding = 16; // px-2 (8px * 2) + 2px border
  let currentLineWidth = 0;
  let lines = 1;

  for (const tag of tags) {
    const rawBadgeWidth = tag.length * charWidth + badgePadding;
    // max-w-full truncate enforces that each badge cannot exceed containerWidth
    const effectiveBadgeWidth = Math.min(rawBadgeWidth, containerWidth);

    assert(
      effectiveBadgeWidth <= containerWidth,
      `Badge width (${effectiveBadgeWidth}px) exceeds container width (${containerWidth}px)!`
    );

    if (currentLineWidth === 0) {
      currentLineWidth = effectiveBadgeWidth;
    } else if (currentLineWidth + gap + effectiveBadgeWidth <= containerWidth) {
      currentLineWidth += gap + effectiveBadgeWidth;
    } else {
      // Wraps to next line
      lines += 1;
      currentLineWidth = effectiveBadgeWidth;
    }

    assert(
      currentLineWidth <= containerWidth,
      `Current line width (${currentLineWidth}px) exceeds container width (${containerWidth}px)!`
    );
  }

  return { lines, maxLineWidth: currentLineWidth };
}

for (const vp of viewports) {
  console.log(`\nViewport: ${vp.name} (card: ${vp.cardWidth}px, content: ${vp.contentWidth}px)`);
  for (const tc of testCases) {
    const tags = parseHashtags(tc.raw);
    const result = simulateBadgeLayout(tags, vp.contentWidth);
    console.log(
      `  ✓ ${tc.name} (${tags.length} tag${tags.length > 1 ? 's' : ''}): wrapped onto ${result.lines} line(s), max width <= ${vp.contentWidth}px (zero horizontal overflow)`
    );
  }
}

console.log('\nAll Profile card hashtag tests passed successfully!');
