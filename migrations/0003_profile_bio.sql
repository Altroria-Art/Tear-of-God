-- 0003: เพิ่มคอลัมน์ bio ให้ profiles (ใช้โชว์ในหน้าโปรไฟล์ตัวเองและของคนอื่น)
-- เรียกใช้: npm run db:migrate:0003
ALTER TABLE profiles ADD COLUMN bio TEXT;
