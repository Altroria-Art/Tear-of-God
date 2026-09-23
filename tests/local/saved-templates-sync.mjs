import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

import { onRequestGet as bookmarksGet, onRequestPost as bookmarksPost } from '../../functions/api/bookmarks.js';
import { onRequestGet as templatesGet } from '../../functions/api/templates.js';

const schema = await readFile(new URL('../../schema.sql', import.meta.url), 'utf8');
const schemaStatements = schema
  .split(/\r?\n/)
  .filter((line) => !line.trimStart().startsWith('--'))
  .join('\n')
  .split(';')
  .map((statement) => statement.trim())
  .filter(Boolean);

async function createLocalD1() {
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: 'export default { fetch() { return new Response("local test"); } }',
      compatibilityDate: '2026-01-01',
      d1Databases: ['DB'],
    })
  );
  const db = await mf.getD1Database('DB');
  await db.batch(schemaStatements.map((statement) => db.prepare(statement)));
  return { mf, db };
}

async function run() {
  const { mf, db } = await createLocalD1();

  try {
    const user1 = 'user-bookmark-1';
    const user2 = 'user-bookmark-2';
    const templateId = 'tpl-sync-test';

    // Seed test profiles and template
    await db.prepare('INSERT INTO profiles (id, username) VALUES (?, ?)').bind(user1, 'tester1').run();
    await db.prepare('INSERT INTO profiles (id, username) VALUES (?, ?)').bind(user2, 'tester2').run();
    await db
      .prepare(
        `INSERT INTO templates (id, title, description, hashtags, creator_id, tiers)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(
        templateId,
        'Test Sync Template',
        'Testing saved state sync',
        JSON.stringify(['#test']),
        user1,
        JSON.stringify([{ id: 's', label: 'S', color: '#ff7f7f' }])
      )
      .run();

    console.log('✓ Seeded database with test template');

    // 1. Test GET /api/bookmarks for guest
    {
      const res = await bookmarksGet({ env: { tear_of_god_db: db }, data: {} });
      const json = await res.json();
      assert.equal(res.status, 200);
      assert.equal(json.success, true);
      assert.deepEqual(json.data, []);
      console.log('✓ GET /api/bookmarks returns empty array for guest');
    }

    // 2. Test GET /api/bookmarks for user1 (initially unsaved)
    {
      const res = await bookmarksGet({ env: { tear_of_god_db: db }, data: { user: { id: user1 } } });
      const json = await res.json();
      assert.equal(res.status, 200);
      assert.equal(json.success, true);
      assert.deepEqual(json.data, []);
      console.log('✓ GET /api/bookmarks returns empty array for user with no bookmarks');
    }

    // 3. Test GET /api/templates?id=... before bookmarking
    {
      const req = new Request(`https://test.local/api/templates?id=${templateId}`);
      const res = await templatesGet({
        request: req,
        env: { tear_of_god_db: db },
        data: { user: { id: user1 } },
      });
      const json = await res.json();
      assert.equal(res.status, 200);
      assert.equal(json.success, true);
      assert.equal(json.data.is_saved, false, 'is_saved should be false initially');
      console.log('✓ GET /api/templates?id=... reports is_saved: false initially');
    }

    // 4. Test POST /api/bookmarks to save template
    {
      const req = new Request('https://test.local/api/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_id: templateId, saved: true }),
      });
      const res = await bookmarksPost({
        request: req,
        env: { tear_of_god_db: db },
        data: { user: { id: user1 } },
      });
      const json = await res.json();
      assert.equal(res.status, 200);
      assert.equal(json.success, true);
      assert.equal(json.saved, true);
      console.log('✓ POST /api/bookmarks saves template successfully');
    }

    // 5. Test GET /api/bookmarks returns [templateId] for user1, but [] for user2
    {
      const res1 = await bookmarksGet({ env: { tear_of_god_db: db }, data: { user: { id: user1 } } });
      const json1 = await res1.json();
      assert.equal(json1.success, true);
      assert.deepEqual(json1.data, [templateId]);

      const res2 = await bookmarksGet({ env: { tear_of_god_db: db }, data: { user: { id: user2 } } });
      const json2 = await res2.json();
      assert.equal(json2.success, true);
      assert.deepEqual(json2.data, []);
      console.log('✓ GET /api/bookmarks returns saved template ID for user1, empty for user2');
    }

    // 6. Test GET /api/templates?id=... reports is_saved: true for user1, false for user2
    {
      const req1 = new Request(`https://test.local/api/templates?id=${templateId}`);
      const res1 = await templatesGet({
        request: req1,
        env: { tear_of_god_db: db },
        data: { user: { id: user1 } },
      });
      const json1 = await res1.json();
      assert.equal(json1.success, true);
      assert.equal(json1.data.is_saved, true, 'is_saved should be true for user who bookmarked it');

      const req2 = new Request(`https://test.local/api/templates?id=${templateId}`);
      const res2 = await templatesGet({
        request: req2,
        env: { tear_of_god_db: db },
        data: { user: { id: user2 } },
      });
      const json2 = await res2.json();
      assert.equal(json2.success, true);
      assert.equal(json2.data.is_saved, false, 'is_saved should be false for other user');
      console.log('✓ GET /api/templates?id=... accurately returns is_saved: true for saver and false for others');
    }

    // 7. Test GET /api/templates?saved=true returns template for user1, empty for user2
    {
      const req1 = new Request('https://test.local/api/templates?saved=true');
      const res1 = await templatesGet({
        request: req1,
        env: { tear_of_god_db: db },
        data: { user: { id: user1 } },
      });
      const json1 = await res1.json();
      assert.equal(json1.success, true);
      assert.equal(json1.data.length, 1);
      assert.equal(json1.data[0].id, templateId);
      assert.equal(json1.data[0].is_saved, true);

      const req2 = new Request('https://test.local/api/templates?saved=true');
      const res2 = await templatesGet({
        request: req2,
        env: { tear_of_god_db: db },
        data: { user: { id: user2 } },
      });
      const json2 = await res2.json();
      assert.equal(json2.success, true);
      assert.equal(json2.data.length, 0);
      console.log('✓ GET /api/templates?saved=true returns bookmarked template with is_saved: true');
    }

    // 8. Test POST /api/bookmarks unsave (saved: false)
    {
      const req = new Request('https://test.local/api/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_id: templateId, saved: false }),
      });
      const res = await bookmarksPost({
        request: req,
        env: { tear_of_god_db: db },
        data: { user: { id: user1 } },
      });
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.saved, false);
      console.log('✓ POST /api/bookmarks unsaves template successfully');
    }

    // 9. Verify state after unsave
    {
      const resBookmarks = await bookmarksGet({ env: { tear_of_god_db: db }, data: { user: { id: user1 } } });
      const jsonBookmarks = await resBookmarks.json();
      assert.deepEqual(jsonBookmarks.data, []);

      const reqDetail = new Request(`https://test.local/api/templates?id=${templateId}`);
      const resDetail = await templatesGet({
        request: reqDetail,
        env: { tear_of_god_db: db },
        data: { user: { id: user1 } },
      });
      const jsonDetail = await resDetail.json();
      assert.equal(jsonDetail.data.is_saved, false);

      const reqSaved = new Request('https://test.local/api/templates?saved=true');
      const resSaved = await templatesGet({
        request: reqSaved,
        env: { tear_of_god_db: db },
        data: { user: { id: user1 } },
      });
      const jsonSaved = await resSaved.json();
      assert.equal(jsonSaved.data.length, 0);
      console.log('✓ All endpoints correctly reflect unsaved state');
    }

    console.log('\nAll saved template sync tests passed successfully!');
  } finally {
    await mf.dispose();
  }
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
