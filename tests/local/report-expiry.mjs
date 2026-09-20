// Report close/reopen/auto-expiry flow against a real Miniflare D1 seeded from
// schema.sql. Covers: Keep Content (close stamps closed_at but keeps the row),
// reopen within 24h reverts to pending + clears the timestamp, closed reports are
// physically deleted from D1 24h after closing, pending rows are never purged,
// the 24h boundary (just under kept / past deleted), and FK safety (purging a
// report must not touch the content it references).

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

import { onRequest as adminReports } from '../../functions/api/admin/reports.js';

const schemaSql = await readFile(new URL('../../schema.sql', import.meta.url), 'utf8');

function sqlStatements(sql) {
  return sql
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n')
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);
}

const schemaStatements = sqlStatements(schemaSql);

async function createD1() {
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

const ADMIN = `admin-${crypto.randomUUID()}`;

function getRequest(url) {
  return new Request(`https://local.test${url}`, { method: 'GET' });
}

function postRequest(payload) {
  return new Request('https://local.test/api/admin/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

async function call(handler, request, db) {
  return handler({ request, env: { tear_of_god_db: db }, data: { user: { id: ADMIN } } });
}

async function getList(db, params = 'status=all&page=1&limit=100') {
  const response = await call(adminReports, getRequest(`/api/admin/reports?${params}`), db);
  return { response, body: await response.json() };
}

async function mutate(db, payload) {
  const response = await call(adminReports, postRequest(payload), db);
  return { response, body: await response.json() };
}

async function assertReportGone(db, id) {
  const row = await db.prepare('SELECT id FROM reports WHERE id = ?').bind(id).first();
  assert.equal(row, null, `report ${id} should be gone from D1`);
}

async function getReport(db, id) {
  return db.prepare('SELECT * FROM reports WHERE id = ?').bind(id).first();
}

async function seedWorld(db) {
  await db.batch([
    db.prepare(`INSERT INTO profiles (id, username, email, role) VALUES
      (?, 'admin-test', 'admin@local.test', 'admin'),
      ('member-1', 'member', 'member@local.test', 'user')`).bind(ADMIN),
    db.prepare(`INSERT INTO templates (id, creator_id, title, description, hashtags, tiers, use_count, view_count)
      VALUES ('tpl-1', 'member-1', 'Template', 'desc', '#t', '[]', 0, 0)`),
    db.prepare(`INSERT INTO rankings (id, title, description, hashtags, user_id, template_id)
      VALUES ('rk-1', 'Ranking', 'desc', '#t', 'member-1', 'tpl-1')`),
    db.prepare("INSERT INTO comments (id, ranking_id, user_id, content) VALUES ('cmt-1', 'rk-1', 'member-1', 'comment body')"),
    db.prepare("INSERT INTO template_comments (id, template_id, user_id, content) VALUES ('tc-1', 'tpl-1', 'member-1', 'template comment')"),
    db.prepare(`INSERT INTO reports
      (id, ranking_id, comment_id, reporter_id, reason, status, closed_at, created_at)
      VALUES ('report-pending', 'rk-1', 'cmt-1', 'member-1', 'spam', 'pending', NULL, CURRENT_TIMESTAMP)`),
    db.prepare(`INSERT INTO reports
      (id, template_id, template_comment_id, reporter_id, reason, status, closed_at, created_at)
      VALUES ('report-resolved-recent', 'tpl-1', 'tc-1', 'member-1', 'spam', 'resolved',
        datetime('now', '-2 hours'), CURRENT_TIMESTAMP)`),
    db.prepare(`INSERT INTO reports
      (id, template_id, reporter_id, reason, status, closed_at, created_at)
      VALUES ('report-resolved-under24', 'tpl-1', 'member-1', 'spam', 'resolved',
        datetime('now', '-23 hours', '-59 minutes', '-59 seconds'), CURRENT_TIMESTAMP)`),
    db.prepare(`INSERT INTO reports
      (id, template_id, reporter_id, reason, status, closed_at, created_at)
      VALUES ('report-resolved-expired', 'tpl-1', 'member-1', 'spam', 'resolved',
        datetime('now', '-24 hours', '-2 seconds'), CURRENT_TIMESTAMP)`),
    db.prepare(`INSERT INTO reports
      (id, template_id, reporter_id, reason, status, closed_at, created_at)
      VALUES ('report-resolved-veryold', 'tpl-1', 'member-1', 'spam', 'resolved',
        datetime('now', '-25 hours'), CURRENT_TIMESTAMP)`),
    db.prepare(`INSERT INTO reports
      (id, ranking_id, reporter_id, reason, status, closed_at, created_at)
      VALUES ('report-pending-leaky', 'rk-1', 'member-1', 'spam', 'pending',
        datetime('now', '-25 hours'), CURRENT_TIMESTAMP)`),
  ]);
  return {
    ranking: 'rk-1',
    template: 'tpl-1',
    comment: 'cmt-1',
    templateComment: 'tc-1',
  };
}

const { mf, db } = await createD1();
try {
  await seedWorld(db);

  // ---- 1) GET list: purge physically removes only closed, expired reports.
  {
    const { response, body } = await getList(db);
    assert.equal(response.status, 200);
    assert.equal(body.success, true);

    const presentIds = new Set(body.data.map((r) => r.id));
    assert.ok(presentIds.has('report-pending'), 'pending report must survive the purge');
    assert.ok(presentIds.has('report-pending-leaky'), 'pending report must never be purged even with a leaked closed_at');
    assert.ok(presentIds.has('report-resolved-recent'), 'recently closed report must be kept');
    assert.ok(presentIds.has('report-resolved-under24'), 'report closed just under 24h must be kept');
    assert.ok(!presentIds.has('report-resolved-expired'), 'report closed >24h ago must be purged from the list');
    assert.ok(!presentIds.has('report-resolved-veryold'), 'report closed 25h ago must be purged from the list');

    await assertReportGone(db, 'report-resolved-expired');
    await assertReportGone(db, 'report-resolved-veryold');
    assert.ok((await getReport(db, 'report-pending')) !== null);
    assert.ok((await getReport(db, 'report-resolved-under24')) !== null);

    // The returned rows carry closed_at so the UI can render the countdown.
    const recent = body.data.find((r) => r.id === 'report-resolved-recent');
    assert.ok(recent.closed_at, 'closed report must expose closed_at');

    // FK safety: purging reports left every referenced content row intact.
    assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM rankings').first()).count, 1);
    assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM templates').first()).count, 1);
    assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM comments').first()).count, 1);
    assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM template_comments').first()).count, 1);
  }

  // ---- 2) Reopen within the window reverts to pending and clears closed_at.
  {
    assert.equal((await getReport(db, 'report-resolved-under24')).status, 'resolved');
    const { response, body } = await mutate(db, { action: 'set_status', target_id: 'report-resolved-under24', status: 'pending' });
    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.deepEqual(body.data, { id: 'report-resolved-under24', status: 'pending' });

    const row = await getReport(db, 'report-resolved-under24');
    assert.equal(row.status, 'pending');
    assert.equal(row.closed_at, null, 'reopen must clear the 24h close timestamp');
  }

  // ---- 3) Reopen is idempotent on an already-pending report.
  {
    const { response, body } = await mutate(db, { action: 'set_status', target_id: 'report-pending', status: 'pending' });
    assert.equal(response.status, 200);
    assert.deepEqual(body.data, { id: 'report-pending', status: 'pending' });
    assert.ok((await getReport(db, 'report-pending')) !== null);
  }

  // ---- 4) Reopen on a report whose window has passed is rejected + row gone.
  {
    const { response, body } = await mutate(db, { action: 'set_status', target_id: 'report-resolved-veryold', status: 'pending' });
    assert.ok([404, 410].includes(response.status), `expected 404/410, got ${response.status}`);
    assert.equal(body.success, false);
    await assertReportGone(db, 'report-resolved-veryold');
    assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM templates').first()).count, 1, 'rejected reopen must not touch content');
  }

  // ---- 5) Closing (Keep Content) stamps closed_at and keeps the row + content.
  {
    const { response, body } = await mutate(db, { action: 'set_status', target_id: 'report-pending', status: 'resolved' });
    assert.equal(response.status, 200);
    assert.deepEqual(body.data, { id: 'report-pending', status: 'resolved' });

    const row = await getReport(db, 'report-pending');
    assert.equal(row.status, 'resolved');
    assert.ok(row.closed_at, 'close must stamp the 24h window');
    assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM comments').first()).count, 1);
  }

  // ---- 6) Re-closing an already-closed report must not restart the window.
  {
    await db.prepare(`UPDATE reports SET closed_at = datetime('now', '-20 hours') WHERE id = ?`).bind('report-resolved-recent').run();
    const before = await getReport(db, 'report-resolved-recent');
    const { response } = await mutate(db, { action: 'set_status', target_id: 'report-resolved-recent', status: 'resolved' });
    assert.equal(response.status, 200);
    const after = await getReport(db, 'report-resolved-recent');
    assert.equal(after.closed_at, before.closed_at, 're-close must keep the original closed_at');
  }

  // ---- 7) Manual delete action still works (kept for API compatibility).
  {
    const { response, body } = await mutate(db, { action: 'delete', target_id: 'report-resolved-recent' });
    assert.equal(response.status, 200);
    assert.deepEqual(body.data, { id: 'report-resolved-recent' });
    await assertReportGone(db, 'report-resolved-recent');
    assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM templates').first()).count, 1);
  }

  console.log('Report close/reopen/expiry checks passed');
} finally {
  await mf.dispose();
}