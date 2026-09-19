import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

import { onRequest as apiMiddleware } from '../../functions/api/_middleware.js';
import { onRequest as commentsEndpoint } from '../../functions/api/comments.js';
import { onRequest as reportEndpoint } from '../../functions/api/report.js';
import { onRequest as templateCommentsEndpoint } from '../../functions/api/template-comments.js';
import { onRequest as uploadEndpoint } from '../../functions/api/upload.js';
import { digest } from '../../functions/lib/session.js';

const schema = await readFile(new URL('../../schema.sql', import.meta.url), 'utf8');
const schemaStatements = schema
  .split(/\r?\n/)
  .filter((line) => !line.trimStart().startsWith('--'))
  .join('\n')
  .split(';')
  .map((statement) => statement.trim())
  .filter(Boolean);

const verifiedUserId = 'quickwin3-user';
const ownerUserId = 'quickwin3-owner';
const fakeClientUserId = 'client-supplied-fake-user';
const templateId = 'quickwin3-template';
const rankingId = 'quickwin3-ranking';
const validToken = 'a'.repeat(64);

function trackDatabase(db) {
  const preparedSql = [];
  return {
    preparedSql,
    database: {
      prepare(sql) {
        preparedSql.push(sql.replace(/\s+/g, ' ').trim());
        return db.prepare(sql);
      },
      batch(statements) {
        return db.batch(statements);
      },
    },
  };
}

async function callThroughMiddleware(db, endpoint, { path, body, token = validToken, formData, storage } = {}) {
  const tracked = trackDatabase(db);
  const headers = {};
  if (token) headers.Cookie = `tog_session=${token}`;
  let requestBody;
  if (formData) {
    requestBody = formData;
  } else {
    headers['Content-Type'] = 'application/json';
    requestBody = JSON.stringify(body);
  }
  const request = new Request(`http://localhost:8788${path}`, {
    method: 'POST',
    headers,
    body: requestBody,
  });
  const env = {
    APP_ENV: 'local',
    PREVIEW_UPLOADS_ENABLED: 'true',
    tear_of_god_db: tracked.database,
    STORAGE: storage,
    R2_PUBLIC_URL: 'https://preview-r2.example.test',
  };
  const context = {
    request,
    env,
    data: {},
    next: () => endpoint({ request, env, data: context.data }),
  };
  const response = await apiMiddleware(context);
  return { response, body: await response.json(), preparedSql: tracked.preparedSql };
}

// The exact statement total is intentionally NOT pinned: best-effort fan-out
// (trending notifications, digests) legitimately adds statements after the core
// write. What matters: session is resolved first from the cookie (never from a
// client-supplied id), the profile is not re-looked-up, the core write is
// present, and the stored row is attributed to the verified session user.
function assertVerifiedSessionMutation(result, { label, corePatterns, maxStatements }) {
  assert.equal(result.response.status >= 200 && result.response.status < 300, true);
  assert.match(
    result.preparedSql[0],
    /FROM auth_sessions s JOIN profiles p/i,
    `${label}: first statement must be the session lookup`,
  );
  assert.equal(
    result.preparedSql.some((sql) => /^SELECT id FROM profiles WHERE id = \?$/i.test(sql)),
    false,
    `${label}: handler must not repeat the profile existence lookup`,
  );
  for (const pattern of corePatterns) {
    assert.ok(
      result.preparedSql.some((sql) => pattern.test(sql)),
      `${label}: missing core statement matching ${pattern}`,
    );
  }
  assert.ok(
    result.preparedSql.length <= maxStatements,
    `${label}: ${result.preparedSql.length} statements exceeds budget ${maxStatements}`,
  );
}

const mf = new Miniflare(convertV4MiniflareOptions({
  modules: true,
  script: 'export default { fetch() { return new Response("quick win 3 test"); } }',
  compatibilityDate: '2026-01-01',
  d1Databases: ['DB'],
}));
const db = await mf.getD1Database('DB');

try {
  await db.batch(schemaStatements.map((statement) => db.prepare(statement)));
  await db.batch([
    db.prepare('INSERT INTO profiles (id, username, email) VALUES (?, ?, ?)').bind(verifiedUserId, 'Verified User', 'verified@example.test'),
    db.prepare('INSERT INTO profiles (id, username, email) VALUES (?, ?, ?)').bind(ownerUserId, 'Content Owner', 'owner@example.test'),
    db.prepare('INSERT INTO templates (id, creator_id, title, tiers) VALUES (?, ?, ?, ?)').bind(templateId, ownerUserId, 'Synthetic Template', '[]'),
    db.prepare('INSERT INTO rankings (id, title, user_id, template_id) VALUES (?, ?, ?, ?)').bind(rankingId, 'Synthetic Ranking', ownerUserId, templateId),
    db.prepare('INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
      .bind(await digest(validToken), verifiedUserId, Date.now() + 60_000),
  ]);

  const comment = await callThroughMiddleware(db, commentsEndpoint, {
    path: '/api/comments',
    body: { ranking_id: rankingId, user_id: fakeClientUserId, content: 'Verified session comment' },
  });
  assertVerifiedSessionMutation(comment, {
    label: 'POST /api/comments',
    corePatterns: [/INSERT INTO comments/i, /UPDATE rankings SET comments_count/i],
    maxStatements: 8,
  });
  assert.equal(comment.response.status, 201);
  assert.equal(comment.body.data.user_id, verifiedUserId);
  const storedComment = await db.prepare('SELECT user_id FROM comments WHERE id = ?').bind(comment.body.data.id).first();
  assert.equal(storedComment.user_id, verifiedUserId);

  const templateComment = await callThroughMiddleware(db, templateCommentsEndpoint, {
    path: '/api/template-comments',
    body: { template_id: templateId, user_id: fakeClientUserId, content: 'Verified session template comment' },
  });
  assertVerifiedSessionMutation(templateComment, {
    label: 'POST /api/template-comments',
    corePatterns: [/INSERT INTO template_comments/i],
    maxStatements: 6,
  });
  assert.equal(templateComment.response.status, 201);
  assert.equal(templateComment.body.data.user_id, verifiedUserId);

  const report = await callThroughMiddleware(db, reportEndpoint, {
    path: '/api/report',
    body: { ranking_id: rankingId, reporter_id: fakeClientUserId, reason: 'Synthetic report reason' },
  });
  assertVerifiedSessionMutation(report, {
    label: 'POST /api/report',
    corePatterns: [/INSERT INTO reports/i],
    maxStatements: 6,
  });
  assert.equal(report.response.status, 201);
  const storedReport = await db.prepare('SELECT reporter_id FROM reports WHERE id = ?').bind(report.body.data.id).first();
  assert.equal(storedReport.reporter_id, verifiedUserId);

  let storageWrites = 0;
  const formData = new FormData();
  formData.append('user_id', fakeClientUserId);
  formData.append('file', new File([
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  ], 'synthetic.png', { type: 'image/png' }));
  const upload = await callThroughMiddleware(db, uploadEndpoint, {
    path: '/api/upload',
    formData,
    storage: {
      async put() {
        storageWrites += 1;
      },
    },
  });
  assertVerifiedSessionMutation(upload, {
    label: 'POST /api/upload',
    corePatterns: [],
    maxStatements: 2,
  });
  assert.equal(upload.response.status, 200);
  assert.equal(storageWrites, 1);

  const unauthenticated = await callThroughMiddleware(db, commentsEndpoint, {
    path: '/api/comments',
    token: null,
    body: { ranking_id: rankingId, user_id: verifiedUserId, content: 'Must not be accepted' },
  });
  assert.equal(unauthenticated.response.status, 401);
  assert.equal(unauthenticated.preparedSql.length, 0);

  const invalidSession = await callThroughMiddleware(db, commentsEndpoint, {
    path: '/api/comments',
    token: 'b'.repeat(64),
    body: { ranking_id: rankingId, user_id: verifiedUserId, content: 'Must not be accepted' },
  });
  assert.equal(invalidSession.response.status, 401);
  assert.equal(invalidSession.preparedSql.length, 1);

  const deletedToken = 'c'.repeat(64);
  await db.batch([
    db.prepare('INSERT INTO profiles (id, username, email) VALUES (?, ?, ?)').bind('quickwin3-deleted', 'Deleted User', 'deleted@example.test'),
    db.prepare('INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
      .bind(await digest(deletedToken), 'quickwin3-deleted', Date.now() + 60_000),
  ]);
  await db.prepare('DELETE FROM profiles WHERE id = ?').bind('quickwin3-deleted').run();
  const deletedSession = await callThroughMiddleware(db, commentsEndpoint, {
    path: '/api/comments',
    token: deletedToken,
    body: { ranking_id: rankingId, user_id: verifiedUserId, content: 'Must not be accepted' },
  });
  assert.equal(deletedSession.response.status, 401);
  assert.equal(deletedSession.preparedSql.length, 1);

  console.log('Verified-session mutation checks passed: session-first, no profile re-lookup, core writes present, rows attributed to the session user, spoofed ids ignored.');
} finally {
  await mf.dispose();
}
