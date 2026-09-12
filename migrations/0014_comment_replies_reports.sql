-- Add parent_id for comment replies
ALTER TABLE comments ADD COLUMN parent_id TEXT REFERENCES comments(id) ON DELETE CASCADE;
ALTER TABLE template_comments ADD COLUMN parent_id TEXT REFERENCES template_comments(id) ON DELETE CASCADE;

-- Add comment references to reports table
ALTER TABLE reports ADD COLUMN comment_id TEXT REFERENCES comments(id) ON DELETE CASCADE;
ALTER TABLE reports ADD COLUMN template_comment_id TEXT REFERENCES template_comments(id) ON DELETE CASCADE;
