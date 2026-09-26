import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..', '..');

console.log('=== Starting Duel Migration 0020 Verification ===\n');

// -------------------------------------------------------------
// Part 1: Migration Chain (0001..0019 -> Seed -> 0020)
// -------------------------------------------------------------
console.log('--- Part 1: Testing Migration Chain (0001..0019 -> Seed Data -> 0020) ---');

const db = new DatabaseSync(':memory:');

// Apply baseline fixture
const baselineFixture = readFileSync(join(repoRoot, 'tests', 'fixtures', 'production-schema-before-0017.sql'), 'utf8');
db.exec(baselineFixture);

// Apply active migrations 0001 through 0019 in alphabetical/numerical order
const migrationFiles = readdirSync(join(repoRoot, 'migrations-active'))
  .filter(f => f.endsWith('.sql') && !f.startsWith('0020'))
  .sort();

for (const file of migrationFiles) {
  const sql = readFileSync(join(repoRoot, 'migrations-active', file), 'utf8');
  db.exec(sql);
}
console.log(`✓ Applied baseline + ${migrationFiles.length} migrations (0001 through 0019)`);

// Seed representative production data into profiles, templates, rankings, comments
db.exec(`
INSERT INTO profiles (id, username, email) VALUES
  ('user_a', 'Alice', 'alice@test.com'),
  ('user_b', 'Bob', 'bob@test.com'),
  ('user_c', 'Charlie', 'charlie@test.com');

INSERT INTO templates (id, creator_id, title, hashtags, tiers) VALUES
  ('tmpl_1', 'user_b', 'Best Anime', '#Anime', '[{"id":"t1","label":"S","color":"#ff0000"},{"id":"t2","label":"A","color":"#00ff00"}]');

INSERT INTO rankings (id, title, user_id, template_id) VALUES
  ('rnk_1', 'Alice Best Anime', 'user_a', 'tmpl_1'),
  ('rnk_2', 'Bob Best Anime', 'user_b', 'tmpl_1');

INSERT INTO comments (id, ranking_id, user_id, content) VALUES
  ('cmt_1', 'rnk_1', 'user_c', 'Great tier list!');
`);

// Seed representative notifications across all legacy types with mixed read/unread and read_at states
const seedNotifications = [
  { id: 'notif_1', user_id: 'user_b', actor_id: 'user_a', type: 'follow', aggregate_count: 1, digest_key: null, is_read: 0, read_at: null, created_at: '2026-09-20 10:00:00' },
  { id: 'notif_2', user_id: 'user_b', actor_id: 'user_a', type: 'template_use', ranking_id: 'rnk_1', aggregate_count: 1, digest_key: null, is_read: 0, read_at: null, created_at: '2026-09-21 11:00:00' },
  { id: 'notif_3', user_id: 'user_a', actor_id: 'user_c', type: 'comment', comment_id: 'cmt_1', aggregate_count: 1, digest_key: null, is_read: 1, read_at: '2026-09-22 12:00:00', created_at: '2026-09-22 09:00:00' },
  { id: 'notif_4', user_id: 'user_b', actor_id: 'user_a', type: 'following_rank', ranking_id: 'rnk_1', aggregate_count: 1, digest_key: null, is_read: 1, read_at: '2026-09-23 08:30:00', created_at: '2026-09-23 08:00:00' },
  { id: 'notif_5', user_id: 'user_b', actor_id: null, type: 'trending', ranking_id: 'rnk_2', aggregate_count: 1, digest_key: null, is_read: 0, read_at: null, created_at: '2026-09-24 14:00:00' },
  { id: 'notif_6', user_id: 'user_a', actor_id: null, type: 'community_average', template_id: 'tmpl_1', aggregate_count: 1, digest_key: null, is_read: 0, read_at: null, created_at: '2026-09-25 15:00:00' },
  { id: 'notif_7', user_id: 'user_b', actor_id: 'user_c', type: 'like_digest', ranking_id: 'rnk_2', aggregate_count: 5, digest_key: 'digest_user_b_rnk_2', is_read: 0, read_at: null, created_at: '2026-09-26 16:00:00' }
];

const insertStmt = db.prepare(`
  INSERT INTO notifications (id, user_id, actor_id, type, ranking_id, comment_id, template_id, aggregate_count, digest_key, is_read, read_at, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

for (const n of seedNotifications) {
  insertStmt.run(
    n.id, n.user_id, n.actor_id, n.type,
    n.ranking_id || null, n.comment_id || null, n.template_id || null,
    n.aggregate_count, n.digest_key, n.is_read, n.read_at, n.created_at
  );
}

// Check unread counts before 0020
const unreadBeforeUserB = db.prepare('SELECT unread_count FROM notification_unread_counts WHERE user_id = ?').get('user_b')?.unread_count;
const unreadBeforeUserA = db.prepare('SELECT unread_count FROM notification_unread_counts WHERE user_id = ?').get('user_a')?.unread_count;
assert.equal(unreadBeforeUserB, 4, 'user_b should have 4 unread notifications before 0020');
assert.equal(unreadBeforeUserA, 1, 'user_a should have 1 unread notification before 0020');

// Snapshot all notifications before 0020
const notifsBefore = db.prepare('SELECT * FROM notifications ORDER BY id').all();
console.log(`✓ Seeded representative data (${notifsBefore.length} notifications across 7 types)`);

// -------------------------------------------------------------
// Part 2: Apply Migration 0020_duel_system.sql
// -------------------------------------------------------------
console.log('\n--- Part 2: Applying 0020_duel_system.sql ---');
const migration0020Sql = readFileSync(join(repoRoot, 'migrations-active', '0020_duel_system.sql'), 'utf8');
db.exec(migration0020Sql);
console.log('✓ Migration 0020 executed successfully');

// -------------------------------------------------------------
// Part 3: Verify Notification Preservation
// -------------------------------------------------------------
console.log('\n--- Part 3: Verifying Notification Data Preservation ---');
const notifsAfter = db.prepare('SELECT * FROM notifications ORDER BY id').all();

assert.equal(notifsAfter.length, notifsBefore.length, 'Total notification count must not change');

for (let i = 0; i < notifsBefore.length; i++) {
  const before = notifsBefore[i];
  const after = notifsAfter[i];

  assert.equal(after.id, before.id, `ID mismatch at index ${i}`);
  assert.equal(after.user_id, before.user_id, `user_id mismatch for ${before.id}`);
  assert.equal(after.actor_id, before.actor_id, `actor_id mismatch for ${before.id}`);
  assert.equal(after.type, before.type, `type mismatch for ${before.id}`);
  assert.equal(after.ranking_id, before.ranking_id, `ranking_id mismatch for ${before.id}`);
  assert.equal(after.comment_id, before.comment_id, `comment_id mismatch for ${before.id}`);
  assert.equal(after.template_id, before.template_id, `template_id mismatch for ${before.id}`);
  assert.equal(after.aggregate_count, before.aggregate_count, `aggregate_count mismatch for ${before.id}`);
  assert.equal(after.digest_key, before.digest_key, `digest_key mismatch for ${before.id}`);
  assert.equal(after.is_read, before.is_read, `is_read mismatch for ${before.id}`);
  assert.equal(after.read_at, before.read_at, `read_at mismatch for ${before.id}`);
  assert.equal(after.created_at, before.created_at, `created_at mismatch for ${before.id}`);
}
console.log('✓ All 7 notification records preserved with 100% fidelity (IDs, read_at, is_read, digest_key unchanged)');

// -------------------------------------------------------------
// Part 4: Verify Indexes Recreated
// -------------------------------------------------------------
console.log('\n--- Part 4: Verifying Indexes ---');
const expectedNotificationIndexes = [
  'idx_notifications_user_unread_created',
  'idx_notifications_user_read_at',
  'idx_notifications_expired_read',
  'idx_notifications_follow_unique',
  'idx_notifications_comment_unique',
  'idx_notifications_template_use_unique',
  'idx_notifications_following_rank_unique',
  'idx_notifications_trending_unique'
];

const actualIndexes = db.prepare("SELECT name FROM sqlite_master WHERE tbl_name = 'notifications' AND type = 'index'").all().map(r => r.name);
for (const idx of expectedNotificationIndexes) {
  assert.ok(actualIndexes.includes(idx), `Missing notification index: ${idx}`);
}
console.log(`✓ All ${expectedNotificationIndexes.length} notifications indexes recreated`);

const expectedDuelIndexes = [
  'idx_duels_challenger',
  'idx_duels_owner',
  'idx_duels_template'
];
const actualDuelIndexes = db.prepare("SELECT name FROM sqlite_master WHERE tbl_name = 'duels' AND type = 'index'").all().map(r => r.name);
for (const idx of expectedDuelIndexes) {
  assert.ok(actualDuelIndexes.includes(idx), `Missing duel index: ${idx}`);
}
console.log(`✓ All ${expectedDuelIndexes.length} duels indexes created`);

// -------------------------------------------------------------
// Part 5: Verify Triggers & Unread Count Behavior
// -------------------------------------------------------------
console.log('\n--- Part 5: Verifying Triggers & Unread Counts ---');
const expectedTriggers = [
  'notification_unread_insert',
  'notification_unread_delete',
  'notification_unread_update_old',
  'notification_unread_update_new'
];
const actualTriggers = db.prepare("SELECT name FROM sqlite_master WHERE tbl_name = 'notifications' AND type = 'trigger'").all().map(r => r.name);
for (const trig of expectedTriggers) {
  assert.ok(actualTriggers.includes(trig), `Missing trigger: ${trig}`);
}
console.log(`✓ All ${expectedTriggers.length} unread count triggers verified`);

// Verify unread counts immediately after migration match exactly
const unreadAfterUserB = db.prepare('SELECT unread_count FROM notification_unread_counts WHERE user_id = ?').get('user_b')?.unread_count;
const unreadAfterUserA = db.prepare('SELECT unread_count FROM notification_unread_counts WHERE user_id = ?').get('user_a')?.unread_count;
assert.equal(unreadAfterUserB, unreadBeforeUserB, 'user_b unread count should be identical after 0020');
assert.equal(unreadAfterUserA, unreadBeforeUserA, 'user_a unread count should be identical after 0020');

// Test 5A: Insert notification type 'duel' (is_read = 0)
db.prepare(`
  INSERT INTO notifications (id, user_id, actor_id, type, template_id, is_read)
  VALUES ('notif_duel_1', 'user_b', 'user_a', 'duel', 'tmpl_1', 0)
`).run();

const unreadAfterDuel = db.prepare('SELECT unread_count FROM notification_unread_counts WHERE user_id = ?').get('user_b')?.unread_count;
assert.equal(unreadAfterDuel, unreadBeforeUserB + 1, 'user_b unread count must increment by +1 when duel notification is inserted');
console.log('✓ Insert type "duel" succeeded and trigger incremented unread_count by +1');

// Test 5B: Mark duel notification as read
db.prepare(`
  UPDATE notifications
  SET is_read = 1, read_at = '2026-09-27 00:00:00'
  WHERE id = 'notif_duel_1'
`).run();

const unreadAfterRead = db.prepare('SELECT unread_count FROM notification_unread_counts WHERE user_id = ?').get('user_b')?.unread_count;
assert.equal(unreadAfterRead, unreadBeforeUserB, 'user_b unread count must decrement by -1 when marked read');
console.log('✓ Mark read succeeded and trigger decremented unread_count by -1');

// Test 5C: Delete an unread notification
db.prepare(`DELETE FROM notifications WHERE id = 'notif_1'`).run();
const unreadAfterDelete = db.prepare('SELECT unread_count FROM notification_unread_counts WHERE user_id = ?').get('user_b')?.unread_count;
assert.equal(unreadAfterDelete, unreadBeforeUserB - 1, 'user_b unread count must decrement by -1 when unread notification is deleted');
console.log('✓ Delete unread notification succeeded and trigger decremented unread_count by -1');

// -------------------------------------------------------------
// Part 6: Verify Duels Table Insert & FK Constraints
// -------------------------------------------------------------
console.log('\n--- Part 6: Verifying Duels Table & FK Constraints ---');
db.prepare(`
  INSERT INTO duels (id, challenger_id, template_id, owner_id, challenger_ranking_id, owner_ranking_id, similarity_score, community_similarity_score, community_sample_count)
  VALUES ('duel_1', 'user_a', 'tmpl_1', 'user_b', 'rnk_1', 'rnk_2', 85, 75, 4)
`).run();

const duelRow = db.prepare('SELECT * FROM duels WHERE id = ?').get('duel_1');
assert.equal(duelRow.similarity_score, 85);
assert.equal(duelRow.community_similarity_score, 75);
assert.equal(duelRow.community_sample_count, 4);
console.log('✓ Duels table record inserted and queried successfully');

// -------------------------------------------------------------
// Part 7: Clean Database Test from schema.sql
// -------------------------------------------------------------
console.log('\n--- Part 7: Clean Database Test (schema.sql from scratch) ---');
const cleanDb = new DatabaseSync(':memory:');
const fullSchema = readFileSync(join(repoRoot, 'schema.sql'), 'utf8');
cleanDb.exec(fullSchema);

// Verify tables exist in clean DB
const cleanTables = cleanDb.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(r => r.name);
assert.ok(cleanTables.includes('duels'), 'duels table must exist in schema.sql');
assert.ok(cleanTables.includes('notifications'), 'notifications table must exist in schema.sql');

// Verify inserting duel notification and duel record into clean DB
cleanDb.exec(`
  INSERT INTO profiles (id, username, email) VALUES ('c_user1', 'Clean User 1', 'c1@test.com'), ('c_user2', 'Clean User 2', 'c2@test.com');
  INSERT INTO templates (id, creator_id, title) VALUES ('c_tmpl1', 'c_user2', 'Clean Template');
  INSERT INTO rankings (id, title, user_id, template_id) VALUES ('c_rnk1', 'Clean Rank 1', 'c_user1', 'c_tmpl1'), ('c_rnk2', 'Clean Rank 2', 'c_user2', 'c_tmpl1');
  INSERT INTO notifications (id, user_id, actor_id, type, template_id, is_read) VALUES ('c_notif1', 'c_user2', 'c_user1', 'duel', 'c_tmpl1', 0);
  INSERT INTO duels (id, challenger_id, template_id, owner_id, challenger_ranking_id, owner_ranking_id, similarity_score)
    VALUES ('c_duel1', 'c_user1', 'c_tmpl1', 'c_user2', 'c_rnk1', 'c_rnk2', 90);
`);

const insertedNotif = cleanDb.prepare('SELECT * FROM notifications WHERE id = ?').get('c_notif1');
assert.equal(insertedNotif.type, 'duel', 'Clean DB notification must have type duel');
const insertedDuel = cleanDb.prepare('SELECT * FROM duels WHERE id = ?').get('c_duel1');
assert.equal(insertedDuel.similarity_score, 90, 'Clean DB duel similarity score must be 90');
console.log('✓ Clean database initialized from schema.sql works flawlessly');

console.log('\n=== ALL MIGRATION 0020 VERIFICATION CHECKS PASSED 100% ===\n');
