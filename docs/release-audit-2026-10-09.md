# ปิด Audit และ Deploy — 9 ตุลาคม 2026

**เสร็จตามลำดับ Commit → Cloudflare Preview QA → Production → Smoke Test.** โค้ดที่ deploy คือ commit `a490aadba8d46b9aad79e700ed2328e72b66e1b1` บน branch `codex/check`; Production Pages ใช้ branch `master` ตามค่าของ project. ไม่ได้ merge หรือ push branch เข้า GitHub ในรอบนี้.

## ผลตรวจและ deployment

| ขั้นตอน | ผล |
|---|---|
| ตรวจ Git ก่อน commit | ตรวจ status/diff และ staged source 29 ไฟล์ พร้อมการถอน 7 ไฟล์; staged secret/path scan และ diff whitespace check ผ่าน; ไม่มีไฟล์ลับ ภาพ screenshots หรือ QA outputs เพิ่มเข้า Git |
| Standalone checks | 91/91 ผ่าน; สามชุดที่เคยล้มถูกแก้โดยรักษา pagination และ SQL budget เดิม |
| Comments SQL | fixture เดิมลด 9 → 7 statements; เกณฑ์ยังเป็น 8 |
| Local Browser QA | 32/32 scenarios ผ่านบน Chrome 154.0.8037.98; รายละเอียดใน [browser-qa-2026-10-09.md](browser-qa-2026-10-09.md) |
| Build / Lint | ผ่าน; Lint มี Fast Refresh warnings เดิม 4 จุด |
| Cloudflare Preview | ผ่านทั้ง 6 กลุ่มตรวจจริงกับ Pages Functions + remote D1 และการทดสอบ R2 แยก |
| Production Smoke | ผ่านทั้ง 9 กลุ่มตรวจ API/Chromium และ public R2; ไม่มี uncaught runtime errors |

- Preview: [audit-20261009.tear-of-god.pages.dev](https://audit-20261009.tear-of-god.pages.dev); deployment [0c72707f](https://0c72707f.tear-of-god.pages.dev).
- Production: [tear-of-god.pages.dev](https://tear-of-god.pages.dev); deployment [00af7dc9](https://00af7dc9.tear-of-god.pages.dev), ID `00af7dc9-5bbf-4c99-877b-92fe3168d6b5`. Cloudflare แสดง Environment `Production`, branch `master`, source `a490aad`.
- Deployment ก่อนหน้าเก็บเป็นจุด rollback: `7f69311d-cbb5-42bb-86a7-5c835dbe0a33`, source `2c45c61`, [deployment เดิม](https://7f69311d.tear-of-god.pages.dev). ไม่ได้ทำ rollback ในรอบนี้.

## Preview และการเชื่อม D1/R2

พบว่า Preview D1 ID เดิม `4be4342e-f7e4-4d1b-9cbf-35f222b77f24` ไม่มีอยู่แล้ว (Cloudflare 7404). สร้างฐานข้อมูล `tear-of-god-preview` ใหม่ใน APAC, ID `b9b30fbb-8d5f-4d74-8834-7e1207161737`, ผูก binding `tear_of_god_db` และ apply `schema.sql` เฉพาะฐาน Preview ใหม่นี้. อัปเดต `wrangler.toml` พร้อม APP_URL ของ Preview. ดาวน์โหลด project config หลัง deploy เพื่อตรวจ binding ที่ Cloudflare ใช้จริง.

Production ยังคงใช้ D1 `69d366f1-55ba-43cf-a492-882e137786f4` และ R2 `tear-of-god`; Preview ใช้ D1 ใหม่กับ R2 `tear-of-god-preview`. ไม่มี migration/seed ของ Production ในรอบนี้.

Preview Browser QA ใช้สองบัญชี synthetic `@example.test` คนละ browser context และตรวจ:

- Register/login และสร้าง template/ranking ที่อ่านกลับจาก remote D1 ได้.
- Discover: Popular/New/In conversation, loading จบโดยไม่มี error, layout 390/1440px.
- Profile: ว่าง/หนึ่งโพสต์, pin และ Pinned tab, pin หลัง refresh, สลับผู้ใช้, layout 390/1440px.
- Comments: สร้าง/ตอบ/ลบผ่าน UI; อีกบัญชีอัปเดตโดยไม่ refresh; UI/API counters 0→1→2→1→0; draft ค้างยังอยู่; ปฏิเสธลบของผู้อื่นด้วย 403; ลบ parent แล้วยังเก็บ reply; ข้อมูลหลัง refresh ตรงกัน.
- Notifications: badge และผู้รับถูกต้อง; ลบแจ้งเตือนแล้ว API ยืนยันว่าหาย; เมื่อลบคอมเมนต์ associated notifications หายตาม.
- R2: PUT/GET เทียบ SHA-256 และ DELETE เฉพาะ object probe ที่สร้างใน bucket Preview ผ่าน. เว็บตอบ 503 `Uploads are disabled in Preview` ตาม `PREVIEW_UPLOADS_ENABLED=false`; ไม่ได้เปิดอัปโหลดเพื่อทดสอบ.

วัดคอมเมนต์ใหม่มาถึงอีกบัญชี 9.27 วินาที และ reply 0.62 วินาทีในรอบนี้. เป็นผลหนึ่งรอบของ polling ทุก 10 วินาทีเมื่อหน้ามองเห็น ไม่ใช่ SLA. เก็บบัญชีและ template/ranking synthetic ไว้เฉพาะ Preview เพื่อใช้ตรวจซ้ำ; คอมเมนต์และ associated notifications ของ QA ถูกลบครบ.

## Production Smoke Test

ตรวจทั้ง alias หลักและ deployment URL ว่า HTML ตรงกับ `dist/index.html` และ JavaScript asset โหลดได้. API auth, templates (ชื่อ item), rankings, hashtags และ Pulse ทั้งสี่ช่วงเวลาตอบสำเร็จ. Profile อ่านผู้ใช้/โพสต์หน้าแรกได้; Comments อ่านรายการและ canonical counter ตรงกับ ranking detail. Guest อ่าน notifications และ POST comments ถูกปฏิเสธด้วย 401.

Chromium ตรวจ Discover ทั้งสาม tab, View All ที่ใช้การ์ดเดียวกัน, public Profile จำนวนโพสต์ตรง API และหน้า Post/Comments ตัวนับตรง API; layout 390/1440px ไม่มี page overflow. อ่านรูป public ที่มีอยู่ใน Production R2 ด้วย HEAD ได้ 200 และ `image/jpeg`. ไม่สร้างบัญชี QA, ไม่เขียนคอมเมนต์ QA และไม่เขียน/ลบ object ใน Production.

## ข้อจำกัดที่ยังไม่ได้ตรวจ

- Safari/Firefox และมือถือจริง; responsive checks ใช้ Chrome viewport emulation.
- Hidden/offline resume บน browser.
- Admin/Duel end-to-end; API regression ที่ผ่านไม่ได้ทดแทนการตรวจทุก UI flow.
- Production logged-in mutations: ตรวจสร้าง/ตอบ/ลบและ notifications จริงบน Preview เท่านั้น; Production รอบนี้เป็น smoke ของการอ่านและ guest authorization.
- Upload ผ่าน Worker → R2 จริงยังไม่ได้ตรวจใน Preview เพราะปิด uploads ตาม policy. ตรวจ binding และ bucket read/write ผ่าน CLI; Production ตรวจเฉพาะรูป public ที่มีอยู่.
- Google OAuth, การส่ง email/reset code จริง และ migration rehearsal ไม่ได้รวมในรอบ release นี้. Preview ใช้ fresh schema จึงไม่ยืนยันการย้ายฐานเก่าทุกกรณี.
- Browser/integration harnesses อื่นที่ต้อง setup เฉพาะไม่ได้ถูกนับว่าผ่านจาก 91 standalone checks หรือ Browser QA 32 scenarios.

ผลละเอียด, downloaded config, probe, screenshots และ scripts สำหรับ release อยู่ใน `.wrangler/release-audit-2026-10-09/` ที่ gitignored. รายงานนี้เก็บเฉพาะผลตรวจและ metadata ของ deployment; ไม่เก็บ credentials/session cookies หรือข้อมูล QA ส่วนตัวใน Git. Commit ปิดรายงานเป็น documentation เท่านั้น; artifact ที่ deploy ยังคงอ้าง source `a490aad`.
