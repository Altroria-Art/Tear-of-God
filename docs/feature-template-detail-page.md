# Feature: Template Detail Page

> อ่านไฟล์นี้ก่อนลงมือทุกครั้งที่มีคนสั่งงานเกี่ยวกับหน้า **Template Detail** (`/template/:templateId`) —
> ไม่ว่าจะเป็นการแก้บั๊ก เพิ่มฟีเจอร์ย่อย หรือปรับดีไซน์ในหน้านี้

## 1. ขอบเขต

หน้า `/template/:templateId` แสดงรายละเอียดของ template หนึ่งอัน ประกอบด้วย 3 ส่วนหลัก:

1. **หัวเรื่อง** — ชื่อ, เจ้าของ, badge Uses/Views, ปุ่ม Use Template, คำอธิบาย
2. **Community Average** — tier list ที่คำนวณเฉลี่ยจากทุกคนที่เคยใช้ template นี้ ปักไว้บนสุดเสมอ
3. **Community Rankings** — tier list ของแต่ละคนที่ใช้ template นี้ พร้อม sort (Recent / Most Liked) และแบ่งหน้า 5 อันต่อหน้า

จุดเข้าหน้านี้: กด**ชื่อ** หรือ**รูป preview tier** บนการ์ด `TemplateCard` (หน้า Discover) — ปุ่ม "Use Template" ไม่ใช่ลิงก์เข้าหน้านี้ (มันพาไป `/rank?template=` เพื่อสร้าง ranking ใหม่)

## 2. Functional Requirements

| ID | Requirement | รายละเอียด | Actor |
|---|---|---|---|
| FR-T1 | View Template Detail | ดูชื่อ, เจ้าของ, description, Uses, Views ของ template | Guest, User |
| FR-T2 | View Community Average | ดู tier list เฉลี่ยที่คำนวณจากทุก ranking ที่ผูก template นี้ | Guest, User |
| FR-T3 | Browse Community Rankings | ดู tier list ของแต่ละคน แบ่งหน้า 5 อัน/หน้า พร้อมเลือก sort Recent / Most Liked | Guest, User |
| FR-T4 | Vote on a Ranking | กด like/dislike การ์ด ranking แต่ละใบ บันทึกลง D1 จริง | User (ต้อง login) |
| FR-T5 | Count Template View | นับ view ให้ template — **นับครั้งแรกที่แต่ละ account เปิดเท่านั้น** | User (ต้อง login) |
| FR-T6 | Use Template | กดปุ่ม Use Template ไปหน้า `/rank?template=` เพื่อจัด tier list ใหม่จาก template นี้ | User (ต้อง login) |

## 3. Uses / Views — นับยังไง (สำคัญ อย่าสับสน)

| ตัวเลข | สูตร | ที่มา |
|---|---|---|
| **Uses** | `COUNT(*) FROM rankings WHERE template_id = ?` — นับสดทุกครั้งที่เรียก API **ไม่ใช่ค่าที่ seed ไว้** | คนเดิมใช้ template ซ้ำ → นับเพิ่มทุกครั้ง (นับจำนวน ranking ไม่ใช่จำนวนคน) |
| **Views** | `templates.view_count`, บวกผ่าน `POST /api/templates` | นับแค่ **ครั้งแรก** ที่แต่ละ `user_id` เปิดหน้านี้ กลไก: ตาราง `template_views` มี `PRIMARY KEY (template_id, user_id)` → `INSERT OR IGNORE` ครั้งแรกจะ insert สำเร็จ ครั้งต่อไปโดน ignore เงียบๆ |

⚠️ ไม่ได้ใช้คอลัมน์ `templates.use_count` ที่ seed ไว้ตอนแรก (15.2k, 8.8k, …) แล้ว — คอลัมน์นั้นยังอยู่ใน schema เฉยๆ ไม่ถูกอ่าน/เขียนอีกต่อไป ตัวเลขที่โชว์ทุกที่ (Discover, Template Detail) เป็นเลขสดทั้งหมด

**คนที่ไม่ได้ login**: เข้าหน้านี้ได้ปกติ อ่านได้ทุกอย่าง แต่ **ไม่นับ view** (เช็ค `!currentUser` ก่อนยิง `recordTemplateView`) และกด vote/Use Template ไม่ได้ — ขึ้น `alert()` บอกให้ไป login ก่อน (ยังไม่ทำ popup สวยๆ)

## 4. สูตร Community Average

รองรับ template ที่มีจำนวน tier ไม่เท่ากันและชื่อ tier ไม่ใช่ S/A/B/C/D (เช่น `tmpl_011` Soulslike ใช้ 4 tier: โคตรโหด/ยาก/กำลังดี/ง่ายไป)

```
N = จำนวน tier ของ template (จาก templates.tiers)
tier ลำดับที่ i (0 = บนสุด/ดีที่สุด) → คะแนน = N - i
```
ตัวอย่าง 5 tier: S=5, A=4, B=3, C=2, D=1 · ตัวอย่าง 4 tier (Soulslike): โคตรโหด=4, ยาก=3, กำลังดี=2, ง่ายไป=1

```
avg(item) = Σ(คะแนน tier ที่โดนจัด × จำนวนครั้ง) / Σ(จำนวนครั้งทั้งหมด)
tier ที่จะโชว์ = N - round(avg)   (clamp ให้อยู่ในช่วง 0..N-1)
```

**กติกา:**
- `ranking_items.tier IS NULL` (ไอเทมที่ถูกปล่อยไว้ใน Unranked Pool) **ไม่นับเข้าค่าเฉลี่ยเลย** — ไม่ใช่ tier ต่ำสุด แค่ไม่มีข้อมูล
- ถ้า `tier` label ในข้อมูล ranking ไม่ตรงกับ label ใดใน `templates.tiers` ปัจจุบัน (เช่น template แก้ชื่อ tier ไปแล้วหลังมีคนจัดไปแล้ว) → **ข้ามแถวนั้น** ไม่ใช่ crash
- ภายใน tier เดียวกัน เรียงไอเทมด้วย `avg` มาก→น้อย
- คำนวณด้วย SQL query เดียว (`GROUP BY item_id, tier`) แล้วเอาผลมาประมวลใน JS — **ห้ามดึง ranking ทั้งหมดมาวนคำนวณ** (ดูข้อ 6)

โค้ดจริง: `functions/api/templates.js` ฟังก์ชัน `onRequestGet` โหมด detail (บรรทัดคอมเมนต์ "Community Average")

## 5. API Contracts

### `GET /api/templates?id=<id>`
```
{ success, data: {
    id, title, description, category, hashtags,
    tiers: [{ label, color }],
    profile: { username, avatar_url },
    stats: { uses, views },            // ทั้งคู่นับสด ไม่ใช่ค่า cache
    template_items: [{ id, template_id, item_id, tier, position, item }],
    community_average: {
      updated_at,                       // MAX(created_at) ของ ranking ที่ผูก template นี้
      tiers: [{ label, color, items: [{ name, avg }] }]
    } | null
} }
```
**ไม่มี `rankings` หรือ `comments` ใน response นี้แล้ว** (ตัดออกเพราะเป็นต้นเหตุ query ไม่มีขอบเขต — ดูข้อ 6) — รายการ Community Rankings ต้องดึงแยกจาก `GET /api/rankings`

### `GET /api/rankings?template_id=<id>&sort=<liked|recent>&page=<n>&limit=<n>`
```
{ success, data: [...rankings...], page, limit, total }
```
`sort` ไม่ใส่ = default `recent` (`ORDER BY created_at DESC`) · `sort=liked` = `ORDER BY likes_count DESC, created_at DESC`
พารามิเตอร์นี้ใช้ร่วม endpoint เดิมของ Home Feed ได้ (ไม่กระทบ query อื่นที่ไม่ส่ง `template_id`)

### `POST /api/templates`
```
body: { template_id, user_id }
→ { success, counted: boolean }   // counted=false แปลว่า user คนนี้เคยเปิดแล้ว ไม่ถูกนับซ้ำ
```

Client wrappers: `src/lib/api.js` — `fetchTemplate(id)`, `fetchRankings({templateId, sort, page, limit})`, `recordTemplateView(id, userId)`, `voteRanking({rankingId, userId, voteType})`

## 6. ข้อควรระวัง — ลิมิต 100 bound params ของ D1

**ปัญหาเดิม (แก้แล้ว แต่ต้องรู้ไว้กันพลาดซ้ำ):** โค้ดเวอร์ชันก่อนหน้าดึง ranking *ทั้งหมด* ของ template (ไม่มี `LIMIT`) แล้วเอา id มายัดลง `IN (?,?,?,...)` เพื่อ batch query — ถ้า template ไหนมี ranking เกิน 100 อัน query จะ error ทันที (D1 จำกัด bound params ต่อ query ไว้ที่ 100)

**หลักที่ใช้ตอนนี้:**
- `stats.uses` และ `community_average` คำนวณด้วย `WHERE ranking_id IN (SELECT id FROM rankings WHERE template_id = ?)` — เป็น subquery ใน SQL ตัวเดียว **1 bound param เสมอ** ไม่ว่าจะมี ranking กี่พันอัน
- รายการ Community Rankings ที่โชว์จริงบนหน้าเว็บ **ต้องมี `LIMIT`/`OFFSET` เสมอ** (มาจาก pagination หน้าละ 5) → `IN (...)` ที่ใช้ query `ranking_items`/`votes` ของหน้านั้นๆ จะมีแค่ ≤ limit ids เท่านั้น
- ถ้าจะเพิ่ม query ใหม่ที่ต้องดึงหลาย ranking พร้อมกัน **ห้ามลืม LIMIT** — เช็คด้วย `SELECT COUNT(*)` ก่อนว่าตัวเลขจะไม่มีทางเกิน 100 ในทุกกรณี ไม่ใช่แค่กับข้อมูลทดสอบตอนนี้

## 7. ไฟล์ที่เกี่ยวข้อง

| ไฟล์ | บทบาท |
|---|---|
| `functions/api/templates.js` | `GET` (list + detail), `POST` (นับ view) |
| `functions/api/rankings.js` | `GET` list branch — `template_id`/`sort`/`page`/`limit` |
| `src/lib/api.js` | client wrapper functions |
| `src/lib/format.js` | `formatCount` ("15.2k"), `timeAgo` ("2 days ago") — ใช้ร่วมกันทั้งแอป อย่า copy-paste ซ้ำ |
| `src/pages/TemplateDetailPage.jsx` | หน้าหลัก |
| `src/components/template/TemplateCard.jsx` | การ์ดบน Discover — มี `<Link to="/template/:id">` ที่ชื่อและรูป preview |
| `migrations/0002_template_views.sql` | เพิ่ม `view_count` + ตาราง `template_views` (additive, ปลอดภัยกับ production) |
| `scripts/gen-community-seed.mjs` → `community-rankings-seed.sql` | ข้อมูล seed ของ community rankings/votes/comments (deterministic, รันซ้ำได้) |

## 8. กับดักที่เจอมาแล้ว อย่าทำซ้ำ

- **`migrations/0001_templates_tiers.sql` มี `DROP TABLE`** — เป็น migration ครั้งเดียวที่รันไปแล้วทั้ง local/production ห้ามรันซ้ำ (จะล้างข้อมูล templates ทั้งหมด) `package.json` เก็บไว้เป็น `db:migrate:0001` แยกจาก `db:migrate` ปกติโดยเจตนา — อย่าเผลอรวมกลับเข้าไปใน flow ที่รันทุกครั้ง
- **ช่องคอมเมนต์ระดับ template ถูกตัดออกจากหน้านี้แล้ว** เพราะของเดิมเขียนคอมเมนต์ด้วย `ranking_id = templateId` ซึ่งไม่มีจริงในตาราง `rankings` ทำให้คอมเมนต์หายทุกครั้งที่รีเฟรช — ถ้าจะเพิ่มคอมเมนต์ระดับ template กลับมาใหม่ ต้องเพิ่มคอลัมน์ `comments.template_id` จริงๆ ก่อน (ดู "นอกขอบเขต" ในแผนที่เกี่ยวข้อง) ไม่ใช่เอา field เดิมมาใช้ผิดความหมาย
- **สี tier และชื่อ tier ต้องอ่านจาก `template.tiers` เสมอ** ห้าม hardcode แม็ป S/A/B/C/D อีก — ทุก component ที่เกี่ยวกับ tier ในหน้านี้ (`TierListRow`) รับ `tier: {label, color}` เป็น prop ไม่ใช่ตัวอักษรเดี่ยวๆ
- `ranking_items.tier` ที่เป็น `NULL` ต้อง**ไม่**ถูกแปลงเป็น tier แรกอัตโนมัติ (บั๊กเดิมของโค้ด: `const tier = ri.tier || 'S'`) — โค้ดใหม่ข้ามแถวที่ `tier` เป็น falsy ไปเลย ทั้งตอนโชว์รายการ ranking และตอนคำนวณ community average
