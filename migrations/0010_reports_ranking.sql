-- 📍 [ใหม่] รายงานโพสต์ (ranking) — reports รองรับทั้ง template report และ post report
-- เพิ่ม column ranking_id (nullable) สำหรับรายงานโพสต์
-- และทำให้ template_id เป็น nullable (รายงานโพสต์จะไม่มี template_id)
--
-- SQLite ไม่ support ALTER ... DROP NOT NULL / ADD CONSTRAINT
-- ใช้เทคนิค rebuild table: สร้างใหม่ → copy ข้อมูล → ย้ายชื่อ → เพิ่ม index/trigger ใหม่

PRAGMA foreign_keys = OFF;

CREATE TABLE reports_new (
  id TEXT PRIMARY KEY,
  template_id TEXT,
  ranking_id TEXT,
  reporter_id TEXT,
  reason TEXT,
  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE,
  FOREIGN KEY (ranking_id) REFERENCES rankings(id) ON DELETE CASCADE,
  FOREIGN KEY (reporter_id) REFERENCES profiles(id) ON DELETE SET NULL
);

-- copy ข้อมูลเดิม (template reports)
INSERT INTO reports_new (id, template_id, ranking_id, reporter_id, reason, status, created_at)
SELECT id, template_id, NULL, reporter_id, reason, status, created_at FROM reports;

DROP TABLE reports;
ALTER TABLE reports_new RENAME TO reports;

CREATE INDEX IF NOT EXISTS idx_reports_template ON reports(template_id);
CREATE INDEX IF NOT EXISTS idx_reports_ranking ON reports(ranking_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, created_at);

-- cascade ลบรายงานโพสต์เมื่อลบโพสต์ (แทน FK ให้ปลอดภัยแม้ PRAGMA off)
CREATE TRIGGER IF NOT EXISTS trg_reports_ranking_delete
AFTER DELETE ON rankings
BEGIN
  DELETE FROM reports WHERE ranking_id = OLD.id;
END;

PRAGMA foreign_keys = ON;
