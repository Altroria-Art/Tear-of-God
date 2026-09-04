-- 0008: เพิ่มคอลัมน์ role ให้ profiles ระบุบทบาทผู้ใช้ (admin/user)
-- เรียกใช้: npm run db:migrate:0008
ALTER TABLE profiles ADD COLUMN role TEXT DEFAULT 'user';
