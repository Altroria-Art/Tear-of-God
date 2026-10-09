# Trending refresh release — 9 ตุลาคม 2026

ขึ้น Production แล้วที่ [tear-of-god.pages.dev](https://tear-of-god.pages.dev), deployment [abc1a045](https://abc1a045.tear-of-god.pages.dev), ID `abc1a045-ae8a-44a9-9870-3268c1ffa408`. Cloudflare ยืนยัน environment Production, branch `master`, source `518aee0`.

โค้ดใน `38cd621` แก้ Trending ที่เก็บโพสต์อ่านแล้วระหว่าง refresh, การนับการ์ดสูงว่าอ่านแล้ว, คิว refresh เมื่อกดรัว, retry error และตัวแปรแจ้งผลที่ไม่ถูกประกาศ. รวมภาพแบรนด์ใหม่กับ hashtag suggestions มหาลัยที่ผู้ใช้ขอไว้ก่อนหน้า. `518aee0` แก้ Preview D1 binding. ไม่ได้ push/merge เข้า GitHub.

## การตรวจ

- Build/lint ผ่าน; Fast Refresh warnings เดิม 4 จุด. ตรวจ staged source 18 ไฟล์และ config แล้ว ไม่พบ secrets หรือ tracked QA outputs; PNG ที่เปลี่ยนคือ product asset `public/og-default.png`.
- Local Browser QA ของ Trending ผ่าน 7/7; รายละเอียดใน [local-browser-qa.md](local-browser-qa.md). Regression visibility/refresh, all-seen, persisted history และ cursor/cache ผ่าน.
- Preview [da7d9548](https://da7d9548.tear-of-god.pages.dev), alias [audit-20261009](https://audit-20261009.tear-of-god.pages.dev): ตรวจ HTML/JS/brand assets ตรงกับ build, D1 API, Discover/รายการทั้งหมด, Profile, Comments อ่าน/counter, guest authorization และ Trending refresh/F5/responsive ผ่าน ไม่มี runtime errors. ไม่มี public R2 media ใน Preview จึงข้ามการอ่านรูป R2 ใน environment นี้.
- Production smoke ผ่าน 11 กลุ่มตรวจ: รวมรายการข้างต้นและอ่านรูป public R2 เดิมได้ HTTP 200 `image/jpeg`. กด refresh 20 ครั้งได้สองคำขอเรียงต่อกัน, มี request พร้อมกันสูงสุดหนึ่ง, เอาโพสต์อ่านแล้วออก และ F5 จำประวัติได้. ตรวจ layout 390/1440px และไม่มี runtime errors.

Preview deploy ครั้งแรกไม่ผ่านเพราะ D1 `b9b30fbb-8d5f-4d74-8834-7e1207161737` ไม่มีอยู่แล้ว. สร้าง Preview D1 ใหม่ `7e770de5-77ed-4e4a-927c-74b0708039bf` ใน APAC, apply schema และเพิ่ม 60 โพสต์ synthetic เฉพาะ Preview สำหรับตรวจ. Production D1/R2 bindings เดิมไม่ได้เปลี่ยน; ไม่ migrate/seed Production ไม่สร้างบัญชีหรือเขียนคอมเมนต์ QA และไม่เขียน object R2 Production.

Deployment ก่อนหน้านี้สำหรับ rollback: [00af7dc9](https://00af7dc9.tear-of-god.pages.dev), ID `00af7dc9-5bbf-4c99-877b-92fe3168d6b5`. ไม่ได้ rollback.

## ขอบเขต

ตรวจด้วย Chrome 154 headless; ไม่ได้ทดสอบ Safari/Firefox, มือถือจริง, hidden/offline resume, Admin/Duel, Google OAuth/email reset หรือ logged-in mutations รอบนี้. ประวัติโพสต์อ่านแล้วมี cooldown เดิม 6 ชั่วโมง; การ์ดที่ยังไม่อ่านยังอาจอยู่ต่อหลัง refresh. หลักฐาน/scripts/screenshots อยู่ใน `.wrangler/refresh-release-2026-10-09/` ซึ่ง gitignored. รายงานนี้เป็น documentation หลัง deploy; artifact ที่ deploy อ้าง source `518aee0`.
