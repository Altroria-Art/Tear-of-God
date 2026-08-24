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

## 3. หน้าฟีดและการค้นหา (Feed & Discovery)

| Test Case ID | Module / Feature | ความสำคัญ (Priority) | คำอธิบาย (Test Case Description) | เงื่อนไขเบื้องต้น (Pre-Condition) | ขั้นตอนการทดสอบ (Test Steps) | ผลลัพธ์ที่คาดหวัง (Expected Result) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-07** | Feed | **High** | เลื่อนดูฟีดหลัก (Infinite Scroll) | มีข้อมูล Ranking ในระบบจำนวนมาก | 1. ไปที่หน้า Home<br>2. เลื่อนหน้าจอลงมาด้านล่างสุด | ระบบจะโหลด Ranking เพิ่มเติมโดยอัตโนมัติ (ไม่กระตุก/หน่วง) |
| **TC-08** | Feed | **High** | ดูหน้าฟีด General และ Kindred | ล็อกอินเข้าสู่ระบบแล้ว | 1. ไปที่หน้า Home<br>2. สลับแท็บเป็น "General"<br>3. สลับแท็บเป็น "Kindred" | "General" แสดงฟีดแบบสุ่ม<br><br>"Kindred" แสดงเฉพาะ Template ที่เคยสร้าง เคยเล่น และใกล้เคียงกับที่เคยทำมา |

## 4. การสร้างและนำไปใช้ (Create & Remix Tier List)

| Test Case ID | Module / Feature | ความสำคัญ (Priority) | คำอธิบาย (Test Case Description) | เงื่อนไขเบื้องต้น (Pre-Condition) | ขั้นตอนการทดสอบ (Test Steps) | ผลลัพธ์ที่คาดหวัง (Expected Result) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-09** | Create Tier List | **High** | สร้าง Tier List (Normal Mode 5 ระดับ) | ล็อกอินแล้ว | 1. ไปที่หน้า Create Tier List<br>2. กรอกชื่อ หมวดหมู่ และรายละเอียด<br>3. กรอกรายการลงใน Quick Add Items และกด Generate<br>4. ลากรายการลง 5 ระดับ (S/A/B/C/D)<br>5. กด "Publish" | ระบบบันทึก Template + Ranking และพาไปดูโพสต์ที่สร้างเสร็จ |
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
