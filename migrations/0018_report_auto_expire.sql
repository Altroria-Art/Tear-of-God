-- Closed-report auto-expiry: a report closed via set_status (resolved/dismissed)
-- is physically deleted from D1 24 hours after it was closed unless an admin
-- reopens it back to 'pending'. Pending reports are never deleted by this
-- mechanism. The close timestamp is stored in UTC as 'YYYY-MM-DD HH:MM:SS'
-- (same format as SQLite CURRENT_TIMESTAMP / datetime('now')).

ALTER TABLE reports ADD COLUMN closed_at DATETIME;
CREATE INDEX IF NOT EXISTS idx_reports_status_closed_at ON reports(status, closed_at);