# Browser QA — 9 ตุลาคม 2026

**ผ่าน 32/32 scenarios** บน Chrome 154.0.8037.98 (headless/CDP) ที่ `http://127.0.0.1:8799`, ใช้ Vite production build + Wrangler Pages Functions และ D1/R2 Local แยกใน `.wrangler/browser-qa-2026-10-09/state`. ก่อนสร้างบัญชี harness ยืนยันด้วย marker ว่า server ใช้ isolated D1 จริง. สองบัญชีใช้ browser contexts แยกกัน.

## ผลตรวจ

| ส่วน | ผล |
|---|---|
| Discover | Popular/New/In conversation ผ่าน; loading skeleton; response เก่าไม่ทับ tab ใหม่; จำลอง 503 แล้ว retry ทั้งสาม tab; empty list ไม่เหลือการ์ดเก่า; เปลี่ยนหน้าเมื่อ request ค้าง; activity windows ทั้งสี่; แสดงชื่อ item ที่อ้างผ่าน ID |
| Discover layout | 320/390/768/1440px: ไม่มี page/tile overflow, การ์ด 1:1, grid 1/1/2/4 columns ตามขนาดหน้าจอ; ตรวจ screenshots desktop/mobile เพิ่มเติม |
| Profile pagination | เคส 0/1/3/20/49/50/51/100 โพสต์ตรงจำนวนจริง; ไม่มีรายการซ้ำหลัง append; ปุ่ม Next จบตรงจำนวนโพสต์; 51 และ 100 โหลดหน้า 2 ได้ |
| Profile pinned/user switching | โพสต์ปักหมุดลำดับเก่าที่อยู่นอก 50 แรกโหลดเพิ่มได้, ขึ้นก่อนรายการอื่น และ Pinned tab แสดงเฉพาะโพสต์นั้น; response หน้า 2 ของเจ้าของเก่าไม่เข้าหน้าผู้ใช้อีกคน |
| Profile layout | 320/390/768/1024/1440px: ไม่มี page/tile overflow, grid 1/1/2/3/4 columns; ดู screenshots ทั้งโปรไฟล์และการ์ด tier จริง |
| Comments | สร้าง/ตอบ/ลบผ่าน UI จากสองบัญชี; อีกบัญชีอัปเดตโดยไม่ refresh; ตัวนับใน UI ทั้งสองหน้าตรง API เป็น 0→1→2→1→0; draft ค้างไม่หายระหว่าง polling; parent/reply เก็บถูกต้อง |
| Notifications/permissions | Badge อัปเดตขณะเมนูปิด; แจ้งผู้รับถูกคน; ลบ notification แล้ว refresh ยังหาย; API ปฏิเสธลบคอมเมนต์ของอีกบัญชีด้วย 403; ลบ parent แล้วยังเก็บ reply ของอีกคน; ลบ comments แล้ว associated notifications หายตามและไม่กลับมาหลัง refresh |

ไม่พบ uncaught browser runtime errors. ในรอบสุดท้ายคอมเมนต์ใหม่มาถึงอีกบัญชีประมาณ **9.56 วินาที**; reply มาถึงประมาณ **0.31 วินาที** เพราะอยู่ใกล้รอบ polling. เวลาเหล่านี้เป็นผลวัดหนึ่งรอบ ไม่ใช่การรับประกัน latency; scheduler ตั้งไว้ 10 วินาทีเมื่อหน้ามองเห็น.

## ปัญหาที่พบและแก้

รายการ `/api/templates` เคยคืน `item.name = template_items.item_id` เสมอ ทำให้ Discover แสดงรหัสภายในเมื่อ item อ้างด้วย ID แม้หน้า detail จะ JOIN ชื่อได้ถูกต้อง. แก้ preview query เดิมให้ LEFT JOIN `items` ด้วย primary key และคืนชื่อ/รูปจริง. Legacy rows ที่ใช้ชื่อใน `item_id` ยัง fallback เป็นชื่อนั้นตามเดิม. ไม่เพิ่มจำนวน SQL statements และยังจำกัด preview ตามเดิม.

เพิ่ม regression ใน `tests/local/template-discover-preview.mjs` ตรวจทั้ง canonical ID/name/image และ legacy name-only row. Browser harness ตรวจชื่อจริงที่แสดงใน DOM เพิ่มด้วย.

## Checks หลังแก้

- Standalone source/Miniflare checks: **91/91 ผ่าน** หลังเปลี่ยน query.
- Browser QA ชุดนี้: **32/32 ผ่าน**, ใช้ build ล่าสุด.
- `npm run build`: ผ่าน.
- `npm run lint`: ผ่าน มี Fast Refresh warnings เดิม 4 จุด.
- `git diff --check`: ผ่าน.

ผลละเอียดกับ screenshots อยู่ใน `.wrangler/browser-qa-2026-10-09/` ซึ่ง gitignored. ไม่มีภาพหรือข้อมูล QA เพิ่มเข้า Git. วิธีรันซ้ำอยู่ใน [local-browser-qa.md](local-browser-qa.md).

## ขอบเขต

ผลในเอกสารนี้ครอบคลุมสามส่วนตามคำขอด้วย fresh local schema และ Chrome emulation. ยังไม่ได้ตรวจ Safari/Firefox/มือถือจริง, hidden/offline resume, ทุก admin/duel flow หรือ migration rehearsal. Browser harness อื่นใน repo ที่มี setup เฉพาะไม่ได้ถูกนับว่ารันผ่านจากผลชุดนี้. หลังรอบ Local นี้ commit `a490aad` และ deploy ผ่าน Preview QA ก่อนขึ้น Production พร้อม Smoke Test แล้ว; ผล remote integration และข้อจำกัดเพิ่มเติมอยู่ใน [release-audit-2026-10-09.md](release-audit-2026-10-09.md).
