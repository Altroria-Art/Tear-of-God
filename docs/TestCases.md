# เอกสารกรณีทดสอบ (Test Cases) - Tear of God

เอกสารนี้รวบรวม Test Cases สำหรับทดสอบการทำงานของระบบ Tear of God และปรับปรุงตามสถานะการพัฒนาปัจจุบัน (อัปเดตล่าสุด: นำเทสเคสกลับมาครบถ้วน พร้อมเพิ่ม Priority)

---

## 1. การจัดการบัญชีผู้ใช้ (Authentication & Authorization)

| Test Case ID | Module / Feature | ความสำคัญ (Priority) | คำอธิบาย (Test Case Description) | เงื่อนไขเบื้องต้น (Pre-Condition) | ขั้นตอนการทดสอบ (Test Steps) | ผลลัพธ์ที่คาดหวัง (Expected Result) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-01** | Register | **High** | สมัครสมาชิกด้วยอีเมลและรหัสผ่าน | ยังไม่ล็อกอินเข้าสู่ระบบ | 1. ไปที่หน้า Login / Register<br>2. กรอกอีเมลและรหัสผ่านที่ยังไม่เคยลงทะเบียน<br>3. กดปุ่ม "Register" | ระบบสร้างบัญชีใหม่สำเร็จ และพาเข้าสู่ระบบ / หน้าแรก |
| **TC-02** | Register | **Medium** | สมัครสมาชิกด้วยอีเมลซ้ำ | มีอีเมลนี้ในระบบแล้ว | 1. ไปที่หน้า Login / Register<br>2. กรอกอีเมลที่เคยลงทะเบียนแล้ว<br>3. กดปุ่ม "Register" | ระบบแสดงข้อความแจ้งเตือนว่า "อีเมลนี้ถูกใช้งานแล้ว" |
| **TC-03** | Login | **High** | เข้าสู่ระบบด้วย Email/Password ที่ถูกต้อง | มีบัญชีในระบบแล้ว | 1. ไปที่หน้า Login<br>2. กรอกอีเมลและรหัสผ่านที่ถูกต้อง<br>3. กดปุ่ม "Login" | เข้าสู่ระบบสำเร็จและ redirect ไปที่หน้า Home Feed |
| **TC-04** | Login | **High** | เข้าสู่ระบบด้วย Google Sign-In | มีบัญชี Google | 1. ไปที่หน้า Login<br>2. กดปุ่ม "Continue with Google"<br>3. เลือกบัญชี Google | เข้าสู่ระบบสำเร็จและ redirect ไปที่หน้า Home Feed |

## 2. การจัดการโปรไฟล์ผู้ใช้ (Profile Management)

| Test Case ID | Module / Feature | ความสำคัญ (Priority) | คำอธิบาย (Test Case Description) | เงื่อนไขเบื้องต้น (Pre-Condition) | ขั้นตอนการทดสอบ (Test Steps) | ผลลัพธ์ที่คาดหวัง (Expected Result) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-05** | Profile | **Medium** | แก้ไขข้อมูลโปรไฟล์ (ชื่อผู้ใช้ และ Bio) | ล็อกอินเข้าสู่ระบบแล้ว | 1. ไปที่หน้า Profile<br>2. กดปุ่ม "Edit Profile"<br>3. เปลี่ยน Username และกรอก Bio ใหม่<br>4. กดปุ่ม "Save Changes" | ข้อมูลโปรไฟล์ถูกอัปเดตและแสดงผลใหม่ทันที |
| **TC-06** | Profile | **Medium** | ดูรายการ Template ที่สร้าง และ Ranking ที่เคยจัด | สร้าง Template และ Ranking ไว้แล้ว | 1. ไปที่หน้า Profile<br>2. ดูแท็บ "Templates Created"<br>3. สลับไปดูแท็บ "Participated Tier Lists" | รายการผลงานแสดงผลได้ถูกต้อง ครบถ้วนตามฐานข้อมูล |
| **TC-06A** | Profile Taste Identity | **High** | ดู Taste DNA และปักหมุดลิสต์โปรด | ล็อกอินและมี Ranking อย่างน้อย 1 รายการ | 1. เปิดหน้า Profile<br>2. ตรวจสัดส่วนหมวด, ไอเทมที่อยู่ S บ่อย, Badge และคนที่รสนิยมใกล้กัน<br>3. กด "ปักหมุด" บน Ranking ของตัวเอง 3 รายการ<br>4. เปิดโปรไฟล์จากอีกบัญชี | Taste Identity แสดงจากข้อมูลจริง; ลิสต์ปักหมุดปรากฏบนโปรไฟล์สาธารณะ; รายการที่ 4 ถูกปฏิเสธพร้อมข้อความว่าเลือกได้สูงสุด 3 รายการ; กดเลิกปักหมุดแล้วรายการหายทันที |

## 3. หน้าฟีดและการค้นหา (Feed & Discovery)

| Test Case ID | Module / Feature | ความสำคัญ (Priority) | คำอธิบาย (Test Case Description) | เงื่อนไขเบื้องต้น (Pre-Condition) | ขั้นตอนการทดสอบ (Test Steps) | ผลลัพธ์ที่คาดหวัง (Expected Result) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-07** | Feed | **High** | เลื่อนดูฟีดหลัก (Infinite Scroll) | มีข้อมูล Ranking ในระบบจำนวนมาก | 1. ไปที่หน้า Home<br>2. เลื่อนหน้าจอลงมาด้านล่างสุด | ระบบจะโหลด Ranking เพิ่มเติมโดยอัตโนมัติ (ไม่กระตุก/หน่วง) |
| **TC-08** | Feed | **High** | ดูหน้าฟีด Trending, For You และ Following ✅ Implemented | ทดสอบทั้ง guest และบัญชีที่ติดตามผู้ใช้อื่นแล้ว | 1. ไปที่หน้า Home<br>2. เปิด "Trending"<br>3. เปิด "For You"<br>4. เปิด "Following" | "Trending" เรียงจากความสดใหม่+engagement; "For You" ใช้สัญญาณหมวด, template, แฮชแท็ก และหัวข้อที่ติดตาม (หัวข้อที่ติดตามตรงเพียงอย่างเดียวก็แสดงได้) พร้อม fallback เป็น Trending เมื่อยังไม่มีผลลัพธ์; "Following" มีเฉพาะโพสต์ล่าสุดของบัญชีที่ติดตามและแสดง empty state เมื่อยังไม่ติดตามใคร; guest ที่เปิด For You/Following เห็นหน้าชวนเข้าสู่ระบบ |

## 4. การสร้างและนำไปใช้ (Create & Remix Tier List)

| Test Case ID | Module / Feature | ความสำคัญ (Priority) | คำอธิบาย (Test Case Description) | เงื่อนไขเบื้องต้น (Pre-Condition) | ขั้นตอนการทดสอบ (Test Steps) | ผลลัพธ์ที่คาดหวัง (Expected Result) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-09** | Create Tier List | **High** | สร้าง Tier List (Normal Mode 5 ระดับ) | ล็อกอินแล้ว | 1. ไปที่หน้า Create Tier List<br>2. กรอกชื่อ หมวดหมู่ และรายละเอียด<br>3. กรอกรายการลงใน Quick Add Items และกด Generate<br>4. ลากรายการลง 5 ระดับ (S/A/B/C/D)<br>5. กด "Publish" | ระบบบันทึก Template + Ranking และพาไปดูโพสต์ที่สร้างเสร็จ |
| **TC-09A** | Create Quick Start / Pair Mode | **High** | เริ่มจัดอันดับแบบ Guest และเลือกทีละคู่ | ยังไม่ล็อกอิน, มีรายการอย่างน้อย 2 ชิ้น | 1. ไปที่หน้า Create Tier List โดยไม่ล็อกอิน<br>2. ตรวจว่าเห็นข้อความเริ่มได้เลยโดยไม่ต้องสมัคร และใช้ Quick Add ได้ทันที<br>3. เลือกโหมด "Choose by pairs"<br>4. เลือกผู้ชนะของแต่ละคู่จนระบบจัดครบทุก pass<br>5. ตรวจผลลัพธ์ที่ถูกกระจายลง Tier และกด Publish | Guest จัดอันดับได้โดยไม่ถูกบังคับล็อกอิน, รายละเอียดชื่อ/หมวด/แฮชแท็กถูกเลื่อนไปถามตอน Publish, pair mode สร้างลำดับจากการเลือกทีละคู่และแปลงเป็น Tier อัตโนมัติ, Draft ยังคง autosave; หากกด Publish ระบบจึงแสดงขั้นตอนสมัคร/ล็อกอินตามเดิม |
| **TC-10** | Create Tier List | **High** | สร้าง Tier List (Top 10 Mode) | ล็อกอินแล้ว | 1. ไปที่หน้า Create Tier List<br>2. สลับเป็นโหมด "Top 10"<br>3. เพิ่มรายการ 10 ชิ้น และจัดอันดับ 1-10 (ห้ามซ้ำ)<br>4. กด "Publish" | ระบบบันทึก Template + Ranking เฉพาะตำแหน่ง 1-10 |
| **TC-11** | Remix | **High** | การนำ Template ผู้อื่นมาจัดใหม่ (Remix) | ล็อกอินแล้ว, มี Template ในระบบ | 1. เปิดหน้าโพสต์ หรือจากหน้า Discover<br>2. กดปุ่ม "Use Template"<br>3. จัดเรียง Item ลง Tier ใหม่ในแบบของตัวเอง<br>4. อาจเพิ่ม Item ใหม่เข้าไป<br>5. กด "Save Ranking" | สร้าง Ranking ใหม่โดยผูกกับ Template ID เดิม และค่า `use_count` ของ Template ต้องเพิ่มขึ้น +1 |

## 5. การโต้ตอบและการดูสถิติ (Interactions & Statistics)

| Test Case ID | Module / Feature | ความสำคัญ (Priority) | คำอธิบาย (Test Case Description) | เงื่อนไขเบื้องต้น (Pre-Condition) | ขั้นตอนการทดสอบ (Test Steps) | ผลลัพธ์ที่คาดหวัง (Expected Result) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-12** | Interactions | **Medium** | กด Like / Dislike บน Ranking | ล็อกอินแล้ว | 1. เลื่อนฟีดไปที่โพสต์<br>2. กดปุ่ม Like หรือ Dislike | ยอด Like/Dislike อัปเดตทันที (UI) และบันทึกลง Database หากกดซ้ำจะเป็นการยกเลิก |
| **TC-13** | Comments | **Medium** | พิมพ์ Comment บน Ranking | ล็อกอินแล้ว | 1. ไปที่หน้า Ranking Detail<br>2. พิมพ์ข้อความในช่อง Comment และกดส่ง | คอมเมนต์แสดงในรายการคอมเมนต์ของโพสต์นั้น |
| **TC-14** | Statistics | **Medium** | ดูสถิติภาพรวม Community Rankings | มีการจัดอันดับจาก Template เดียวกันหลายคน | 1. เข้าไปที่หน้า Template Detail<br>2. คลิกดู "Community Average" | ระบบคำนวณและแสดงค่าเฉลี่ยตำแหน่ง/Tier ที่ถูกจัดบ่อยที่สุดของแต่ละ Item |

## 6. ส่วนของผู้ดูแลระบบ (Admin Moderation)

| Test Case ID | Module / Feature | ความสำคัญ (Priority) | คำอธิบาย (Test Case Description) | เงื่อนไขเบื้องต้น (Pre-Condition) | ขั้นตอนการทดสอบ (Test Steps) | ผลลัพธ์ที่คาดหวัง (Expected Result) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-15** | Admin | **High** | ล็อกอินเข้าสู่ระบบด้วยสิทธิ์ Admin | มีบัญชีสิทธิ์ Admin (`role=admin`) | 1. ไปที่หน้า Admin Login (หรือหน้า Login ปกติ)<br>2. ล็อกอินด้วยบัญชี Admin | สามารถเข้าถึงเส้นทาง (Route) และเมนูหลังบ้านได้ |
| **TC-16** | Admin Moderation | **High** | ลบโพสต์ Ranking หรือ Comment ที่ไม่เหมาะสม | ล็อกอินสิทธิ์ Admin | 1. เข้าสู่หน้า Admin Panel หรือปุ่ม Manage บนโพสต์<br>2. กดเลือก "Delete" บนโพสต์/คอมเมนต์ ยืนยัน | ข้อมูลหายไปจากฟีด/ระบบทันที |
| **TC-17** | Admin Moderation | **High** | ระงับการใช้งานผู้ใช้ (Ban User) | ล็อกอินสิทธิ์ Admin | 1. ไปที่เมนูจัดการผู้ใช้งาน (User Management)<br>2. เลือกผู้ใช้ที่ทำผิดกฎ กดยืนยันการแบน | ผู้ใช้นั้นไม่สามารถล็อกอินหรือใช้งานระบบได้อีก |

## 7. การแจ้งเตือน (Notifications)

| Test Case ID | Module / Feature | ความสำคัญ (Priority) | คำอธิบาย (Test Case Description) | เงื่อนไขเบื้องต้น (Pre-Condition) | ขั้นตอนการทดสอบ (Test Steps) | ผลลัพธ์ที่คาดหวัง (Expected Result) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-18** | Notifications | **High** | รับและเปิดการแจ้งเตือนในแอป | มีผู้ใช้อีกบัญชีหนึ่ง | 1. ให้อีกบัญชีกดติดตาม<br>2. คอมเมนต์และตอบกลับใน Ranking<br>3. ใช้ Template ของผู้รับ<br>4. สร้าง Ranking ใหม่หลังติดตามผู้สร้าง<br>5. ทำ Challenge ของผู้รับสำเร็จ<br>6. กด Like ให้ Ranking ถึงเกณฑ์ Trending และกดหลายโพสต์ภายในวันเดียว<br>7. เปิดไอคอนกระดิ่ง<br>8. กดแต่ละรายการและกด "อ่านทั้งหมดแล้ว" | Badge แสดงจำนวน unread ที่ถูกต้อง; มี notification สำหรับ Follow, Comment/Reply, Template Use, Following Ranking, Like Digest และ Challenge; เมื่อ Ranking ถึงเกณฑ์ Trending และ Community Average เปลี่ยนจะมีรายการที่เกี่ยวข้อง; กดแล้วไปยังโปรไฟล์/โพสต์/Template/หน้าเปรียบเทียบ/Community Average ที่ถูกต้อง; Like หลายครั้งในวันเดียวถูกรวมเป็น Digest เดียว; จำนวน unread ลดลง; action ของตัวเองและการ Follow ซ้ำไม่สร้าง notification เพิ่ม |

## 8. โจทย์ประจำวันและสัปดาห์ (Featured Prompts)

| Test Case ID | Module / Feature | ความสำคัญ (Priority) | คำอธิบาย (Test Case Description) | เงื่อนไขเบื้องต้น (Pre-Condition) | ขั้นตอนการทดสอบ (Test Steps) | ผลลัพธ์ที่คาดหวัง (Expected Result) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-19** | Daily Pick / Weekly Debate | **High** | เปิดโจทย์ประจำรอบและเริ่มจัดอันดับ | มี Template ที่มี Item อย่างน้อย 1 รายการ | 1. เปิดหน้า Home ที่แท็บ Trending<br>2. ตรวจการ์ด Daily Pick และ Weekly Debate<br>3. โหลดหน้าซ้ำภายในรอบเดิม<br>4. กด "จัดเลย"<br>5. ทดสอบก่อนและหลังเที่ยงคืนวันใหม่ตามเวลา Asia/Bangkok | ภายในรอบเดียวกันได้ Template เดิมและ Daily/Weekly ไม่ซ้ำกันเมื่อมีอย่างน้อย 2 Template; แสดงจำนวนผู้จัด ตัวอย่าง Item และเวลานับถอยหลัง; ปุ่มพาไป `/rank?template=...` (Guest ถูกพาไป Login ก่อน); Daily เปลี่ยนเวลา 00:00 น. และ Weekly เปลี่ยนทุกวันจันทร์ 00:00 น. เวลาไทย |
| **TC-19A** | Live Today / Freshness Hub | **High** | ดูส่วนเนื้อหาที่สดใหม่และหัวข้อที่กำลังคุยกัน | มี Ranking ในระบบ | 1. เปิดหน้า Home ที่แท็บ Trending<br>2. ตรวจส่วน Hot in 24 hours, Just ranked, Under debate และ Divided opinions<br>3. ปล่อยการ์ดไว้โดยไม่กดลูกศร แล้วตรวจการเลื่อนอัตโนมัติ<br>4. วางเมาส์/ลาก/โฟกัสเพื่อหยุดการเลื่อน<br>5. กดการ์ดเพื่อเปิดโพสต์ | แต่ละส่วนแสดงข้อมูลตามช่วงเวลาจริงและเรียงตาม engagement/ความใหม่ที่เหมาะสม; การ์ดแสดงจำนวนคนจัด, ความเห็น และคะแนนความเห็นต่าง; การ์ดที่มีหลายรายการเลื่อนไปข้างหน้าอัตโนมัติทุกประมาณ 5 วินาทีและวนกลับต้นเมื่อถึงท้าย; การเลื่อนหยุดเมื่อผู้ใช้ชี้เมาส์ กำลังลาก หรือโฟกัส และปุ่มลูกศรเลื่อนได้ทันที; ลิงก์การ์ดทำงานผ่าน Guest Access Gate และพาไป Login เมื่อเริ่ม action |

## 9. ตัวอย่างลิงก์บนโซเชียล (Social Link Preview)

| Test Case ID | Module / Feature | ความสำคัญ (Priority) | คำอธิบาย (Test Case Description) | เงื่อนไขเบื้องต้น (Pre-Condition) | ขั้นตอนการทดสอบ (Test Steps) | ผลลัพธ์ที่คาดหวัง (Expected Result) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-20** | Open Graph / Twitter Card | **High** | แชร์ลิงก์แล้วได้ชื่อและคำอธิบายตามเนื้อหา | มี Post, Template และ Challenge ที่เข้าถึงได้ | 1. ตรวจ HTML ของ `/post/:id`<br>2. ตรวจ `/template/:id` และ `/template/:id/community`<br>3. ตรวจลิงก์คำท้า `/rank?template=...&challenge=...`<br>4. ตรวจ `/compare/:sourceId/:responseId`<br>5. นำ URL Production ไปทดสอบกับ Social Sharing Debugger | ทุกหน้าโหลด React SPA ได้ตามเดิม; `<title>`, description, Open Graph, Twitter Card และ canonical เป็น URL/เนื้อหาของหน้านั้น; `og:image` เป็น URL แบบ absolute และรูป PNG ขนาด 1200×630; ข้อมูลจากผู้ใช้ถูก HTML-escape; ลิงก์ Challenge แสดงชื่อผู้ท้าและหน้าผลแสดงเปอร์เซ็นต์ที่ตรงกัน |
| **TC-20A** | Share Card Export | **High** | สร้างภาพแชร์หลายขนาดพร้อม QR และคำชวนให้จัดอันดับ | มี Post, Template หรือ Challenge ที่เปิด Share modal ได้ | 1. กด Share แล้วเลือก "ดูตัวอย่างการ์ดแชร์"<br>2. สลับรูปแบบแนวนอน, สี่เหลี่ยม และสตอรี่<br>3. ตรวจชื่อ/Avatar/หมวดหมู่/ข้อมูลสรุป, QR และ CTA<br>4. กดดาวน์โหลดการ์ดแชร์ แล้วเปิดไฟล์ที่ได้ | Preview เปลี่ยนสัดส่วนตาม 1200×630, 1080×1080 และ 1080×1920; QR เปิดลิงก์ของหน้านั้นได้; CTA ชวนผู้รับไปจัดอันดับต่อ; ชื่อไฟล์ระบุรูปแบบภาพ; โหมดส่งออกตารางเดิมยังใช้งานได้ |

## 10. Product Analytics

| Test Case ID | Module / Feature | ความสำคัญ (Priority) | คำอธิบาย (Test Case Description) | เงื่อนไขเบื้องต้น (Pre-Condition) | ขั้นตอนการทดสอบ (Test Steps) | ผลลัพธ์ที่คาดหวัง (Expected Result) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-21** | Analytics Funnel | **High** | บันทึก Funnel และดูจุดที่ผู้ใช้หลุดใน Admin | ใช้ Schema/Migration ล่าสุด และมีบัญชี Admin | 1. เปิด Feed<br>2. เปิด Template<br>3. กดเริ่มจัดอันดับ<br>4. Publish<br>5. คัดลอกลิงก์แชร์<br>6. เปิด Admin Dashboard | ระบบบันทึกเฉพาะชื่อ Event, Session, User ID เมื่อ Login และ Entity ID โดยไม่เก็บ IP/User Agent/ข้อความในฟอร์ม; Strict Mode ไม่สร้าง Route Event ซ้ำใน Session เดียว; Dashboard แสดง Funnel ตามลำดับ Feed → Template → Start → Publish → Share, Conversion จากขั้นก่อน, Active Session/User, Returning User, Return Rate, Activity รายวัน และผลลัพธ์ Challenge |

## 11. Guest Access Gate

| Test Case ID | Module / Feature | ความสำคัญ (Priority) | คำอธิบาย (Test Case Description) | เงื่อนไขเบื้องต้น (Pre-Condition) | ขั้นตอนการทดสอบ (Test Steps) | ผลลัพธ์ที่คาดหวัง (Expected Result) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-22** | Guest Access | **High** | Guest ดู Feed ได้อย่างเดียวและถูกชวนสมัครเมื่อเริ่มใช้งาน | ออกจากระบบแล้ว | 1. เปิดหน้า Home และเลื่อน Feed<br>2. กดแท็บ Feed, โพสต์, โปรไฟล์, Hashtag, Vote, Comment, Bookmark, Share, Export, Search หรือ Use Template<br>3. เลือก Login และ Signup จาก Popup<br>4. เปิด `/create`, `/post/:id` หรือ `/rank?...` โดยตรง<br>5. ล็อกอินแล้วลองเส้นทางเดิม | การเลื่อนไม่ถูกขัดขวาง; ทุก interaction ใน Feed เปิด Popup โดยไม่ทำ action เดิม; Search และ deep link ของ Guest redirect ผ่าน Login; Login/Signup จำ URL ปลายทาง; หลัง Login กลับ URL เดิม; สมาชิกใช้งานทุกหน้าได้ตามปกติ |

## 12. จัดแข่งกับเพื่อน (Friend Challenge)

| Test Case ID | Module / Feature | ความสำคัญ (Priority) | คำอธิบาย (Test Case Description) | เงื่อนไขเบื้องต้น (Pre-Condition) | ขั้นตอนการทดสอบ (Test Steps) | ผลลัพธ์ที่คาดหวัง (Expected Result) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-23** | Friend Challenge | **Critical** | ท้าเพื่อน จัดอันดับ และดูผลเปรียบเทียบครบวงจร | มีสมาชิก 2 บัญชี และ Template ที่มี Item อย่างน้อย 2 รายการ | 1. บัญชี A Publish Ranking ปกติ<br>2. กด “ท้าเพื่อนจัดลิสต์นี้” จากแถบเผยแพร่สำเร็จ<br>3. เปิดลิงก์คำท้าด้วยบัญชี B<br>4. จัดอันดับและ Publish<br>5. ตรวจหน้าเปรียบเทียบ<br>6. ดาวน์โหลดการ์ดผล กดแชร์ผล และสร้างคำท้าต่อ<br>7. กลับไปเปิด Notification ของบัญชี A | หลัง Publish ปกติไปหน้าโพสต์พร้อม CTA คำท้า; ลิงก์เก็บ Ranking ต้นทางและเปิดตัวจัดอันดับ Template เดียวกัน; หลังบัญชี B Publish ไป `/compare/:sourceId/:responseId`; แสดงเปอร์เซ็นต์ที่ตรงกัน Item ที่เห็นต่างที่สุด Item ที่ทั้งคู่ให้อยู่ Tier บนสุด และคะแนนความใจดี; การ์ดผลดาวน์โหลดได้; แชร์ผลและท้าเพื่อนคนถัดไปได้; บัญชี A ได้รับ Notification ที่เปิดกลับมายังผลคู่นี้; Guest ที่เปิดลิงก์ถูก Login ก่อนและกลับมาลิงก์เดิม |

## 13. Following Activity Feed

| Test Case ID | Module / Feature | ความสำคัญ (Priority) | คำอธิบาย (Test Case Description) | เงื่อนไขเบื้องต้น (Pre-Condition) | ขั้นตอนการทดสอบ (Test Steps) | ผลลัพธ์ที่คาดหวัง (Expected Result) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-24** | Following Activity | **High** | ดูกิจกรรมล่าสุดของบัญชีที่ติดตาม | ล็อกอินแล้วและติดตามผู้ใช้อย่างน้อย 1 บัญชีที่มี Ranking/Like ภายใน 90 วัน | 1. เปิด Home → Following<br>2. ตรวจส่วน “กิจกรรมจากคนที่คุณติดตาม”<br>3. ตรวจรายการสร้าง Ranking, กด Like และเข้าร่วม Template<br>4. เปิดแท็บอื่นแล้วกลับมา Following | แสดงชื่อ Avatar เวลากิจกรรม และข้อความแยกประเภท; กิจกรรมเรียงใหม่ไปเก่า; กดกิจกรรมสร้าง Ranking ไป Post และกิจกรรมใช้ Template ไป Template; จำกัดรายการไม่เกิน 12 รายการ; หากไม่มีผู้ติดตามหรือไม่มีกิจกรรม แสดง Empty State; Guest ถูกขอ Login ก่อนดูแท็บนี้ |

## 14. ติดตามหัวข้อ (Topic Follows)

| Test Case ID | Module / Feature | ความสำคัญ (Priority) | คำอธิบาย (Test Case Description) | เงื่อนไขเบื้องต้น (Pre-Condition) | ขั้นตอนการทดสอบ (Test Steps) | ผลลัพธ์ที่คาดหวัง (Expected Result) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-25** | Topic Follows | **High** | ติดตามและเลิกติดตามแฮชแท็ก หมวดหมู่ และเทมเพลต | ล็อกอินแล้ว และมีหน้ารายละเอียดหัวข้ออย่างน้อยหนึ่งรายการ | 1. เปิดหน้า Hashtag แล้วกด “ติดตามหัวข้อนี้”<br>2. เปิดหน้าหมวดหมู่และกดติดตาม<br>3. เปิดหน้า Template และกดติดตาม<br>4. รีเฟรชแต่ละหน้า<br>5. เปิด Home → For You<br>6. กดปุ่มเดิมเพื่อเลิกติดตาม<br>7. ออกจากระบบแล้วลองกดติดตาม | สถานะปุ่มและจำนวนผู้ติดตามอัปเดตทันทีและคงอยู่หลังรีเฟรช; For You ให้น้ำหนักโพสต์ที่ตรงกับหัวข้อที่ติดตาม; เลิกติดตามแล้วสถานะและจำนวนลดลง; Guest ถูกพาไป Login พร้อมจำ URL เดิม; API ป้องกันการติดตามซ้ำและตรวจชนิดหัวข้อถูกต้อง |
