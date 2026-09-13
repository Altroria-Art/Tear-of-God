import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

import { onRequest as adminDashboard } from '../../functions/api/admin/index.js';
import { onRequest as apiMiddleware } from '../../functions/api/_middleware.js';
import { digest } from '../../functions/lib/session.js';

const schema = await readFile(new URL('../../schema.sql', import.meta.url), 'utf8');
const schemaStatements = schema
  .split(/\r?\n/)
  .filter((line) => !line.trimStart().startsWith('--'))
  .join('\n')
  .split(';')
  .map((statement) => statement.trim())
  .filter(Boolean);

const legacyCountQueries = [
  'SELECT COUNT(*) as n FROM profiles',
  'SELECT COUNT(*) as n FROM rankings',
  'SELECT COUNT(*) as n FROM templates',
  'SELECT COUNT(*) as n FROM votes',
  'SELECT COUNT(*) as n FROM comments',
  'SELECT COUNT(*) as n FROM follows',
  "SELECT COUNT(*) as n FROM reports WHERE status = 'pending'",
];

const combinedCountQuery = `
  SELECT
    (SELECT COUNT(*) FROM profiles) AS users,
    (SELECT COUNT(*) FROM rankings) AS rankings,
    (SELECT COUNT(*) FROM templates) AS templates,
    (SELECT COUNT(*) FROM votes) AS votes,
    (SELECT COUNT(*) FROM comments) AS comments,
    (SELECT COUNT(*) FROM follows) AS follows,
    (SELECT COUNT(*) FROM reports WHERE status = 'pending') AS pending_reports
`;

const recentPostsQuery = `
  SELECT r.id, r.title, r.category, r.created_at,
         p.id as author_id, p.username as author_name, p.avatar_url as author_avatar
  FROM rankings r
  LEFT JOIN profiles p ON r.user_id = p.id
  ORDER BY r.created_at DESC, r.id DESC
  LIMIT 5
`;

const recentReportsQuery = `
  SELECT rp.id, rp.reason, rp.status, rp.created_at,
         rp.ranking_id, rp.template_id,
         rk.title AS ranking_title, t.title AS template_title,
         p.id AS reporter_id, p.username AS reporter_name
  FROM reports rp
  LEFT JOIN rankings rk ON rp.ranking_id = rk.id
  LEFT JOIN templates t ON rp.template_id = t.id
  LEFT JOIN profiles p ON rp.reporter_id = p.id
  WHERE rp.status = 'pending'
  ORDER BY rp.created_at DESC, rp.id DESC
  LIMIT 5
`;

const topCategoriesQuery = `
  SELECT category, COUNT(*) as count
  FROM rankings
  WHERE category IS NOT NULL AND category != ''
  GROUP BY category
  ORDER BY count DESC
`;

const topTemplatesQuery = `
  SELECT t.id, t.title, t.category,
         (SELECT COUNT(*) FROM rankings r WHERE r.template_id = t.id) AS live_uses,
         (SELECT COUNT(*) FROM template_views v WHERE v.template_id = t.id) AS live_views,
         p.username as author_name
  FROM templates t
  LEFT JOIN profiles p ON t.creator_id = p.id
  ORDER BY live_uses DESC, live_views DESC, t.id DESC
  LIMIT 4
`;

const detailQueries = [recentPostsQuery, recentReportsQuery, topCategoriesQuery, topTemplatesQuery];

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

function timestamp(index) {
  return new Date(Date.UTC(2026, 0, 1, 0, 0, index))
    .toISOString()
    .replace('T', ' ')
    .replace('.000Z', '');
}

async function insertJson(db, sql, rows) {
  if (rows.length === 0) return;
  await db.prepare(sql).bind(JSON.stringify(rows)).run();
}

async function seedAdmin(db) {
  await db.prepare(`
    INSERT INTO profiles (id, username, email, role, avatar_url)
    VALUES ('admin', 'Admin', 'admin@example.test', 'admin', 'https://images.local/admin')
  `).run();
}

async function seedLargeDataset(db) {
  const profiles = Array.from({ length: 120 }, (_, index) => ({
    id: `user-${index}`,
    username: `User ${index}`,
    email: `user-${index}@example.test`,
  }));
  const templates = Array.from({ length: 30 }, (_, index) => ({
    id: `template-${index}`,
    creator_id: index % 2 === 0 ? 'admin' : profiles[index].id,
    title: `Template ${index}`,
    category: `category-${index % 5}`,
    created_at: timestamp(index),
  }));
  const rankings = Array.from({ length: 240 }, (_, index) => ({
    id: `ranking-${index}`,
    title: `Ranking ${index}`,
    user_id: profiles[index % profiles.length].id,
    template_id: templates[index % templates.length].id,
    category: index % 11 === 0 ? null : `category-${index % 5}`,
    created_at: timestamp(1000 + index),
  }));
  const votes = rankings.map((ranking, index) => ({
    id: `vote-${index}`,
    ranking_id: ranking.id,
    user_id: profiles[(index + 1) % profiles.length].id,
  }));
  const comments = rankings.slice(0, 180).map((ranking, index) => ({
    id: `comment-${index}`,
    ranking_id: ranking.id,
    user_id: profiles[index % profiles.length].id,
  }));
  const follows = profiles.map((profile, index) => ({
    follower_id: profile.id,
    following_id: profiles[(index + 1) % profiles.length].id,
  }));
  const reports = rankings.slice(0, 50).map((ranking, index) => ({
    id: `report-${index}`,
    ranking_id: ranking.id,
    reporter_id: profiles[index % profiles.length].id,
    reason: `Synthetic reason ${index}`,
    status: index % 3 === 0 ? 'resolved' : 'pending',
    created_at: timestamp(2000 + index),
  }));
  const views = Array.from({ length: 90 }, (_, index) => ({
    template_id: templates[index % templates.length].id,
    user_id: profiles[index % profiles.length].id,
  }));

  await insertJson(db, `
    INSERT INTO profiles (id, username, email)
    SELECT json_extract(value, '$.id'), json_extract(value, '$.username'), json_extract(value, '$.email')
    FROM json_each(?1)
  `, profiles);
  await insertJson(db, `
    INSERT INTO templates (id, creator_id, title, category, created_at)
    SELECT json_extract(value, '$.id'), json_extract(value, '$.creator_id'),
           json_extract(value, '$.title'), json_extract(value, '$.category'), json_extract(value, '$.created_at')
    FROM json_each(?1)
  `, templates);
  await insertJson(db, `
    INSERT INTO rankings (id, title, user_id, template_id, category, created_at)
    SELECT json_extract(value, '$.id'), json_extract(value, '$.title'),
           json_extract(value, '$.user_id'), json_extract(value, '$.template_id'),
           json_extract(value, '$.category'), json_extract(value, '$.created_at')
    FROM json_each(?1)
  `, rankings);
  await insertJson(db, `
    INSERT INTO votes (id, ranking_id, user_id, vote_type)
    SELECT json_extract(value, '$.id'), json_extract(value, '$.ranking_id'),
           json_extract(value, '$.user_id'), 'like'
    FROM json_each(?1)
  `, votes);
  await insertJson(db, `
    INSERT INTO comments (id, ranking_id, user_id, content)
    SELECT json_extract(value, '$.id'), json_extract(value, '$.ranking_id'),
           json_extract(value, '$.user_id'), 'Synthetic comment'
    FROM json_each(?1)
  `, comments);
  await insertJson(db, `
    INSERT INTO follows (follower_id, following_id)
    SELECT json_extract(value, '$.follower_id'), json_extract(value, '$.following_id')
    FROM json_each(?1)
  `, follows);
  await insertJson(db, `
    INSERT INTO reports (id, ranking_id, reporter_id, reason, status, created_at)
    SELECT json_extract(value, '$.id'), json_extract(value, '$.ranking_id'),
           json_extract(value, '$.reporter_id'), json_extract(value, '$.reason'),
           json_extract(value, '$.status'), json_extract(value, '$.created_at')
    FROM json_each(?1)
  `, reports);
  await insertJson(db, `
    INSERT INTO template_views (template_id, user_id)
    SELECT json_extract(value, '$.template_id'), json_extract(value, '$.user_id')
    FROM json_each(?1)
  `, views);
}

function instrumentDb(db) {
  const metrics = { statements: 0, sql: [] };

  function wrap(statement, sql) {
    return {
      bind(...parameters) {
        return wrap(statement.bind(...parameters), sql);
      },
      async first(column) {
        metrics.statements += 1;
        metrics.sql.push(sql);
        return statement.first(column);
      },
      async all() {
        metrics.statements += 1;
        metrics.sql.push(sql);
        return statement.all();
      },
      async run() {
        metrics.statements += 1;
        metrics.sql.push(sql);
        return statement.run();
      },
    };
  }

  return {
    metrics,
    binding: {
      prepare(sql) {
        return wrap(db.prepare(sql), sql);
      },
      batch(statements) {
        return db.batch(statements);
      },
    },
  };
}

async function legacyStats(db) {
  const [
    users, rankings, templates, votes, comments, follows, pendingReports,
    recentPostsRows, recentReportsRows, topCategoriesRows, topTemplatesRows,
  ] = await Promise.all([
    ...legacyCountQueries.map((sql) => db.prepare(sql).first()),
    ...detailQueries.map((sql) => db.prepare(sql).all()),
  ]);

  return {
    users: users?.n || 0,
    rankings: rankings?.n || 0,
    templates: templates?.n || 0,
    votes: votes?.n || 0,
    comments: comments?.n || 0,
    follows: follows?.n || 0,
    pending_reports: pendingReports?.n || 0,
    recent_posts: (recentPostsRows?.results || []).map((row) => ({
      id: row.id,
      title: row.title,
      category: row.category,
      created_at: row.created_at,
      author: { id: row.author_id, username: row.author_name, avatar_url: row.author_avatar },
    })),
    recent_reports: (recentReportsRows?.results || []).map((row) => ({
      id: row.id,
      kind: row.ranking_id ? 'post' : 'template',
      title: row.ranking_id ? row.ranking_title : row.template_title,
      target_id: row.ranking_id || row.template_id,
      reason: row.reason,
      status: row.status,
      created_at: row.created_at,
      reporter: { id: row.reporter_id, username: row.reporter_name },
    })),
    top_categories: (topCategoriesRows?.results || []).map((row) => ({
      category: row.category,
      count: row.count,
    })),
    top_templates: (topTemplatesRows?.results || []).map((row) => ({
      id: row.id,
      title: row.title,
      category: row.category,
      uses: row.live_uses ?? 0,
      views: row.live_views ?? 0,
      author: row.author_name,
    })),
  };
}

async function fetchDashboard(db, userId = 'admin') {
  const response = await adminDashboard({
    request: new Request('https://local.test/api/admin?action=stats'),
    env: { tear_of_god_db: db },
    data: { user: { id: userId } },
  });
  return { response, body: await response.json() };
}

async function rowsRead(db, queries) {
  let total = 0;
  for (const sql of queries) {
    const result = await db.prepare(sql).all();
    total += result.meta?.rows_read || 0;
  }
  return total;
}

async function verifyDataset({ large }) {
  const { mf, db } = await createLocalD1();
  try {
    await seedAdmin(db);
    if (large) await seedLargeDataset(db);

    const expected = await legacyStats(db);
    const instrumented = instrumentDb(db);
    const { response, body } = await fetchDashboard(instrumented.binding);

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.deepEqual(body.data, expected);
    assert.deepEqual(Object.keys(body.data), [
      'users', 'rankings', 'templates', 'votes', 'comments', 'follows', 'pending_reports',
      'recent_posts', 'recent_reports', 'top_categories', 'top_templates',
    ]);
    assert.equal(instrumented.metrics.statements, 6, 'handler must retain role check and use five dashboard statements');
    assert.equal(instrumented.metrics.sql.filter((sql) => sql.includes('SELECT role FROM profiles')).length, 1);
    assert.equal(instrumented.metrics.sql.filter((sql) => sql.includes('(SELECT COUNT(*) FROM profiles)')).length, 1);

    const oldRowsRead = await rowsRead(db, [...legacyCountQueries, ...detailQueries]);
    const newRowsRead = await rowsRead(db, [combinedCountQuery, ...detailQueries]);
    assert.ok(newRowsRead <= oldRowsRead, `combined query rows_read increased: ${oldRowsRead} -> ${newRowsRead}`);

    return {
      oldStatements: 11,
      newStatements: 5,
      oldRowsRead,
      newRowsRead,
      responseBytes: Buffer.byteLength(JSON.stringify(body)),
    };
  } finally {
    await mf.dispose();
  }
}

const emptyMetrics = await verifyDataset({ large: false });
const largeMetrics = await verifyDataset({ large: true });

{
  const { mf, db } = await createLocalD1();
  try {
    await seedAdmin(db);
    await db.prepare("INSERT INTO profiles (id, username, email, role) VALUES ('member', 'Member', 'member@example.test', 'user')").run();
    const instrumented = instrumentDb(db);
    const { response } = await fetchDashboard(instrumented.binding, 'member');
    assert.equal(response.status, 403);
    assert.equal(instrumented.metrics.statements, 1, 'non-admin request must stop after role verification');
  } finally {
    await mf.dispose();
  }
}

{
  let nextCalls = 0;
  const response = await apiMiddleware({
    request: new Request('https://local.test/api/admin?action=stats'),
    env: { tear_of_god_db: { prepare() { throw new Error('No session query expected without a cookie'); } } },
    data: {},
    next: () => { nextCalls += 1; },
  });
  assert.equal(response.status, 401);
  assert.equal(nextCalls, 0);
}

{
  const { mf, db } = await createLocalD1();
  try {
    await seedAdmin(db);
    const token = 'a'.repeat(64);
    await db.prepare('INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
      .bind(await digest(token), 'admin', Date.now() + 60_000)
      .run();
    const instrumented = instrumentDb(db);
    const request = new Request('https://local.test/api/admin?action=stats', {
      headers: { Cookie: `tog_session=${token}` },
    });
    const data = {};
    const response = await apiMiddleware({
      request,
      env: { tear_of_god_db: instrumented.binding },
      data,
      next: () => adminDashboard({ request, env: { tear_of_god_db: instrumented.binding }, data }),
    });
    assert.equal(response.status, 200);
    assert.equal(instrumented.metrics.statements, 7, 'full request must keep session and role checks plus five dashboard statements');
  } finally {
    await mf.dispose();
  }
}

console.log('Admin dashboard query optimization checks passed.');
console.log(JSON.stringify({ empty: emptyMetrics, large: largeMetrics }, null, 2));
