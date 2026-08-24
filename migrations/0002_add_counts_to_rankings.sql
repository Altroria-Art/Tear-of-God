ALTER TABLE rankings ADD COLUMN likes_count INTEGER DEFAULT 0;
ALTER TABLE rankings ADD COLUMN dislikes_count INTEGER DEFAULT 0;
ALTER TABLE rankings ADD COLUMN comments_count INTEGER DEFAULT 0;

UPDATE rankings SET
  likes_count = (SELECT COUNT(*) FROM votes WHERE ranking_id = rankings.id AND vote_type = 'like'),
  dislikes_count = (SELECT COUNT(*) FROM votes WHERE ranking_id = rankings.id AND vote_type = 'dislike'),
  comments_count = (SELECT COUNT(*) FROM comments WHERE ranking_id = rankings.id);
