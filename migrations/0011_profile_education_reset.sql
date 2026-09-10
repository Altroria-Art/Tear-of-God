-- 📍 ล้างข้อมูลการศึกษาเดิม (university/faculty/major/year) ให้เป็น NULL ทุกแถว
-- การตัดสินใจโดยผู้ดูแลผลิตภัณฑ์: ข้อมูลเดิมเป็น text อิสระ (เช่น "ict"/"se"/"3")
-- ซึ่งไม่ตรงกับข้อมูลดรอปดาวน์ใหม่ (คณะ/สาขา/ปีเข้าศึกษา) จึงให้ทุกคนเริ่มต้นใหม่
-- ดู docs/bio-university-dropdown-plan.md §2/§8
UPDATE profiles SET university = NULL, faculty = NULL, major = NULL, year = NULL;