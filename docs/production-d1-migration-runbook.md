# Production D1 Migration Runbook

Runbook นี้ครอบคลุมการ baseline migration ledger และ schema reconciliation ของ
Tear-of-God จาก Production schema ที่ audit ใน Phase 3B ไปยัง schema เป้าหมายที่
rehearsal ใน Phase 3C–3D แล้ว

เอกสารนี้เป็นแผนปฏิบัติการเท่านั้น การจัดทำ Phase 3E ห้ามเขียน Production,
apply migration, restore, deploy หรือเปลี่ยน Cloudflare configuration

## 1. ขอบเขตและค่าที่ต้องตรง

ค่าที่อนุมัติไว้:

| รายการ | ค่าที่ต้องพบ |
| --- | --- |
| Pages project | `tear-of-god` |
| D1 database name | `tear-of-god-db` |
| D1 database UUID | `69d366f1-55ba-43cf-a492-882e137786f4` |
| Pages Functions binding | `tear_of_god_db` |
| Active migrations | `0001_baseline.sql`, `0002_schema_reconciliation.sql` |
| Production ledger ก่อนเริ่ม | มีตาราง `d1_migrations` และไม่มี applied migration |
| Wrangler ที่ rehearsal | `4.125.0` |

Migration source ต้องมาจาก commit
`6719f3388ffdfeb67bc591a01b7aaaea81ddd04e` และมี SHA-256 ดังนี้:

```text
0001_baseline.sql
6B661E4CC34395D2A6F3D4188F307BBF53289192D698627415F98A5A503C430C

0002_schema_reconciliation.sql
39C0EB66D3EC20F48144CA7FEA396E9EF347CD0F0FE526EEF3BAE8136328A1C9
```

Git blob IDs ที่ไม่ขึ้นกับ working-tree line endings:

```text
0001_baseline.sql:              29ce467559b88bbe13e42a93dd6045cafb89f5c0
0002_schema_reconciliation.sql: 33a14763e010425b2ee0c10c5025dbf5dd705331
```

ถ้าค่าใดไม่ตรง ให้หยุดทันที ห้ามแก้ database, ledger หรือ migration เพื่อให้
ผลตรวจ “ดูเหมือนตรง”

## 2. กฎการปฏิบัติงาน

- ใช้ terminal แบบ interactive เท่านั้น ห้ามรันจาก CI
- ห้ามเติม `--yes`, `-y` หรือกลไก auto-confirm ให้คำสั่ง migration/restore
- ทุกคำสั่ง Production ต้องระบุ `--remote` และ `--config` อย่างชัดเจน
- ห้ามใช้ `wrangler.toml` สำหรับ migration discovery เพราะยังชี้ default
  legacy directory `migrations/`
- ห้ามใช้ `wrangler.phase3d*.toml` กับ Production เพราะใช้ UUID synthetic
- ห้ามใช้ `wrangler d1 execute --file` เพื่อ apply migration เพราะจะ bypass
  migration discovery/ledger workflow
- ห้าม INSERT/UPDATE/DELETE ใน `d1_migrations` ด้วยตนเอง
- ห้ามแก้ migration file หลังผ่าน Gate C ถ้า hash เปลี่ยนต้อง rehearsal ใหม่
- ห้ามรัน legacy migrations ทั้ง 18 ไฟล์กับ Production
- ห้ามแสดง email, password/session/reset hash, OAuth identifier หรือ row-level
  profile data ใน terminal log หรือรายงาน
- ทุก Production write ต้องมี approval แยกก่อนรัน แม้คำสั่งนั้นอยู่ในเอกสารนี้

## 3. เตรียม one-purpose config

ขั้น execute จริงให้สร้าง config สองไฟล์ภายใต้
`.wrangler/phase3e-production/` ซึ่งถูก ignore จาก Git อยู่แล้ว ห้ามแก้
Production `wrangler.toml`

`.wrangler/phase3e-production/wrangler.migrations.toml`:

```toml
# D1 migration operations only. DO NOT DEPLOY with this config.
name = "tear-of-god-phase3e-migration-only"
compatibility_date = "2026-01-01"

[[d1_databases]]
binding = "tear_of_god_db"
database_name = "tear-of-god-db"
database_id = "69d366f1-55ba-43cf-a492-882e137786f4"
migrations_dir = "../../migrations-active"
```

`.wrangler/phase3e-production/wrangler.baseline.toml`:

```toml
# Baseline operation only. DO NOT DEPLOY with this config.
name = "tear-of-god-phase3e-baseline-only"
compatibility_date = "2026-01-01"

[[d1_databases]]
binding = "tear_of_god_db"
database_name = "tear-of-god-db"
database_id = "69d366f1-55ba-43cf-a492-882e137786f4"
migrations_dir = "../../migrations-active"
migrations_pattern = "../../migrations-active/0001_baseline.sql"
```

ตั้งตัวแปร PowerShell หลังตรวจว่าอยู่ที่ repository root:

```powershell
$MigrationConfig = ".wrangler/phase3e-production/wrangler.migrations.toml"
$BaselineConfig = ".wrangler/phase3e-production/wrangler.baseline.toml"
$DatabaseBinding = "tear_of_god_db"
$ExpectedDatabaseId = "69d366f1-55ba-43cf-a492-882e137786f4"
```

เหตุผลที่ใช้สอง config คือ baseline ต้อง apply แยกและตรวจ ledger ก่อนอนุญาตให้
Wrangler เห็น reconciliation เป็น migration ถัดไป วิธีนี้ตรงกับ rehearsal Phase 3D

## 4. Gate A — Identity และ fresh read-only preflight

Gate A เป็น read-only ทั้งหมด แต่ผู้ปฏิบัติงานยังต้องบันทึก output และให้เจ้าของ
ระบบยืนยัน account ก่อนดำเนินต่อ

### 4.1 ยืนยัน source และ Wrangler

```powershell
git status --short --branch
git rev-parse HEAD
npx wrangler --version
Get-ChildItem migrations-active -File | Sort-Object Name | Select-Object -ExpandProperty Name
Get-FileHash migrations-active/0001_baseline.sql,migrations-active/0002_schema_reconciliation.sql -Algorithm SHA256
git rev-parse 6719f3388ffdfeb67bc591a01b7aaaea81ddd04e:migrations-active/0001_baseline.sql
git rev-parse 6719f3388ffdfeb67bc591a01b7aaaea81ddd04e:migrations-active/0002_schema_reconciliation.sql
git diff -- migrations-active
```

ผลที่ยอมรับได้:

- active directory มี SQL สองไฟล์ตามลำดับเท่านั้น
- hashes ตรงกับ Section 1
- ไม่มี working diff ใน migration files
- commit `6719f3388ffdfeb67bc591a01b7aaaea81ddd04e` อยู่ใน ancestry ของ checkout
- Wrangler version ตรงกับ rehearsal หรือ version ใหม่ผ่าน Phase 3D rehearsal ใหม่แล้ว

### 4.2 ยืนยัน Cloudflare account, Pages project และ D1

คำสั่งต่อไปนี้เรียก remote control plane แบบ read-only:

```powershell
npx wrangler whoami --json
npx wrangler pages project list --json
npx wrangler d1 list --json --config "$MigrationConfig"
npx wrangler d1 info tear-of-god-db --json --config "$MigrationConfig"
```

ตรวจโดยมนุษย์ว่า:

1. account ID/name จาก `whoami` ตรงกับ account ที่เจ้าของระบบอนุมัติไว้
2. Pages project list มี project ชื่อ `tear-of-god` เพียงรายการที่ตั้งใจใช้
3. D1 list/info ให้ชื่อ `tear-of-god-db` และ UUID
   `69d366f1-55ba-43cf-a492-882e137786f4`
4. `d1 info` ระบุ backend/version ที่รองรับ Time Travel
5. config ที่ใช้มี binding `tear_of_god_db` และ UUID เดียวกัน:

```powershell
Select-String -Path "$MigrationConfig" -Pattern 'binding|database_name|database_id|migrations_dir'
Select-String -Path wrangler.toml -Pattern 'binding|database_name|database_id'
```

Wrangler 4.125.0 ไม่มีคำสั่ง Pages `project get` แต่มีคำสั่ง experimental สำหรับ
download project config ให้นำ config ลง directory ที่ Git ignore แล้วตรวจเฉพาะ
binding metadata:

```powershell
$RepositoryRoot = (Resolve-Path ".").Path
$PagesAuditDirectory = Join-Path $RepositoryRoot ".wrangler/phase3e-production/pages-config-audit"
New-Item -ItemType Directory -Force -Path $PagesAuditDirectory
Push-Location $PagesAuditDirectory
& "$RepositoryRoot/node_modules/.bin/wrangler.cmd" pages download config tear-of-god
Pop-Location
Get-ChildItem $PagesAuditDirectory -File
Select-String -Path "$PagesAuditDirectory/wrangler.toml" -Pattern 'binding|database_name|database_id'
```

คำสั่ง download อ่าน Cloudflare settings แต่เขียนไฟล์ local เท่านั้น ห้ามใช้
`--force`; ถ้ามีไฟล์เดิมให้ STOP และสร้าง audit directory ใหม่แทน หากรูปแบบหรือ
ชื่อ output ต่างจาก `wrangler.toml` ให้ตรวจไฟล์ที่ Wrangler รายงานโดยไม่แก้ไข

ตรวจใน Cloudflare Dashboard แบบ read-only ซ้ำอีกชั้น: Pages → `tear-of-god` →
Settings → Functions → D1 bindings ต้องเห็น `tear_of_god_db` ชี้ UUID เดียวกัน
หาก downloaded config, dashboard และ repository ไม่ตรง ให้ STOP

### 4.3 Fresh integrity preflight

คำสั่งทั้งหมดในส่วนนี้เป็น SELECT/read-only PRAGMA และคืนเฉพาะ aggregate/schema
metadata

Orphan rankings:

```powershell
npx wrangler d1 execute $DatabaseBinding --remote --config "$MigrationConfig" --json --command "SELECT COALESCE(SUM(CASE WHEN r.template_id IS NOT NULL AND t.id IS NULL THEN 1 ELSE 0 END), 0) AS missing_template_count, COALESCE(SUM(CASE WHEN r.user_id IS NOT NULL AND p.id IS NULL THEN 1 ELSE 0 END), 0) AS missing_user_count FROM rankings r LEFT JOIN templates t ON t.id = r.template_id LEFT JOIN profiles p ON p.id = r.user_id"
```

Orphan ranking items:

```powershell
npx wrangler d1 execute $DatabaseBinding --remote --config "$MigrationConfig" --json --command "SELECT COALESCE(SUM(CASE WHEN r.id IS NULL THEN 1 ELSE 0 END), 0) AS missing_ranking_count, COALESCE(SUM(CASE WHEN i.id IS NULL THEN 1 ELSE 0 END), 0) AS missing_item_count FROM ranking_items ri LEFT JOIN rankings r ON r.id = ri.ranking_id LEFT JOIN items i ON i.id = ri.item_id"
```

Orphan ranking item scores:

```powershell
npx wrangler d1 execute $DatabaseBinding --remote --config "$MigrationConfig" --json --command "SELECT COALESCE(SUM(CASE WHEN r.id IS NULL THEN 1 ELSE 0 END), 0) AS missing_ranking_count, COALESCE(SUM(CASE WHEN t.id IS NULL THEN 1 ELSE 0 END), 0) AS missing_template_count, COALESCE(SUM(CASE WHEN i.id IS NULL THEN 1 ELSE 0 END), 0) AS missing_item_count FROM ranking_item_scores s LEFT JOIN rankings r ON r.id = s.ranking_id LEFT JOIN templates t ON t.id = s.template_id LEFT JOIN items i ON i.id = s.item_id"
```

Orphan template items:

```powershell
npx wrangler d1 execute $DatabaseBinding --remote --config "$MigrationConfig" --json --command "SELECT COALESCE(SUM(CASE WHEN t.id IS NULL THEN 1 ELSE 0 END), 0) AS missing_template_count, COALESCE(SUM(CASE WHEN i.id IS NULL THEN 1 ELSE 0 END), 0) AS missing_item_count FROM template_items ti LEFT JOIN templates t ON t.id = ti.template_id LEFT JOIN items i ON i.id = ti.item_id"
```

Duplicate score pair:

```powershell
npx wrangler d1 execute $DatabaseBinding --remote --config "$MigrationConfig" --json --command "SELECT COUNT(*) AS duplicate_pair_count, COALESCE(SUM(pair_count - 1), 0) AS excess_row_count FROM (SELECT COUNT(*) AS pair_count FROM ranking_item_scores GROUP BY ranking_id, item_id HAVING COUNT(*) > 1)"
```

Foreign-key violations:

```powershell
npx wrangler d1 execute $DatabaseBinding --remote --config "$MigrationConfig" --json --command "SELECT COUNT(*) AS foreign_key_violation_count FROM pragma_foreign_key_check"
```

Row-count baseline:

```powershell
npx wrangler d1 execute $DatabaseBinding --remote --config "$MigrationConfig" --json --command "SELECT (SELECT COUNT(*) FROM profiles) AS profiles, (SELECT COUNT(*) FROM templates) AS templates, (SELECT COUNT(*) FROM template_items) AS template_items, (SELECT COUNT(*) FROM rankings) AS rankings, (SELECT COUNT(*) FROM ranking_items) AS ranking_items, (SELECT COUNT(*) FROM ranking_item_scores) AS ranking_item_scores, (SELECT COUNT(*) FROM auth_sessions) AS auth_sessions, (SELECT COUNT(*) FROM auth_identities) AS auth_identities, (SELECT COUNT(*) FROM password_resets) AS password_resets, (SELECT COUNT(*) FROM votes) AS votes, (SELECT COUNT(*) FROM comments) AS comments, (SELECT COUNT(*) FROM template_views) AS template_views, (SELECT COUNT(*) FROM template_bookmarks) AS template_bookmarks, (SELECT COUNT(*) FROM reports) AS reports"
```

Migration ledger:

```powershell
npx wrangler d1 execute $DatabaseBinding --remote --config "$MigrationConfig" --json --command "SELECT id, name, applied_at FROM d1_migrations ORDER BY id"
```

ผลก่อน baseline ต้องเป็น zero rows ห้ามมีชื่อ legacy migration หรือชื่ออื่น

### 4.4 Fresh schema fingerprint

```powershell
npx wrangler d1 execute $DatabaseBinding --remote --config "$MigrationConfig" --json --command "SELECT type, name, tbl_name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY type, name"
npx wrangler d1 execute $DatabaseBinding --remote --config "$MigrationConfig" --json --command "PRAGMA table_info(templates); PRAGMA foreign_key_list(templates); PRAGMA table_info(rankings); PRAGMA foreign_key_list(rankings); PRAGMA table_info(ranking_item_scores); PRAGMA index_list(ranking_item_scores)"
npx wrangler d1 execute $DatabaseBinding --remote --config "$MigrationConfig" --json --command "SELECT name, tbl_name, sql FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%' ORDER BY name"
```

ก่อน reconciliation ต้องยังตรงกับ Phase 3B และ fixture
`tests/fixtures/production-schema-before-0017.sql`:

- `templates.creator_id` เป็น `ON DELETE CASCADE`
- `rankings.template_id` nullable และยังไม่มี FK ไป `templates`
- ยังไม่มี unique enforcement บน `(ranking_id,item_id)`
- columns/defaults/indexes อื่นตรงกับ fixture รวม extra indexes
  `idx_follows_follower`, `idx_template_reactions_user`,
  `idx_template_views_template`

### Gate A stop conditions

STOP ทันทีเมื่อเกิดข้อใดข้อหนึ่ง:

- account, Pages project, D1 name, UUID หรือ binding ไม่ตรง
- active migration list/hash ไม่ตรง
- Wrangler version เปลี่ยนโดยยังไม่ได้ rehearsal ซ้ำ
- orphan count, duplicate count หรือ FK violation มากกว่า 0
- ledger ไม่มีตาราง, ไม่ว่าง หรือมีค่าต่างจากที่คาด
- schema/index/FK ต่างจาก Phase 3B fixture แม้ row count จะปกติ
- query ใดล้ม, timeout หรือให้ผลกำกวม

ห้ามซ่อมข้อมูล, baseline ledger หรือแก้ migration ใน production session นี้

## 5. Gate B — Backup และ recovery readiness

แนะนำให้เปิด maintenance/write freeze ก่อนจับ recovery bookmark เพื่อไม่ให้การ
restore ภายหลังทำให้ writes ของผู้ใช้ที่เกิดหลัง bookmark สูญหาย ถ้ายังไม่มีวิธี
หยุด mutation traffic อย่างปลอดภัย ให้ STOP และเตรียม maintenance mechanism ก่อน

### 5.1 จับ Time Travel bookmark

คำสั่งนี้เป็น read-only:

```powershell
npx wrangler d1 time-travel info tear-of-god-db --json --config "$MigrationConfig"
```

บันทึก bookmark เป็น `B0_PRE_BASELINE` พร้อม UTC timestamp ใน operation log ที่
ไม่ commit เข้า Git ห้ามดำเนินต่อถ้า `d1 info` ไม่ยืนยันว่า database รองรับ
Time Travel หรือดึง bookmark ไม่สำเร็จ

### 5.2 Full SQL export

Export อ่าน Production และเขียนไฟล์ local เท่านั้น แต่ไฟล์มีข้อมูลส่วนตัว ต้อง
เก็บใต้ `.wrangler/phase3e-production/backups/` ซึ่ง Git ignore และจำกัดสิทธิ์
เข้าถึง:

```powershell
$BackupDirectory = ".wrangler/phase3e-production/backups"
New-Item -ItemType Directory -Force -Path $BackupDirectory
$BackupPath = Join-Path $BackupDirectory "backup-before-phase3e-YYYYMMDDTHHMMSSZ.sql"
npx wrangler d1 export tear-of-god-db --remote --config "$MigrationConfig" --output "$BackupPath"
```

ห้ามใช้ `--skip-confirmation` ตรวจ exit code ก่อน แล้วตรวจเฉพาะ metadata ไม่อ่าน
หรือพิมพ์ row data:

```powershell
Get-Item "$BackupPath" | Select-Object FullName,Length,LastWriteTimeUtc
Get-FileHash "$BackupPath" -Algorithm SHA256
Select-String -Path "$BackupPath" -Pattern '^CREATE TABLE' | Select-Object -ExpandProperty Line
git check-ignore -v "$BackupPath"
git status --short
```

Backup ถือว่าพร้อมเมื่อ command สำเร็จ, file size มากกว่า 0, มี schema ของตาราง
สำคัญ, hash ถูกบันทึก, file ถูก ignore และไม่มี backup ถูก stage ห้ามทดสอบ
restore dump นี้บน developer laptop เพราะจะคัดลอก Production PII เพิ่ม

Wrangler migrations apply จะ capture backup ให้อัตโนมัติด้วย แต่ runbook ยังคง
ใช้ทั้ง B0 bookmark และ independent export เพื่อมี recovery evidence สองชั้น

### Gate B stop conditions

- ไม่มี approved maintenance/write-freeze plan
- ไม่มี B0 bookmark หรือ Time Travel ใช้งานไม่ได้
- export ล้ม, ว่าง, hash ไม่ได้บันทึก หรืออยู่ใน Git-visible path
- ผู้ปฏิบัติงานยังไม่ทราบ retention window ของ account ปัจจุบัน

## 6. Gate C — Migration discovery review

ขั้นนี้ยังเป็น read-only และต้องเกิดหลังยืนยันว่า `d1_migrations` มีอยู่และว่างแล้ว

ตรวจ config และ discovery:

```powershell
Select-String -Path "$MigrationConfig","$BaselineConfig" -Pattern 'database_id|migrations_dir|migrations_pattern'
npx wrangler d1 migrations list $DatabaseBinding --remote --config "$MigrationConfig"
npx wrangler d1 migrations list $DatabaseBinding --remote --config "$BaselineConfig"
```

ผลที่ต้องได้:

- full config เห็น `0001_baseline.sql` และ `0002_schema_reconciliation.sql` เท่านั้น
- baseline config เห็น `0001_baseline.sql` เท่านั้น
- ห้ามเห็นชื่อจาก legacy `migrations/` แม้แต่ไฟล์เดียว
- prompt/output ต้องอ้าง database `tear-of-god-db` เท่านั้น

ถ้าผลต่างจากนี้ STOP ห้าม apply

## 7. Gate D — Baseline write

นี่คือ Production write แรก AI/operator ต้องหยุดและขอ approval แบบระบุคำสั่ง
exactly ก่อน execute ห้ามถือ approval ของ Gate A–C เป็น approval สำหรับ Gate D

ก่อนขอ approval ให้แสดง:

- identity summary
- preflight zero counts และ row-count snapshot
- B0 bookmark และ backup metadata โดยไม่เปิดเผยข้อมูลใน backup
- discovery outputs
- baseline SHA-256 และเนื้อหาสามบรรทัด ซึ่งต้องมีเพียง `SELECT 1`

คำสั่งที่จะรันหลังได้รับ approval เท่านั้น:

```powershell
npx wrangler d1 migrations apply $DatabaseBinding --remote --config "$BaselineConfig"
```

ห้ามใช้ `--yes` ตรวจ prompt ว่ามีเฉพาะ `0001_baseline.sql` ก่อนตอบยืนยัน

หลัง apply ใช้ read-only checks:

```powershell
npx wrangler d1 execute $DatabaseBinding --remote --config "$MigrationConfig" --json --command "SELECT id, name, applied_at FROM d1_migrations ORDER BY id"
npx wrangler d1 migrations list $DatabaseBinding --remote --config "$MigrationConfig"
```

Ledger ต้องมีเพียง `0001_baseline.sql` และ discovery ต้องเหลือเพียง
`0002_schema_reconciliation.sql`

รัน row-count baseline และ schema fingerprint จาก Section 4 ซ้ำ ผลต้องเหมือน
ก่อน baseline ทุกอย่าง ยกเว้น ledger ถ้า application schema/data/count เปลี่ยน
หรือ ledger ไม่ตรง ให้คง maintenance, STOP และห้ามแก้ ledger เอง

หลัง baseline ผ่าน ให้จับ bookmark read-only อีกครั้งและบันทึกเป็น
`B1_POST_BASELINE_PRE_RECONCILIATION`:

```powershell
npx wrangler d1 time-travel info tear-of-god-db --json --config "$MigrationConfig"
```

## 8. Gate E — Reconciliation write

ก่อน Gate E ต้อง rerun integrity queries ใน Section 4.3 ภายใต้ maintenance window
เพื่อป้องกัน drift ระหว่าง Gate A กับ reconciliation ทุก count ต้องยังเป็น 0 และ
row counts ต้องตรง snapshot หลัง baseline

นี่คือ Production write แยกจาก baseline ต้องหยุดและขอ approval ใหม่ โดยแสดง:

- ledger มี baseline เพียงรายการเดียว
- discovery มี reconciliation เพียงรายการเดียว
- fresh preflight ผ่าน
- B0 และ B1 พร้อมใช้งาน
- hash reconciliation ตรงกับค่าที่อนุมัติ

คำสั่งที่จะรันหลังได้รับ approval เท่านั้น:

```powershell
npx wrangler d1 migrations apply $DatabaseBinding --remote --config "$MigrationConfig"
```

ห้ามใช้ `--yes` ตรวจ prompt ว่ามีเฉพาะ
`0002_schema_reconciliation.sql` ก่อนตอบยืนยัน

Migration นี้ทำสามเรื่องเท่านั้น:

1. เพิ่ม FK `rankings.template_id → templates.id ON DELETE CASCADE` โดย
   `template_id` ยัง nullable
2. เปลี่ยน `templates.creator_id` เป็น `ON DELETE SET NULL`
3. เพิ่ม unique index `(ranking_id,item_id)` ใน `ranking_item_scores`

ถ้า Wrangler รายงาน failure ให้ไป Section 11.1 ห้าม retry

## 9. Post-migration database verification

ยังคง maintenance จนจบ Section 9–10

### 9.1 Ledger และ discovery

```powershell
npx wrangler d1 execute $DatabaseBinding --remote --config "$MigrationConfig" --json --command "SELECT id, name, applied_at FROM d1_migrations ORDER BY id"
npx wrangler d1 migrations list $DatabaseBinding --remote --config "$MigrationConfig"
```

Ledger ต้องเรียงเป็น baseline แล้ว reconciliation และ discovery ต้องไม่มี pending
migration

### 9.2 Data integrity

รัน integrity queries และ row counts จาก Section 4.3 ซ้ำ:

- orphan/duplicate/FK violation ทุกค่า = 0
- row count ของทุกตารางเท่ากับ snapshot ก่อน migration
- ห้าม query row-level user data

### 9.3 Schema semantics

```powershell
npx wrangler d1 execute $DatabaseBinding --remote --config "$MigrationConfig" --json --command "PRAGMA table_info(rankings); PRAGMA foreign_key_list(rankings); PRAGMA table_info(templates); PRAGMA foreign_key_list(templates); PRAGMA index_list(ranking_item_scores); PRAGMA index_info(idx_ranking_item_scores_ranking_item_unique)"
npx wrangler d1 execute $DatabaseBinding --remote --config "$MigrationConfig" --json --command "SELECT name, tbl_name, sql FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%' ORDER BY name"
```

ต้องยืนยันว่า:

- `rankings.template_id` มี `notnull = 0`
- FK ของ `rankings.template_id` ไป `templates.id` และ `on_delete = CASCADE`
- FK ของ `templates.creator_id` ไป `profiles.id` และ `on_delete = SET NULL`
- `idx_ranking_item_scores_ranking_item_unique` มี `unique = 1` และ column order
  เป็น `ranking_id`, `item_id`
- indexes เดิมครบ รวม extra indexes สามตัว
- `PRAGMA foreign_key_check` count = 0

ห้ามพิสูจน์ constraint ด้วยการ INSERT duplicate หรือ DELETE creator/template ใน
Production ให้ตรวจ metadata เท่านั้น

ถ้า post-check ใดไม่ผ่าน ให้ไป Section 11.2 ห้ามเปิด traffic

## 10. Application verification และ Gate F

### 10.1 Read-only smoke tests

ตรวจบน Production app โดยไม่เปลี่ยนข้อมูลก่อน:

- Home Feed โหลดรายการและรายละเอียด ranking ได้
- Login page โหลดและ invalid login แสดง error ปกติ
- Template detail โหลด tiers/items ได้
- Community Average แสดง aggregate ครบ
- Template participants, filters และ export preview ทำงาน
- Admin dashboard/list endpoints อ่านข้อมูลได้สำหรับ admin test account
- Forgot/reset password pages โหลดได้ แต่ยังไม่ submit จนได้รับ approval

ตรวจ browser console, Network responses และ Worker logs โดยห้ามคัดลอกข้อมูล
ส่วนตัวลง operation report

### 10.2 Mutation smoke tests

รายการต่อไปนี้เป็น Production writes และต้องมี approval แยกต่างหากก่อนเริ่ม:

- Login ที่สร้าง/ต่ออายุ session
- Create Ranking จากข้อมูลทดสอบที่อนุมัติ
- Rank existing Template
- Forgot password ซึ่งอาจสร้าง reset token และส่ง Brevo email
- Reset password ซึ่งเปลี่ยน credential/revoke sessions
- Admin mutation ใด ๆ
- การ cleanup test rows

ใช้เฉพาะ isolated test accounts/assets ที่เจ้าของระบบอนุมัติ บันทึก generated IDs
โดยไม่เปิดเผย token/password และห้าม cleanup อัตโนมัติ การ cleanup เป็น write อีก
ชุดหนึ่งที่ต้อง approval แยก หากไม่อนุมัติ mutation smoke ให้ทำใน staging ที่มี
schema เดียวกันแทนและบันทึกข้อจำกัดนี้ใน Gate F

### Gate F decision

เปิด traffic/จบ maintenance ได้เมื่อ database post-check และ smoke tests ที่ตกลง
ไว้ผ่านครบ เจ้าของระบบต้อง sign off หากไม่ผ่านให้คง maintenance และเข้าสู่
recovery decision ห้าม deploy hotfix หรือ restore โดยอัตโนมัติ

## 11. Abort และ recovery

### 11.1 Migration failed before commit

Wrangler ระบุว่า migration ที่ล้มจะถูก rollback และ successful migration ก่อนหน้า
ยังอยู่:

1. ไม่ retry และไม่แก้ migration SQL ระหว่าง incident
2. คง maintenance/write freeze
3. เก็บ error output โดยลบข้อมูลอ่อนไหวออกจากรายงาน
4. ตรวจ ledger, schema, row counts และ FK check แบบ read-only
5. ถ้า reconciliation ล้ม ledger ควรมี baseline เท่านั้น; ถ้า baseline ล้ม ledger
   ควรว่าง
6. เปรียบเทียบกับ B0/B1 และ operation snapshots
7. หยุดเพื่อ root-cause/rehearsal ใหม่

ไม่ต้อง restore หากยืนยันได้ว่า rollback สมบูรณ์ หากมี partial state หรือผลกำกวม
ให้ปฏิบัติตาม Section 11.2

### 11.2 Migration succeeded แต่ database post-check fail

1. คง maintenance และหยุด Production writes ทั้งหมด
2. ห้ามรัน down migration, manual DDL/DML หรือแก้ ledger แบบเดา
3. เก็บ metadata/error evidence และเลือก restore target:
   - B1: ย้อน reconciliation แต่คง baseline
   - B0: ย้อนทั้ง baseline และ reconciliation
4. ให้เจ้าของระบบอนุมัติ target และยอมรับว่าการ Time Travel restore จะ overwrite
   database in place และยกเลิก in-flight queries
5. หลัง approval สำหรับ destructive restore เท่านั้น จึงรันหนึ่งคำสั่ง:

```powershell
npx wrangler d1 time-travel restore tear-of-god-db --bookmark "<APPROVED_BOOKMARK>" --config "$MigrationConfig"
```

6. บันทึก `previous_bookmark` ที่ Wrangler คืนมา เพราะใช้ undo restore ได้
7. ตรวจ identity, ledger, schema, counts, FK check และ application read-only smoke
   ใหม่ก่อนเปิด traffic

ห้าม import SQL export ทับ database เดิมโดยตรง การใช้ export เป็น recovery source
ต้องมี restore rehearsal และ approval แยกหาก Time Travel ใช้ไม่ได้

### 11.3 Migration ผ่านแต่ application regression

1. คง maintenance และหยุด mutation smoke
2. ถ้า database checks ผ่าน ให้แยกก่อนว่าเป็น application/config issue หรือ schema
   incompatibility
3. ห้าม deploy code change ภายใต้ approval ของ migration นี้
4. ถ้าต้อง restore database ให้ใช้ Gate recovery ใหม่และเลือก B0/B1 ตามผลกระทบ
5. หากมี user writes หลัง bookmark ห้าม restore จนเจ้าของข้อมูลประเมิน data-loss
   impact และอนุมัติ เพราะ restore จะย้อน writes เหล่านั้นด้วย

## 12. Approval gates summary

| Gate | หลักฐานที่ต้องพร้อม | การอนุมัติครอบคลุม |
| --- | --- | --- |
| A | Identity, schema fingerprint, zero preflight, empty ledger | ไปเตรียม backup; ไม่อนุญาต write |
| B | Maintenance plan, B0 bookmark, verified export metadata/hash | ไปตรวจ discovery; ไม่อนุญาต write |
| C | Full discovery = 0001+0002, baseline discovery = 0001, hashes ตรง | พร้อมขอ baseline approval |
| D | หลักฐาน A–C และ exact baseline command | Production baseline write หนึ่งครั้งเท่านั้น |
| E | Baseline verified, B1, fresh preflight, discovery = 0002 | Production reconciliation writeหนึ่งครั้งเท่านั้น |
| F | DB post-check และ agreed smoke tests ผ่าน | เปิด traffic/ปิด maintenance |

Approval เพิ่มเติมที่ไม่รวมอยู่ใน A–F:

- Mutation smoke approval
- Test-data cleanup approval
- Time Travel restore approval โดยต้องระบุ B0 หรือ B1
- Deployment/hotfix approval

AI ต้องหยุดก่อนทุก approval ข้างต้นและห้ามนำ approval ของขั้นหนึ่งไปใช้กับอีกขั้น

## 13. Exact execution order

```text
1. Verify checkout, hashes, Wrangler version
2. Create/review one-purpose configs outside Git
3. Gate A: verify account → Pages → D1 name/UUID → binding
4. Run fresh read-only schema/integrity/count/ledger preflight
5. Decide and activate maintenance/write freeze
6. Gate B: capture B0 → export → verify file metadata/hash/ignore status
7. Gate C: full and baseline discovery; reject any legacy migration
8. STOP → approve Gate D → apply baseline interactively
9. Verify baseline ledger + unchanged schema/data → capture B1
10. Rerun fresh preflight
11. STOP → approve Gate E → apply reconciliation interactively
12. Verify ledger, discovery, counts, FK, constraints, indexes
13. Run read-only application smoke
14. STOP separately before any mutation smoke
15. Gate F: owner sign-off → end maintenance
16. Retain operation log, hashes and backup securely outside Git
```

## 14. Dry-run review result from Phase 3E

- Phase 3D active directory contains exactly the two approved migrations
- reconciliation active SQL matches the Phase 3C draft hash
- default `migrations/` remains untouched with 18 legacy migrations
- isolated Wrangler configs used in Phase 3D proved legacy migrations are not
  discovered when `migrations_dir`/`migrations_pattern` are explicit
- baseline is a three-line no-op marker containing only comments and `SELECT 1`
- local first run, second run, preflight failures and mid-migration rollback passed
- Production `wrangler.toml` is intentionally unchanged
- Phase 3E did not execute identity calls, Production SELECT/export/bookmark,
  migrations, restore or deployment

## 15. Remaining blockers before any Production write

- Account ID/name ยังต้องได้รับการยืนยันจากเจ้าของระบบใน Gate A
- Production Pages binding ต้องยืนยันใน Dashboard แบบ read-only
- ต้องสร้าง/review one-purpose Production configs ที่ Git ignore
- ต้องรัน fresh Production read-only preflight และ schema comparison
- ต้องตัดสินใจและเตรียม maintenance/write-freeze mechanism
- ต้องยืนยัน Time Travel support/retention และจับ B0
- ต้อง export backup และตรวจ metadata/hash
- ต้องผ่าน discovery Gate C บน Production ledger จริง
- ต้องได้รับ approval แยกสำหรับ Gate D และ Gate E
- ต้องตกลงว่าจะอนุญาต mutation smoke และ cleanup ใน Production หรือไม่

## References

- Cloudflare D1 Wrangler commands:
  https://developers.cloudflare.com/d1/wrangler-commands/
- Cloudflare D1 import/export:
  https://developers.cloudflare.com/d1/best-practices/import-export-data/
- Cloudflare D1 Time Travel and backups:
  https://developers.cloudflare.com/d1/reference/time-travel/
