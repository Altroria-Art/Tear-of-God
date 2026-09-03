// ครั้งเดียว: เติม ranking_item_scores ย้อนหลังให้กับ ranking เดิมที่สร้างก่อนมีตารางนี้
// ใช้ node:sqlite เปิดไฟล์ D1 (.wrangler/state/v3/d1/.../xxx.sqlite) โดยตรง
//
// วิธีใช้ (Windows/Node 24):
//   node scripts/backfill-scores.mjs <path-to-sqlite>
//   ตัวอย่าง: node scripts/backfill-scores.mjs .wrangler\state\v3\d1\miniflare-D1DatabaseObject\f55117d....sqlite
import { DatabaseSync } from 'node:sqlite';

const dbPath = process.argv[2];
if (!dbPath) {
  console.error('Usage: node scripts/backfill-scores.mjs <path-to-d1-sqlite>');
  process.exit(1);
}

const db = new DatabaseSync(dbPath);

// ตรวจสอบว่ามีตารางใหม่หรือยัง
const hasTable = db.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='ranking_item_scores'"
).get();
if (!hasTable) {
  console.error('ยังไม่มีตาราง ranking_item_scores — รัน schema.sql ก่อน');
  process.exit(1);
}

const templates = {};
for (const t of db.prepare('SELECT id, tiers FROM templates').all()) {
  let def = null;
  try { def = JSON.parse(t.tiers); } catch { def = null; }
  templates[t.id] = (def && Array.isArray(def)) ? def : [];
}

const existingScores = new Set(
  db.prepare('SELECT DISTINCT ranking_id FROM ranking_item_scores').all()
    .map((r) => r.ranking_id)
);

const rankings = db.prepare('SELECT id, template_id, created_at FROM rankings').all();

const insert = db.prepare(
  'INSERT INTO ranking_item_scores (id, ranking_id, template_id, item_id, tier_index, score, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
);

// ใช้ transaction เดียวเพื่อความเร็ว
let total = 0;
let inserted = 0;

db.exec('BEGIN');
try {
  for (const r of rankings) {
    if (!r.template_id || existingScores.has(r.id)) continue;

    const tiersDef = templates[r.template_id] || [];
    const tierIndexByLabel = {};
    tiersDef.forEach((t, i) => { tierIndexByLabel[String(t.label)] = i; });
    const tierCount = tiersDef.length;
    if (tierCount === 0) continue;

    const items = db.prepare(
      'SELECT item_id, tier FROM ranking_items WHERE ranking_id = ?'
    ).all(r.id);

    for (const it of items) {
      const tierIdx = tierIndexByLabel[String(it.tier)];
      if (tierIdx === undefined) continue; // item ยังไม่จัด / tier ไม่ตรง — ข้าม
      insert.run(
        crypto.randomUUID(),
        r.id,
        r.template_id,
        it.item_id,
        tierIdx,
        tierCount - tierIdx,
        r.created_at || null
      );
      inserted++;
    }
    total++;
  }
  db.exec('COMMIT');
} catch (err) {
  db.exec('ROLLBACK');
  console.error('error:', err.message);
  process.exit(1);
}

console.log(`เสร็จ: เติมคะแนนให้ ${total} rankings, ใส่ score ทั้งหมด ${inserted} แถว`);
