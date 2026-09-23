import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

import { onRequest as rankings } from '../../functions/api/rankings.js';
import { onRequestGet as templatesGet } from '../../functions/api/templates.js';
import { normalizeTemplatePreview } from '../../src/lib/templatePreview.js';

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

async function seedProfile(db, userId, username, avatarUrl) {
  await db.prepare('INSERT INTO profiles (id, username, email, avatar_url) VALUES (?, ?, ?, ?)')
    .bind(userId, username || userId, `${userId}@local.test`, avatarUrl || null).run();
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

    // Normalize preview using TemplateCard's normalizer
    const preview = normalizeTemplatePreview(card);
    assert.equal(preview.mode, 'tiered', 'Card with tiers must be in tiered mode');
    assert.equal(preview.rows.length, 2, 'Top 2 tiers must be rendered');
    assert.equal(preview.rows[0].label, 'S');
    assert.equal(preview.rows[1].label, 'A');

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

async function testTemplateWithTiersAndNullItemTiers() {
  const { mf, db } = await createLocalD1();
  try {
    const userId = 'creator-null-tier';
    await seedProfile(db, userId, 'NullTierCreator');

    const customTiers = [
      { id: 'tier-1', label: 'เบรกอยู่ไหน', color: '#ef4444' },
      { id: 'tier-2', label: 'ซิ่งนรก', color: '#f97316' },
      { id: 'tier-3', label: 'ธรรมดา', color: '#eab308' },
    ];

    const templateId = 'tpl-null-tiers';
    await db.prepare(
      'INSERT INTO templates (id, creator_id, title, description, hashtags, tiers) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(
      templateId,
      userId,
      'รถเมล์มอพะเยาสุดซิ่ง',
      'เทมเพลตรถเมล์',
      '#มพ,#bus',
      JSON.stringify(customTiers)
    ).run();

    // Insert items with tier: null
    const items = [
      { item_id: 'bus-1', position: 0 },
      { item_id: 'bus-2', position: 1 },
      { item_id: 'bus-3', position: 2 },
    ];
    for (const item of items) {
      await db.prepare(
        'INSERT INTO template_items (id, template_id, item_id, position, tier) VALUES (?, ?, ?, ?, NULL)'
      ).bind(`ti-${item.item_id}`, templateId, item.item_id, item.position).run();
    }

    // Fetch from /api/templates (Discover list)
    const response = await templatesGet({
      request: new Request('https://local.test/api/templates?limit=50'),
      env: { tear_of_god_db: db },
      data: { user: { id: userId } },
    });
    assert.equal(response.status, 200);
    const list = (await response.json()).data;
    const card = list.find((t) => t.id === templateId);
    assert.ok(card, 'template with null-tier items must appear in discover list');
    assert.equal(card.tiers.length, 3);
    assert.ok(card.template_items.every((ti) => ti.tier === null));

    // Test preview normalizer:
    const preview = normalizeTemplatePreview(card);
    // 1. Must be in 'tiered' mode, NOT 'grid'
    assert.equal(preview.mode, 'tiered', 'Must NOT fallback to item-grid when tiers exist');
    // 2. Exactly top 2 real tiers shown
    assert.equal(preview.rows.length, 2);
    assert.equal(preview.rows[0].label, 'เบรกอยู่ไหน');
    assert.equal(preview.rows[1].label, 'ซิ่งนรก');
    // 3. Lanes are empty because tier is null (no guessing / forcing into tiers)
    assert.equal(preview.rows[0].items.length, 0);
    assert.equal(preview.rows[1].items.length, 0);
    assert.equal(preview.totalCount, 3);

    console.log('ok - template with tiers and null item tiers correctly preserves real tier labels in tiered mode');
  } finally {
    await mf.dispose();
  }
}

async function testTemplateCreatorIntegrityAcrossApiPaths() {
  const { mf, db } = await createLocalD1();
  try {
    const creatorId = 'creator-alice';
    const authorId = 'author-bob';
    const viewerId = 'viewer-charlie';

    await seedProfile(db, creatorId, 'AliceCreator', 'https://avatar.test/alice.png');
    await seedProfile(db, authorId, 'BobRanker', 'https://avatar.test/bob.png');
    await seedProfile(db, viewerId, 'CharlieViewer', 'https://avatar.test/charlie.png');

    const templateId = 'tpl-alice-100';
    const templateTiers = [
      { id: 's', label: 'S', color: '#f87171' },
      { id: 'a', label: 'A', color: '#fdba74' },
    ];

    // Alice creates the template
    await db.prepare(
      'INSERT INTO templates (id, creator_id, title, description, hashtags, tiers) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(
      templateId,
      creatorId,
      'Alice Original Masterpiece',
      'Description by Alice',
      '#featured,#audit',
      JSON.stringify(templateTiers)
    ).run();

    await db.prepare(
      'INSERT INTO template_items (id, template_id, item_id, position, tier) VALUES (?, ?, ?, 0, ?)'
    ).bind('ti-item-1', templateId, 'item-1', 'S').run();

    // Bob creates a ranking referencing Alice's template (ranking author != template creator)
    const rankingId = 'ranking-bob-999';
    await db.prepare(
      'INSERT INTO rankings (id, title, description, hashtags, user_id, template_id) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(
      rankingId,
      'Bob Rankings of Alice Template',
      'Ranking by Bob',
      '#featured,#audit',
      authorId,
      templateId
    ).run();

    // Charlie bookmarks Alice's template
    await db.prepare(
      'INSERT INTO template_bookmarks (template_id, user_id) VALUES (?, ?)'
    ).bind(templateId, viewerId).run();

    // Helper to verify creator profile on a card
    function verifyTemplateCreator(card, pathName) {
      assert.ok(card, `Card must be present in ${pathName}`);
      assert.equal(
        card.profile.id,
        creatorId,
        `[${pathName}] TemplateCard creator id must be template.creator_id (${creatorId}), but was ${card.profile.id}`
      );
      assert.equal(
        card.profile.username,
        'AliceCreator',
        `[${pathName}] TemplateCard username must be template creator username`
      );
      assert.equal(
        card.profile.avatar_url,
        'https://avatar.test/alice.png',
        `[${pathName}] TemplateCard avatar must be template creator avatar`
      );
      assert.notEqual(
        card.profile.id,
        authorId,
        `[${pathName}] TemplateCard creator must NEVER be ranking author (${authorId})`
      );
      assert.notEqual(
        card.profile.username,
        'BobRanker',
        `[${pathName}] TemplateCard username must NEVER be ranking author username`
      );
    }

    // Path 1: Discover list (default / no filter)
    {
      const res = await templatesGet({
        request: new Request('https://local.test/api/templates?limit=50'),
        env: { tear_of_god_db: db },
        data: { user: { id: viewerId } },
      });
      assert.equal(res.status, 200);
      const json = await res.json();
      const card = json.data.find((t) => t.id === templateId);
      verifyTemplateCreator(card, 'Discover (/api/templates)');
    }

    // Path 2: Hashtag Detail path (?hashtag=audit)
    {
      const res = await templatesGet({
        request: new Request('https://local.test/api/templates?hashtag=audit'),
        env: { tear_of_god_db: db },
        data: { user: { id: viewerId } },
      });
      assert.equal(res.status, 200);
      const json = await res.json();
      const card = json.data.find((t) => t.id === templateId);
      verifyTemplateCreator(card, 'Hashtag Detail (/api/templates?hashtag=audit)');
    }

    // Path 3: Popular Templates path (?sort=popular)
    {
      const res = await templatesGet({
        request: new Request('https://local.test/api/templates?sort=popular'),
        env: { tear_of_god_db: db },
        data: { user: { id: viewerId } },
      });
      assert.equal(res.status, 200);
      const json = await res.json();
      const card = json.data.find((t) => t.id === templateId);
      verifyTemplateCreator(card, 'Popular Templates (/api/templates?sort=popular)');
    }

    // Path 4: Saved Templates path (?saved=true)
    {
      const res = await templatesGet({
        request: new Request('https://local.test/api/templates?saved=true'),
        env: { tear_of_god_db: db },
        data: { user: { id: viewerId } },
      });
      assert.equal(res.status, 200);
      const json = await res.json();
      const card = json.data.find((t) => t.id === templateId);
      verifyTemplateCreator(card, 'Saved Templates (/api/templates?saved=true)');
      assert.equal(card.is_saved, true);
    }

    // Extra Path: Template Detail path (?id=...)
    {
      const res = await templatesGet({
        request: new Request(`https://local.test/api/templates?id=${templateId}`),
        env: { tear_of_god_db: db },
        data: { user: { id: viewerId } },
      });
      assert.equal(res.status, 200);
      const json = await res.json();
      const card = json.data;
      verifyTemplateCreator(card, 'Template Detail (/api/templates?id=...)');
    }

    console.log('ok - template creator is strictly templates.creator_id across Discover, Hashtag, Popular, and Saved API paths');
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

// Template with tiers defined but items having tier: null -> must show real tier labels
await testTemplateWithTiersAndNullItemTiers();

// Creator on TemplateCard must always be templates.creator_id -> profiles across all 4 paths
await testTemplateCreatorIntegrityAcrossApiPaths();

console.log('All Template Discover preview and creator checks passed against local Miniflare D1.');