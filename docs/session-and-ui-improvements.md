# Session และการปรับหน้าใช้งาน — 11 กันยายน 2026

## สิ่งที่เปลี่ยน

- Discover ค้นหาชื่อ คำอธิบาย และแฮชแท็กผ่าน API พร้อม pagination, empty state และ retry; ปุ่ม Use Template ของผู้เยี่ยมชมไป Login แล้วกลับมายัง Template เดิม
- บันทึก Template ไว้ในบัญชีผ่าน `template_bookmarks` และเปิดรายการที่บันทึกจาก Discover หรือ sidebar
- Create/Rank ใช้ปุ่มแตะไอเทมเพื่อเลือก Tier, ปุ่มเรียงซ้าย/ขวา และ Undo/Redo การเปลี่ยนไอเทมได้สูงสุด 50 ครั้ง พร้อมแถบความคืบหน้าและ Publish ที่ด้านล่าง
- Rank เก็บ draft แยกตามผู้ใช้และ Template ใน localStorage ตรวจชุดไอเทม/นิยาม Tier ก่อนกู้คืน และย้าย draft ของ guest มาต่อหลัง Login; ประวัติ Undo เริ่มใหม่เมื่อรีโหลด
- Login แสดงฟอร์มทันทีบนมือถือ ฟอร์มที่ซ่อนอยู่ไม่รับโฟกัส; Modal รองรับ Escape, Tab และคืนโฟกัสเมื่อปิด
- Feed อ่านชื่อไอเทมได้เต็มขึ้น ลดเงาและแสงเรืองของ Tier; Kindred สำหรับ guest แสดงคำเชิญ Login เพียงส่วนเดียว; ปรับระยะห่างใน Template Detail/Community Average และแก้ลิงก์ผู้สร้างให้ใช้รหัสโปรไฟล์จริง

## Auth และข้อมูลเดิม

`functions/api/_middleware.js` อ่าน cookie `tog_session` แล้วตรวจ `auth_sessions` ก่อนส่งผู้ใช้ที่ยืนยันแล้วให้ endpoint ทุกการเขียนข้อมูลใช้ `context.data.user.id` แทน ID จาก client ส่วน admin ตรวจ role ปัจจุบันจาก D1 อีกครั้ง

Session มีอายุ 7 วัน เก็บเฉพาะ SHA-256 ของ token ในฐานข้อมูล Cookie ใช้ HttpOnly, SameSite=Lax และ Secure เมื่อใช้ HTTPS ตรวจ Origin/Fetch Metadata สำหรับการเขียนข้อมูลและกำหนด JSON Content-Type ยกเว้น multipart upload ข้อมูลเฉพาะบัญชีไม่ถูก cache ร่วมกัน Logout ลบ session ที่เซิร์ฟเวอร์ และการเปลี่ยนรหัสผ่านต้องยืนยันรหัสเดิมพร้อมยกเลิก session เก่า

รหัสผ่านใหม่ใช้ PBKDF2-SHA256 100,000 รอบพร้อม salt แยกแต่ละบัญชี รหัส SHA-256 เดิมยังล็อกอินได้และถูกอัปเกรดหลังยืนยันสำเร็จ จำกัดการลอง auth ที่ 20 ครั้งต่อ IP และตัวระบุบัญชีในช่วง 15 นาที การเปลี่ยนครั้งนี้ทำให้ผู้ที่เคยล็อกอินด้วยข้อมูล localStorage ต้องล็อกอินใหม่

Google sign-in ส่ง Firebase ID token ให้ backend ตรวจผ่าน [Firebase accounts:lookup](https://firebase.google.com/docs/reference/rest/auth#section-get-account-info) โดยไม่เชื่อ email/uid ที่ client ส่งเอง ค่า Firebase สาธารณะอยู่ใน `src/lib/firebaseConfig.js` ไม่มีการเพิ่ม `VITE_*` หรือ dotenv

**ไม่ได้ทำระบบลืมรหัสผ่าน ตามขอบเขตที่ผู้ใช้กำหนด**

## การนำไปใช้

ใช้ migration แบบเพิ่มตาราง ไม่มีการล้างบัญชีหรือเปลี่ยนรหัสผ่านเดิมทั้งฐานข้อมูล สำหรับฐานข้อมูลที่มีอยู่แล้ว ให้รันก่อนใช้โค้ดเวอร์ชันนี้:

```powershell
npx wrangler d1 execute tear-of-god-db --local --file=./migrations/0012_auth_sessions.sql
npx wrangler d1 execute tear-of-god-db --local --file=./migrations/0013_template_bookmarks.sql
npm run build
npx wrangler pages dev dist --local
```

ฐานข้อมูลใหม่ใช้ `schema.sql` ซึ่งรวมตารางใหม่แล้ว หน้าเว็บต้องใช้ Pages Functions เพื่อคืนสถานะ session; `npm run dev` ของ Vite อย่างเดียวไม่มี API ที่จำเป็น

ก่อน deploy จริง ต้องใช้ migration ทั้งสองกับ D1 ของ environment ปลายทางโดยเปลี่ยน `--local` เป็น `--remote` แล้วจึง deploy โค้ด **งานรอบนี้ใช้เฉพาะฐานข้อมูลในเครื่อง ไม่ได้ migrate remote หรือ deploy**

## การตรวจสอบ

- `npm run build` และ `npm run lint`; lint ไม่มี error และยังมี warning เดิม 17 รายการ
- ทดสอบ HTTP กับ Wrangler + D1 ในเครื่อง: guest เขียนข้อมูล/เข้า admin ไม่ได้, ปฏิเสธ cross-origin mutation, ไม่รับ Google uid/email ที่ไม่มี token, cookie flags, session restore, profile/admin ID spoofing, bookmark แยกบัญชี, search/empty result และ logout ยกเลิก cookie เดิม รวม 32 request checks
- ทดสอบเพิ่มเติม: session หมดอายุถูกปฏิเสธ, บัญชี SHA-256 เดิมล็อกอินได้, เปลี่ยนรหัสผ่านแล้ว session เดิมใช้ไม่ได้
- ทดสอบผ่านเบราว์เซอร์: Login กลับไป draft เดิม, แตะเลือก Tier, Undo/Redo, reload draft, Publish จาก Rank และ Create, ค้นหา Template ที่เพิ่งสร้าง, บันทึก/ถอด bookmark และ reload
- ยังไม่ได้ทดสอบ Google sign-in ด้วยบัญชี Google จริงหรือทดสอบบน Cloudflare production

ชุด k6 เดิมที่ส่งเพียง `user_id` ต้องเพิ่มขั้นตอนล็อกอินและ cookie ก่อนใช้ทดสอบ mutation ไม่ควรลดการตรวจ session เพื่อให้ scenario เดิมผ่าน
