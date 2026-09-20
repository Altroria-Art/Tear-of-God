-- Supports retention cleanup and time-window analytics without scanning history.
CREATE INDEX IF NOT EXISTS idx_analytics_created ON analytics_events(created_at);
-- Enables indexed OR joins for both legacy item names and canonical item IDs.
CREATE INDEX IF NOT EXISTS idx_items_name ON items(name);
