import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

import { onRequest as rankings } from '../../functions/api/rankings.js';
import { onRequestGet as templatesGet } from '../../functions/api/templates.js';

const schema = await readFile(new URL('../../schema.sql', import.meta.url), 'utf8');
const schemaStatements = schema
  .split(/\r?\n/)
  .filter((line) => !line.trimStart().startsWith('--'))
  .join('\n')
  .split(';')
  .map((statement) => statement.trim())
  .filter(Boolean);

const tiers = [
  { id: 'preview-s', label: 'S', color: '#f87171' },
  { id: 'preview-a', label: 'A', color: '#fdba74' },
  { id: 'preview-b', label: 'B', color: '#fcd34d' },
  { id: 'preview-c', label: 'C', color: '#4ade80' },
];
// 8 items alternating tiers: item-0 -> S, item-1 -> A, item-2 -> B, item-3 -> C, item-4 -> S, ...
const rankedItems = Array.from({ length: 8 }, (_, index) => ({
  item_id: `preview-item-${index}`,
  tier: tiers[index % tiers.length].label,
  position: index,
}));
const tierForRanking = (index) => tiers[index % tiers.length].label;

async function createLocalD1() {
  const mf = new Miniflare(convertV4MiniflareOptions({
    modules: true,
    script: 'export default { fetch() { return new Response("local test"); } }',
    compatibilityDate: '2026-01-01',
    d1Databases: ['DB'],
  }));
  const db = await mf.getD1Database('DB');
  await db.batch(schemaStatements.map((statement) => db.prepare(statement)));
  return { mf, db };
}

async function publish(db, body, userId) {
  const response = await rankings({
    request: new Request('https://local.test/api/rankings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    env: { tear_of_god_db: db },
    data: { user: { id: userId } },
  });
  const parsed = await response.json();
  assert.equal(response.status, 201, JSON.stringify(parsed));
  assert.equal(parsed.success, true);
  return parsed;
}

async function discoverList(db, userId) {
  const response = await templatesGet({
    request: new Request('https://local.test/api/templates?limit=50'),
    env: { tear_of_god_db: db },
    data: { user: { id: userId } },
  });
  assert.equal(response.status, 200);
  return (await response.json()).data;
}

// Mirror of TemplateCard's grouping logic (src/components/template/TemplateCard.jsx).
function templateCardPreviewInfo(template) {
  const tiersMap = {};
  (template.template_items || []).forEach((ti) => {
    if (!ti.tier) return;
    if (!tiersMap[ti.tier]) tiersMap[ti.tier] = [];
    tiersMap[ti.tier].push(ti.item?.name || ti.item_id);
  });
  const previewTiers = (template.tiers || []).slice(0, 2);
  const tierRowCount = previewTiers.filter((tier) => (tiersMap[tier.label] || []).length > 0).length;
  return { tiersMap, tierRowCount };
}

async function seedProfile(db, userId) {
  await db.prepare('INSERT INTO profiles (id, username, email) VALUES (?, ?, ?)')
    .bind(userId, userId, `${userId}@local.test`).run();
}

async function run({ withTierOnTemplateItems, userId }) {
  const { mf, db } = await createLocalD1();
  try {
    await seedProfile(db, userId);
    const body = {
      payload: {
        title: 'Preview-ready ranking',
        description: 'Created through the Create flow payload shape',
        hashtags: '#preview,#regression',
      },
      items: rankedItems,
      template: {
        title: 'Preview-ready template',
        description: 'Created through the Create flow payload shape',
        hashtags: '#preview,#regression',
        tiers,
        items: rankedItems.map((item) => withTierOnTemplateItems
          ? { name: item.item_id, position: item.position, tier: item.tier }
          : { name: item.item_id, position: item.position }),
      },
    };
    const created = await publish(db, body, userId);
    const templateId = created.data.template_id;

    // D1 row check: every template item now carries the tier the creator arranged.
    const rows = (await db.prepare(
      'SELECT item_id, tier, position FROM template_items WHERE template_id = ? ORDER BY position'
    ).bind(templateId).all()).results;
    assert.equal(rows.length, rankedItems.length);
    rows.forEach((row, index) => {
      assert.equal(row.item_id, `preview-item-${index}`);
      assert.equal(row.tier, tierForRanking(index));
    });

    // Discover list: TemplateCard must receive non-null tiers and render tier rows,
    // not the "{n} items" fallback chip.
    const list = await discoverList(db, userId);
    const card = list.find((t) => t.id === templateId);
    assert.ok(card, 'created template must appear in Discover template list');
    assert.ok(Array.isArray(card.tiers) && card.tiers.length === tiers.length);
    assert.ok(card.template_items.length > 0);
    card.template_items.forEach((ti) => {
      assert.ok(ti.tier, `template item ${ti.item_id} must keep its tier label`);
    });
    const info = templateCardPreviewInfo(card);
    assert.ok(Object.keys(info.tiersMap).length > 0, 'TemplateCard must group by tier (no item-count fallback)');
    assert.ok(info.tierRowCount >= 1, 'at least one preview tier row must render');
    assert.ok((info.tiersMap['S'] || []).includes('preview-item-0'), 'S tier must show the intended item');

    // Detail path keeps the same mapping for the template detail screen.
    const detailResponse = await templatesGet({
      request: new Request(`https://local.test/api/templates?id=${templateId}`),
      env: { tear_of_god_db: db },
      data: { user: { id: userId } },
    });
    assert.equal(detailResponse.status, 200);
    const detail = (await detailResponse.json()).data;
    detail.template_items.forEach((ti) => assert.ok(ti.tier));

    return { templateId, tiersMap: info.tiersMap, tierRowCount: info.tierRowCount, withTierOnTemplateItems };
  } finally {
    await mf.dispose();
  }
}

// New-style payload (Create.jsx after the fix): tier is sent explicitly.
const explicit = await run({ withTierOnTemplateItems: true, userId: 'preview-user-explicit' });
console.log(`Create payload with explicit tier: ${explicit.tierRowCount} tier rows rendered (S, A)`);

// Legacy payload shape (name + position only): server maps tier from the same
// batch ranking items by name, so old callers get the same preview fix.
const fallback = await run({ withTierOnTemplateItems: false, userId: 'preview-user-legacy' });
console.log(`Legacy payload without tier: ${fallback.tierRowCount} tier rows rendered (S, A)`);

console.log('Template Discover preview checks passed against local Miniflare D1.');