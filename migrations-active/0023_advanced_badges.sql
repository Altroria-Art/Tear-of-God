-- Migration 0023: Add equipped_badge_meta to profiles for badge metadata (e.g. equipped hashtag)
-- Nullable, default NULL: profiles without equipped badge metadata remain NULL
ALTER TABLE profiles ADD COLUMN equipped_badge_meta TEXT DEFAULT NULL;
