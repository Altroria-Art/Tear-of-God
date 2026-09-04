-- 0009: สร้างตาราง reports สำหรับรายงาน template ที่แจ้งหาแอดมิน
-- เรียกใช้: npm run db:migrate:0009 (หรือเทียบเท่า d1 execute)
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  reporter_id TEXT,
  reason TEXT,
  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE,
  FOREIGN KEY (reporter_id) REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_reports_template ON reports(template_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, created_at);
