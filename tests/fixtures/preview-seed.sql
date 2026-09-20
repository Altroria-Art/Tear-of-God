PRAGMA foreign_keys = ON;

-- Synthetic Preview sentinel data only. No production rows, credentials,
-- password hashes, sessions, reset tokens, or OAuth identities belong here.
INSERT INTO profiles (
  id, username, email, bio, avatar_url, university, faculty, major, year, role
) VALUES (
  'preview-user-001',
  'Preview Sentinel',
  'preview-user-001@example.test',
  'Synthetic Preview fixture',
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  'user'
);

INSERT INTO items (id, name, image_url) VALUES
  ('preview-item-001', 'Preview Item One', NULL),
  ('preview-item-002', 'Preview Item Two', NULL);

INSERT INTO templates (
  id, creator_id, title, description, hashtags, tiers, use_count, view_count
) VALUES (
  'preview-template-001',
  'preview-user-001',
  'Preview Synthetic Template',
  'Synthetic sentinel template for Preview isolation checks',
  '#preview,#synthetic',
  '[{"id":"preview-tier-s","label":"S","color":"#ef4444"},{"id":"preview-tier-a","label":"A","color":"#f97316"}]',
  1,
  0
);

INSERT INTO template_items (id, template_id, item_id, tier, position) VALUES
  ('preview-template-item-001', 'preview-template-001', 'preview-item-001', NULL, 0),
  ('preview-template-item-002', 'preview-template-001', 'preview-item-002', NULL, 1);

INSERT INTO rankings (
  id, title, description, hashtags, user_id, template_id,
  likes_count, dislikes_count, comments_count
) VALUES (
  'preview-ranking-001',
  'Preview Synthetic Ranking',
  'Synthetic sentinel ranking for Preview isolation checks',
  '#preview,#synthetic',
  'preview-user-001',
  'preview-template-001',
  0,
  0,
  0
);

INSERT INTO ranking_items (id, ranking_id, item_id, tier, position) VALUES
  ('preview-ranking-item-001', 'preview-ranking-001', 'preview-item-001', 'S', 0),
  ('preview-ranking-item-002', 'preview-ranking-001', 'preview-item-002', 'A', 1);

INSERT INTO ranking_item_scores (
  id, ranking_id, template_id, item_id, tier_index, score
) VALUES
  ('preview-score-001', 'preview-ranking-001', 'preview-template-001', 'preview-item-001', 0, 2),
  ('preview-score-002', 'preview-ranking-001', 'preview-template-001', 'preview-item-002', 1, 1);
