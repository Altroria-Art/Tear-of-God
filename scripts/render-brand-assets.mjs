// Rebuild the product SVGs and 1200×630 share image from the app's theme tokens.
// Uses installed Chromium; CHROME_PATH can override the Windows default.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '../tests/local/helpers/chromium.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const theme = fs.readFileSync(path.join(root, 'src/index.css'), 'utf8');
const color = name => {
  const value = theme.match(new RegExp(`--color-${name}:\\s*(#[a-fA-F0-9]+);`))?.[1];
  if (!value) throw new Error(`Missing theme color: ${name}`);
  return value;
};
const ink = color('acid-ink'), lime = color('acid'), violet = color('pop-violet');
const paper = color('light-surface'), canvas = color('light-canvas');
const pink = color('pop-pink'), red = color('tier-s'), orange = color('tier-a'), yellow = color('tier-b');
const drop = 'M42 5C42 18 57 22 57 38C57 53 47 60 32 60C18 60 7 51 7 37C7 20 25 8 42 5Z';
const spark = 'M33 21L37 31L47 35L37 39L33 49L29 39L19 35L29 31Z';
const mark = `<path d="${drop}" fill="${violet}" transform="translate(2 2)"/>
  <path d="${drop}" fill="${lime}" stroke="${ink}" stroke-width="2.5" stroke-linejoin="round"/>
  <path d="${spark}" fill="${ink}"/>`;
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><title>Tear of God</title>${mark}</svg>\n`;
const placeholder = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 150" role="img" aria-label="Unpictured tier list item">
  <rect width="150" height="150" rx="24" fill="${canvas}"/>
  <g transform="rotate(-10 75 75)"><rect x="43" y="25" width="70" height="88" rx="12" fill="${violet}" stroke="${ink}" stroke-width="2"/></g>
  <g transform="rotate(6 75 75)"><rect x="31" y="39" width="78" height="91" rx="12" fill="${paper}" stroke="${ink}" stroke-width="2"/>
    <rect x="41" y="50" width="58" height="28" rx="6" fill="${lime}"/>
    <path d="M51 94H88M51 106H74" stroke="${ink}" stroke-width="5" stroke-linecap="round"/>
  </g><path d="M118 16L122 27L133 31L122 35L118 46L114 35L103 31L114 27Z" fill="${ink}"/>
</svg>\n`;

// All typography is local: the exported PNG does not depend on remote fonts.
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
 <defs><pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" stroke="${ink}" stroke-opacity=".05"/></pattern></defs>
 <rect width="1200" height="630" fill="${canvas}"/><rect width="1200" height="630" fill="url(#grid)"/>
 <g font-family="Arial, sans-serif" fill="${ink}">
  <g transform="translate(43 31) scale(.85)">${mark}</g>
  <text x="110" y="64" font-size="18" font-weight="900" letter-spacing="2">THE TIER LIST COMMUNITY</text>
  <path d="M48 94H1152" stroke="${ink}" stroke-width="2"/>
  <g transform="rotate(3 1014 49)"><rect x="882" y="29" width="270" height="40" rx="20" fill="${lime}" stroke="${ink}" stroke-width="2"/>
   <text x="1017" y="55" text-anchor="middle" font-size="16" font-weight="900">RANK. SHARE. REPEAT.</text></g>
  <text x="43" y="250" font-family="Arial Black, Arial, sans-serif" font-size="142" font-weight="900" letter-spacing="-10">TEAR</text>
  <g transform="rotate(-2 342 333)"><rect x="43" y="282" width="633" height="150" rx="5" fill="${lime}"/>
   <text x="55" y="407" font-family="Arial Black, Arial, sans-serif" font-size="142" font-weight="900" letter-spacing="-10">OF GOD.</text></g>
  <text x="52" y="481" font-size="27" font-weight="900" letter-spacing="1">YOUR TASTE. YOUR TIER.</text>
  <text x="52" y="518" font-size="20">One topic. A thousand opinions. Yours next.</text>
  <g transform="rotate(5 917 306)">
   <rect x="726" y="160" width="378" height="318" rx="22" fill="${violet}"/>
   <rect x="712" y="147" width="378" height="318" rx="22" fill="${paper}" stroke="${ink}" stroke-width="3"/>
   <text x="738" y="184" font-size="14" font-weight="900" letter-spacing="2">YOUR RANKING</text>
   <circle cx="1049" cy="179" r="3"/><circle cx="1060" cy="179" r="3"/>
   <g transform="translate(730 205)">
    <rect width="342" height="70" rx="12" fill="${canvas}" stroke="${ink}" stroke-width="1.5"/>
    <path d="M12 0H62V70H12Q0 70 0 58V12Q0 0 12 0Z" fill="${red}"/>
    <text x="31" y="47" text-anchor="middle" font-size="32" font-weight="900">S</text>
    <g transform="rotate(-4 142 35)"><rect x="77" y="10" width="142" height="51" rx="9" fill="${paper}" stroke="${ink}" stroke-width="2"/>
     <text x="148" y="43" text-anchor="middle" font-size="20" font-weight="900">MUSIC</text></g>
    <path d="M250 24L265 38L291 13" fill="none" stroke="${ink}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
   </g>
   <g transform="translate(730 285)">
    <rect width="342" height="70" rx="12" fill="${canvas}" stroke="${ink}" stroke-width="1.5"/>
    <path d="M12 0H62V70H12Q0 70 0 58V12Q0 0 12 0Z" fill="${orange}"/>
    <text x="31" y="47" text-anchor="middle" font-size="32" font-weight="900">A</text>
    <g transform="rotate(3 158 35)"><rect x="91" y="10" width="142" height="51" rx="9" fill="${paper}" stroke="${ink}" stroke-width="2"/>
     <text x="162" y="43" text-anchor="middle" font-size="20" font-weight="900">GAMES</text></g>
   </g>
   <g transform="translate(730 365)">
    <rect width="342" height="70" rx="12" fill="${canvas}" stroke="${ink}" stroke-width="1.5"/>
    <path d="M12 0H62V70H12Q0 70 0 58V12Q0 0 12 0Z" fill="${yellow}"/>
    <text x="31" y="47" text-anchor="middle" font-size="32" font-weight="900">B</text>
    <rect x="77" y="10" width="122" height="51" rx="9" fill="${paper}" stroke="${ink}" stroke-width="2"/>
    <text x="138" y="43" text-anchor="middle" font-size="20" font-weight="900">FOOD</text>
   </g>
  </g>
  <g transform="rotate(-12 777 133)"><rect x="688" y="103" width="178" height="48" rx="5" fill="${pink}" stroke="${ink}" stroke-width="2"/>
   <text x="777" y="134" text-anchor="middle" font-size="19" font-weight="900">S-TIER ENERGY</text></g>
  <path d="M1124 406L1131 430L1156 437L1131 444L1124 469L1117 444L1092 437L1117 430Z" fill="${ink}"/>
  <path d="M48 553H1152" stroke="${ink}" stroke-width="2"/>
  <text x="52" y="593" font-size="17" font-weight="700">tear-of-god.pages.dev</text>
  <g transform="translate(871 568)"><rect width="280" height="39" rx="19.5" fill="${ink}"/>
   <text x="140" y="26" text-anchor="middle" fill="${paper}" font-size="15" font-weight="900" letter-spacing="1">AGREE? MAKE YOUR OWN.</text></g>
 </g>
</svg>`;

let browser;
try {
  browser = await chromium();
  const page = await browser.page();
  await page.viewport(1200, 630);
  await page.goto(`data:image/svg+xml;base64,${Buffer.from(og).toString('base64')}`);
  await page.until(`document.documentElement.tagName==='svg' && document.readyState==='complete'`, 'Brand share artwork loaded');
  await page.screenshot(path.join(root, 'public/og-default.png'));
  fs.writeFileSync(path.join(root, 'public/favicon.svg'), favicon);
  fs.writeFileSync(path.join(root, 'public/item-placeholder.svg'), placeholder);
  console.log('Updated favicon.svg, item-placeholder.svg and og-default.png (1200×630).');
} finally { await browser?.close(); }
