// Automated verification for Popularity Statistics:
// 1. VOTES column removed from table header and rows, bar/AVG claiming remaining space
// 2. Export Statistics supporting true shareFormat (Landscape 1200x630, Square 1080x1080, Story 1080x1920)
// 3. Native dimension styling (no transform scale hack)
// 4. Light and Dark theme verification
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { writeFileSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { STATS_FORMAT_LAYOUT } from '../../src/lib/statsChartLayout.js';

// ── 1. Static Layout Dimensions & Scaling Invariants ──
assert.equal(STATS_FORMAT_LAYOUT.landscape.width, 1200);
assert.equal(STATS_FORMAT_LAYOUT.landscape.height, 630);
assert.equal(STATS_FORMAT_LAYOUT.square.width, 1080);
assert.equal(STATS_FORMAT_LAYOUT.square.height, 1080);
assert.equal(STATS_FORMAT_LAYOUT.story.width, 1080);
assert.equal(STATS_FORMAT_LAYOUT.story.height, 1920);

// Progressive font sizes & row height from Landscape -> Square -> Story
assert.ok(STATS_FORMAT_LAYOUT.landscape.titleSize < STATS_FORMAT_LAYOUT.square.titleSize);
assert.ok(STATS_FORMAT_LAYOUT.square.titleSize < STATS_FORMAT_LAYOUT.story.titleSize);

assert.ok(STATS_FORMAT_LAYOUT.landscape.rowMinHeight < STATS_FORMAT_LAYOUT.square.rowMinHeight);
assert.ok(STATS_FORMAT_LAYOUT.square.rowMinHeight < STATS_FORMAT_LAYOUT.story.rowMinHeight);

assert.ok(STATS_FORMAT_LAYOUT.landscape.barHeight < STATS_FORMAT_LAYOUT.square.barHeight);
assert.ok(STATS_FORMAT_LAYOUT.square.barHeight < STATS_FORMAT_LAYOUT.story.barHeight);

console.log('ok 1 - STATS_FORMAT_LAYOUT geometry and proportional scaling verified');

// ── 2. Component Output Verification via Bundle ──
const here = dirname(fileURLToPath(import.meta.url));
const tempEntry = join(here, '.stats-chart-test-entry.jsx');
const tempOut = join(here, '.stats-chart-test-bundled.mjs');

const entryCode = `
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import CommunityAvgStatsChart from '../../src/components/ui/CommunityAvgStatsChart.jsx';

export function renderChart(props) {
  const element = React.createElement(CommunityAvgStatsChart, props);
  const html = renderToStaticMarkup(element);
  return { element, html };
}
`;

writeFileSync(tempEntry, entryCode, 'utf8');

// Create stubs before building
const themeStubPath = join(here, '.stub-theme.js');
writeFileSync(themeStubPath, 'export function useTheme() { return { isLightMode: true }; }\n', 'utf8');

const i18nStubPath = join(here, '.stub-i18n.js');
writeFileSync(
  i18nStubPath,
  'export function useTranslation() { return { t: (key, opts) => typeof opts === "object" ? `${key} (${JSON.stringify(opts)})` : (opts ?? key), i18n: { language: "en" } }; }\n',
  'utf8'
);

const buildResult = await build({
  entryPoints: [tempEntry],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
  packages: 'external',
  jsx: 'automatic',
  plugins: [
    {
      name: 'stub-modules',
      setup(ctx) {
        ctx.onResolve({ filter: /^react-i18next$/ }, () => ({
          path: i18nStubPath,
        }));
        ctx.onResolve({ filter: /ThemeContext$/ }, () => ({
          path: themeStubPath,
        }));
      },
    },
  ],
});

writeFileSync(tempOut, buildResult.outputFiles[0].text, 'utf8');

const testItems = [
  { name: 'Khao Soi', avg: 4.9, votes: 42 },
  { name: 'Pad Kra Pao', avg: 4.7, votes: 38 },
  { name: 'Som Tum', avg: 4.5, votes: 31 },
  { name: 'Tom Yum Kung', avg: 4.2, votes: 27 },
  { name: 'Massaman Curry', avg: 4.0, votes: 19 },
  { name: 'Green Curry', avg: 3.8, votes: 14 },
  { name: 'Pad Thai', avg: 3.5, votes: 12 },
  { name: 'Mango Sticky Rice', avg: 3.3, votes: 10 },
  { name: 'Spring Rolls', avg: 3.0, votes: 8 },
  { name: 'Satay', avg: 2.8, votes: 5 },
];

try {
  const { renderChart } = await import(`${pathToFileURL(tempOut).href}?t=${Date.now()}`);

  const formats = ['landscape', 'square', 'story'];
  const themes = ['light', 'dark'];

  // ── Test In-Page Mode ──
  for (const theme of themes) {
    const { html } = renderChart({
      title: 'UP Canteen Top Picks',
      subtitle: '10 items · 226 votes',
      items: testItems,
      maxScore: 5,
      theme,
    });

    // In-page must NOT have VOTES in table columns
    assert.ok(!html.includes('stats.votes'), `In-page [${theme}]: table header must not contain votes column`);
    assert.ok(html.includes('stats.avg'), `In-page [${theme}]: table header must retain AVG column`);
    assert.ok(html.includes('Khao Soi'), `In-page [${theme}]: items must render`);
    assert.ok(html.includes('★ 4.9'), `In-page [${theme}]: score must render`);

    // In-page must not have fixed 1200 or 1080 width
    assert.ok(!html.includes('width:1200px') && !html.includes('width: 1200px'), `In-page [${theme}]: should be responsive, not fixed 1200px`);
    assert.ok(!html.includes('width:1080px') && !html.includes('width: 1080px'), `In-page [${theme}]: should be responsive, not fixed 1080px`);

    // Verify theme background
    if (theme === 'dark') {
      assert.ok(html.includes('#141517'), `In-page dark mode must have dark background #141517`);
    } else {
      assert.ok(html.includes('#ffffff'), `In-page light mode must have light background #ffffff`);
    }

    console.log(`ok - In-page [${theme}] mode verified (no votes column, responsive, theme accurate)`);
  }

  // ── Test Export Mode across all 3 formats & both themes ──
  for (const format of formats) {
    for (const theme of themes) {
      const { html } = renderChart({
        title: 'UP Canteen Top Picks',
        subtitle: '10 items · 226 votes',
        items: testItems,
        maxScore: 5,
        shareFormat: format,
        theme,
      });

      const expected = STATS_FORMAT_LAYOUT[format];

      // 1. Dimensions must be exact
      assert.ok(
        html.includes(`width:${expected.width}px`) || html.includes(`width: ${expected.width}px`),
        `[${format} / ${theme}] width must be exactly ${expected.width}px`
      );
      assert.ok(
        html.includes(`height:${expected.height}px`) || html.includes(`height: ${expected.height}px`),
        `[${format} / ${theme}] height must be exactly ${expected.height}px`
      );

      // 2. Must NEVER use transform scale hack to fake dimensions
      assert.ok(
        !html.includes('transform:scale') && !html.includes('transform: scale'),
        `[${format} / ${theme}] must NOT use transform scale on card`
      );

      // 3. VOTES column removed from table
      assert.ok(
        !html.includes('stats.votes'),
        `[${format} / ${theme}] must NOT contain votes column header`
      );
      assert.ok(
        html.includes('stats.avg'),
        `[${format} / ${theme}] must contain AVG column header`
      );

      // 4. Progress bar and items exist
      assert.ok(html.includes('Khao Soi'), `[${format} / ${theme}] item name rendered`);
      assert.ok(html.includes('★ 4.9'), `[${format} / ${theme}] score rendered`);

      // 5. Watermark exists
      assert.ok(html.includes('Tear of God Statistics'), `[${format} / ${theme}] watermark rendered`);
      assert.ok(html.includes('tearofgod.pages.dev'), `[${format} / ${theme}] domain rendered`);

      // 6. Theme colors
      if (theme === 'dark') {
        assert.ok(html.includes('#141517'), `[${format} / dark] background #141517`);
        assert.ok(html.includes('#f3f4f6'), `[${format} / dark] light text #f3f4f6`);
      } else {
        assert.ok(html.includes('#ffffff'), `[${format} / light] background #ffffff`);
        assert.ok(html.includes('#111827'), `[${format} / light] dark text #111827`);
      }

      console.log(`ok - Export [${format} / ${theme}] verified (exact ${expected.width}x${expected.height}, no scale hack, clean no-votes layout)`);
    }
  }

} finally {
  try { unlinkSync(tempEntry); } catch {}
  try { unlinkSync(tempOut); } catch {}
  try { unlinkSync(themeStubPath); } catch {}
  try { unlinkSync(i18nStubPath); } catch {}
}

console.log('All Popularity Statistics checks PASSED!');
