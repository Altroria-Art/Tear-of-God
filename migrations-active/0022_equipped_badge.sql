-- Migration 0022: Add equipped_badge_id to profiles for user title badge
-- Nullable, default NULL: users who haven't equipped a badge remain unchanged
ALTER TABLE profiles ADD COLUMN equipped_badge_id TEXT DEFAULT NULL;
