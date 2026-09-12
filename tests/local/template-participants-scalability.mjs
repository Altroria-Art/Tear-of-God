import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

import { onRequestGet as templateParticipants } from '../../functions/api/template-participants.js';

const schema = await readFile(new URL('../../schema.sql', import.meta.url), 'utf8');
const schemaStatements = schema
  .split(/\r?\n/)
  .filter((line) => !line.trimStart().startsWith('--'))
  .join('\n')
  .split(';')
  .map((statement) => statement.trim())
  .filter(Boolean);

const tiers = [
  { id: 's', label: 'S', color: '#f87171' },
  { id: 'a', label: 'A', color: '#fdba74' },
  { id: 'b', label: 'B', color: '#fcd34d' },
];

const profiles = [
  { id: 'user-0', username: 'alice', faculty: 'Engineering', major: 'Software Engineering', year: '2567' },
  { id: 'user-1', username: 'bob', faculty: 'Engineering', major: 'Civil Engineering', year: '2568' },
  { id: 'user-2', username: 'carol', faculty: 'Science', major: 'Computer Science', year: '2567' },
  { id: 'user-3', username: 'dave', faculty: 'Science', major: 'Mathematics', year: '2568' },
];

const catalogItems = [
  { id: 'item-a', name: 'Alpha' },
  { id: 'item-b', name: 'Beta' },
  { id: 'item-c', name: 'Gamma' },
];

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

async function insertJsonRows(db, sql, rows, ...parameters) {
  if (rows.length === 0) return;
  await db.prepare(sql).bind(JSON.stringify(rows), ...parameters).run();
}

function dbTimestamp(index) {
  return new Date(Date.UTC(2026, 0, 1, 0, 0, index))
    .toISOString()
    .replace('T', ' ')
    .replace('.000Z', '');
}

async function seedDataset(db, rankingCount) {
  const templateId = `template-${rankingCount}`;
  await insertJsonRows(db, `
    INSERT INTO profiles (id, username, email, avatar_url, faculty, major, year)
    SELECT
      json_extract(value, '$.id'),
      json_extract(value, '$.username'),
      json_extract(value, '$.id') || '@local.test',
      'https://images.local/' || json_extract(value, '$.id'),
      json_extract(value, '$.faculty'),
      json_extract(value, '$.major'),
      json_extract(value, '$.year')
    FROM json_each(?1)
  `, profiles);
  await insertJsonRows(db, `
    INSERT INTO items (id, name)
    SELECT json_extract(value, '$.id'), json_extract(value, '$.name')
    FROM json_each(?1)
  `, catalogItems);
  await db.prepare(`
    INSERT INTO templates (id, creator_id, title, tiers)
    VALUES (?1, ?2, ?3, ?4)
  `).bind(templateId, profiles[0].id, `Template ${rankingCount}`, JSON.stringify(tiers)).run();

  const rankings = Array.from({ length: rankingCount }, (_, index) => ({
    id: `ranking-${String(index).padStart(4, '0')}`,
    title: `Ranking ${index}`,
    user_id: profiles[index % profiles.length].id,
    created_at: dbTimestamp(index),
  }));
  await insertJsonRows(db, `
    INSERT INTO rankings (id, title, user_id, template_id, created_at)
    SELECT
      json_extract(value, '$.id'),
      json_extract(value, '$.title'),
      json_extract(value, '$.user_id'),
      ?2,
      json_extract(value, '$.created_at')
    FROM json_each(?1)
  `, rankings, templateId);

  const rankingItems = rankings.flatMap((ranking, rankingIndex) => catalogItems.map((item, itemIndex) => ({
    id: `${ranking.id}-${item.id}`,
    ranking_id: ranking.id,
    item_id: item.id,
    tier: tiers[(rankingIndex + itemIndex) % tiers.length].label,
    position: itemIndex,
  })));
  await insertJsonRows(db, `
    INSERT INTO ranking_items (id, ranking_id, item_id, tier, position)
    SELECT
      json_extract(value, '$.id'),
      json_extract(value, '$.ranking_id'),
      json_extract(value, '$.item_id'),
      json_extract(value, '$.tier'),
      CAST(json_extract(value, '$.position') AS INTEGER)
    FROM json_each(?1)
  `, rankingItems);

  return templateId;
}

function instrumentDb(db) {
  const metrics = {
    queries: 0,
    rowsReturned: 0,
    rowsRead: 0,
    maxBoundParameters: 0,
  };

  return {
    metrics,
    binding: {
      prepare(sql) {
        const prepared = db.prepare(sql);
        return {
          bind(...parameters) {
            metrics.maxBoundParameters = Math.max(metrics.maxBoundParameters, parameters.length);
            const bound = prepared.bind(...parameters);
            return {
              async all() {
                metrics.queries += 1;
                const result = await bound.all();
                metrics.rowsReturned += result.results?.length || 0;
                metrics.rowsRead += result.meta?.rows_read || 0;
                return result;
              },
            };
          },
        };
      },
    },
  };
}

async function fetchCurrent(db, templateId) {
  const instrumented = instrumentDb(db);
  const startedAt = performance.now();
  const response = await templateParticipants({
    request: new Request(`https://local.test/api/template-participants?template_id=${templateId}`),
    env: { tear_of_god_db: instrumented.binding },
  });
  const body = await response.json();
  return {
    status: response.status,
    body,
    durationMs: performance.now() - startedAt,
    responseBytes: Buffer.byteLength(JSON.stringify(body)),
    metrics: instrumented.metrics,
  };
}

async function fetchLegacy(db, templateId) {
  const instrumented = instrumentDb(db);
  const startedAt = performance.now();
  const { results: tplRows } = await instrumented.binding.prepare(
    'SELECT tiers FROM templates WHERE id = ?'
  ).bind(templateId).all();
  const tiersDef = tplRows[0]?.tiers ? JSON.parse(tplRows[0].tiers) : [];
  const { results: rankings } = await instrumented.binding.prepare(`
    SELECT
      r.id as ranking_id,
      r.user_id,
      r.created_at,
      p.username,
      p.avatar_url,
      p.faculty,
      p.major,
      p.year
    FROM rankings r
    LEFT JOIN profiles p ON r.user_id = p.id
    WHERE r.template_id = ?
    ORDER BY r.created_at DESC
  `).bind(templateId).all();

  if (rankings.length === 0) {
    const body = { success: true, data: [], total: 0 };
    return {
      status: 200,
      body,
      durationMs: performance.now() - startedAt,
      responseBytes: Buffer.byteLength(JSON.stringify(body)),
      metrics: instrumented.metrics,
    };
  }

  const rankingIds = rankings.map((ranking) => ranking.ranking_id);
  const placeholders = rankingIds.map(() => '?').join(',');
  const { results: items } = await instrumented.binding.prepare(`
    SELECT
      ri.ranking_id,
      ri.item_id,
      ri.tier,
      ri.position,
      i.name as item_name
    FROM ranking_items ri
    LEFT JOIN items i ON ri.item_id = i.id
    WHERE ri.ranking_id IN (${placeholders})
    ORDER BY ri.ranking_id, ri.position ASC
  `).bind(...rankingIds).all();

  const itemsByRanking = {};
  items.forEach((item) => {
    if (!itemsByRanking[item.ranking_id]) itemsByRanking[item.ranking_id] = [];
    itemsByRanking[item.ranking_id].push({
      item_id: item.item_id,
      item_name: item.item_name || item.item_id,
      tier: item.tier,
      position: item.position,
    });
  });
  const data = rankings.map((ranking) => ({
    ranking_id: ranking.ranking_id,
    user_id: ranking.user_id,
    username: ranking.username || 'Unknown',
    avatar_url: ranking.avatar_url,
    faculty: ranking.faculty || null,
    major: ranking.major || null,
    year: ranking.year || null,
    created_at: ranking.created_at,
    ranking_items: itemsByRanking[ranking.ranking_id] || [],
    tiers: tiersDef,
  }));
  const body = { success: true, data, total: data.length };
  return {
    status: 200,
    body,
    durationMs: performance.now() - startedAt,
    responseBytes: Buffer.byteLength(JSON.stringify(body)),
    metrics: instrumented.metrics,
  };
}

function filterParticipants(participants, { faculty, major, year }) {
  return participants.filter((participant) => {
    if (faculty && participant.faculty !== faculty) return false;
    if (major && participant.major !== major) return false;
    if (year && participant.year !== year) return false;
    return true;
  });
}

function calculateAverage(participants, tiersDef) {
  const tierIndexByLabel = Object.fromEntries(tiersDef.map((tier, index) => [tier.label, index]));
  const itemData = {};
  participants.forEach((ranking) => {
    ranking.ranking_items.forEach((item) => {
      if (!item.tier) return;
      const tierIndex = tierIndexByLabel[item.tier];
      if (tierIndex === undefined) return;
      const name = item.item_name || item.item_id;
      if (!itemData[name]) itemData[name] = { sum: 0, count: 0 };
      itemData[name].sum += tiersDef.length - tierIndex;
      itemData[name].count += 1;
    });
  });
  return Object.fromEntries(Object.entries(itemData).map(([name, value]) => [name, {
    average: Math.round((value.sum / value.count) * 100) / 100,
    votes: value.count,
  }]));
}

function assertCurrentResult(result, rankingCount) {
  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
  assert.equal(result.body.total, rankingCount);
  assert.equal(result.body.data.length, rankingCount);
  assert.equal(result.metrics.queries, rankingCount === 0 ? 2 : 3);
  assert.equal(result.metrics.maxBoundParameters, 1);
  if (rankingCount > 0) {
    assert.equal(result.body.data[0].ranking_id, `ranking-${String(rankingCount - 1).padStart(4, '0')}`);
    result.body.data.forEach((ranking) => assert.equal(ranking.ranking_items.length, catalogItems.length));
  }
}

function logMetrics(label, result) {
  const approximateRows = result.metrics.rowsRead || result.metrics.rowsReturned;
  console.log(
    `${label}: queries=${result.metrics.queries}, maxParams=${result.metrics.maxBoundParameters}, ` +
    `rows~=${approximateRows}, response=${result.responseBytes} bytes, time=${result.durationMs.toFixed(2)}ms`
  );
}

for (const rankingCount of [0, 1, 100, 101, 500]) {
  const { mf, db } = await createLocalD1();
  try {
    const templateId = await seedDataset(db, rankingCount);
    const current = await fetchCurrent(db, templateId);
    assertCurrentResult(current, rankingCount);
    logMetrics(`${rankingCount} rankings`, current);

    if (rankingCount === 100) {
      const legacy = await fetchLegacy(db, templateId);
      assert.deepEqual(current.body, legacy.body);
      assert.equal(current.responseBytes, legacy.responseBytes);
      assert.equal(legacy.metrics.maxBoundParameters, 100);
      logMetrics('100 rankings legacy', legacy);

      const filters = [
        { faculty: 'Engineering' },
        { major: 'Software Engineering' },
        { year: '2567' },
        { faculty: 'Engineering', major: 'Software Engineering', year: '2567' },
      ];
      for (const filter of filters) {
        const currentFiltered = filterParticipants(current.body.data, filter);
        const legacyFiltered = filterParticipants(legacy.body.data, filter);
        assert.deepEqual(currentFiltered, legacyFiltered);
        assert.deepEqual(
          calculateAverage(currentFiltered, tiers),
          calculateAverage(legacyFiltered, tiers),
        );
      }
      assert.deepEqual(calculateAverage(current.body.data, tiers), calculateAverage(legacy.body.data, tiers));
    }

    if (rankingCount > 100) {
      await assert.rejects(
        () => fetchLegacy(db, templateId),
        /too many SQL variables|SQLITE_ERROR|D1_/i,
      );
      console.log(`${rankingCount} rankings legacy: rejected because the query exceeds 100 bound parameters`);
    }

    if (rankingCount > profiles.length) {
      assert.equal(new Set(current.body.data.map((ranking) => ranking.user_id)).size, profiles.length);
    }
  } finally {
    await mf.dispose();
  }
}

console.log('Template participants scalability and compatibility checks passed against local Miniflare D1.');
