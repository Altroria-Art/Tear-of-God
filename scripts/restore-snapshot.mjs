// คืนข้อมูล local D1 จากไฟล์ snapshot ของ `wrangler d1 export` (db:pull)
//
// ที่ต้องมีสคริปต์นี้: export ของ wrangler เรียง CREATE TABLE ปนกับ INSERT
// ตามลำดับตัวอักษรของตาราง ทำให้ตารางลูก (เช่น reports ที่ REFERENCES
// template_comments) ถูกสร้าง/เติมก่อนตารางแม่ — replay ตรง ๆ บน local D1
// (Miniflare/workerd เปิด FK enforcement) จะพังด้วย
// "no such table: main.<parent>" เสมอ วิธีแก้คือจัดลำดับใหม่ก่อน execute:
// PRAGMA → CREATE TABLE ทั้งหมด → CREATE อื่น (index/trigger/view) →
// INSERT ทั้งหมด (defer_foreign_keys ในไฟล์ + single batch จัดการลำดับแถวให้)
// → statement อื่น (เช่น DELETE FROM sqlite_sequence) โดยคงลำดับเดิมในแต่ละกลุ่ม
//
// วิธีใช้:
//   node scripts/restore-snapshot.mjs [path-to-snapshot]
//   ค่าเริ่มต้น: ./.d1-snapshot.sql (ไฟล์ที่ db:pull สร้าง, gitignored)
//   ใช้ผ่าน: npm run db:restore  (= db:clean + สคริปต์นี้)
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// แยก statements แบบ quote-aware (ข้อมูลมี ', "", '', ตัวหนี '' และคอมเมนต์ได้)
function splitStatements(sql) {
  const out = [];
  let current = '';
  let quote = null;
  let lineComment = false;
  let blockComment = false;
  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    const next = sql[i + 1];
    if (quote) {
      current += char;
      if (char === quote) {
        if (next === quote) {
          current += next;
          i++;
        } else {
          quote = null;
        }
      }
      continue;
    }
    if (lineComment) {
      current += char;
      if (char === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      current += char;
      if (char === '*' && next === '/') {
        current += next;
        i++;
        blockComment = false;
      }
      continue;
    }
    if (char === '-' && next === '-') {
      current += '--';
      i++;
      lineComment = true;
      continue;
    }
    if (char === '/' && next === '*') {
      current += '/*';
      i++;
      blockComment = true;
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      quote = char;
      current += char;
      continue;
    }
    if (char === ';') {
      if (current.trim()) out.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

function groupOf(statement) {
  const head = statement.replace(/^\s+/, '').slice(0, 32).toUpperCase();
  if (head.startsWith('PRAGMA')) return 0;
  if (head.startsWith('CREATE TABLE')) return 1;
  if (head.startsWith('CREATE ')) return 2; // index/trigger/view: หลังตารางแม่ แต่ก่อนข้อมูล
  if (head.startsWith('INSERT INTO')) return 3;
  return 4;
}

const snapshotPath = process.argv[2] || './.d1-snapshot.sql';
let sql;
try {
  sql = readFileSync(snapshotPath, 'utf8');
} catch {
  console.error(`ไม่พบไฟล์ snapshot: ${snapshotPath} — รัน npm run db:pull ก่อน`);
  process.exit(1);
}

const statements = splitStatements(sql);
if (!statements.some((s) => s.toUpperCase().startsWith('CREATE TABLE'))) {
  console.error(`ไฟล์ ${snapshotPath} ไม่มี CREATE TABLE — ไม่ใช่ D1 export ที่ถูกต้อง`);
  process.exit(1);
}
const ordered = [...statements].sort((a, b) => groupOf(a) - groupOf(b));
if (ordered.length !== statements.length) {
  console.error('statement หายระหว่างจัดลำดับใหม่ — หยุดเพื่อความปลอดภัย');
  process.exit(1);
}
const counts = [0, 0, 0, 0, 0];
for (const s of ordered) counts[groupOf(s)]++;
console.log(`snapshot: ${statements.length} statements (pragma ${counts[0]}, tables ${counts[1]}, other-ddl ${counts[2]}, inserts ${counts[3]}, other ${counts[4]})`);

const tmpFile = join(mkdtempSync(join(tmpdir(), 'd1-restore-')), 'restore-ordered.sql');
writeFileSync(tmpFile, ordered.join(';\n') + ';\n', 'utf8');

const result = spawnSync(
  'npx',
  ['wrangler', 'd1', 'execute', 'tear-of-god-db', '--local', `--file=${tmpFile}`],
  { stdio: 'inherit', shell: process.platform === 'win32' },
);
process.exit(result.status ?? 1);
