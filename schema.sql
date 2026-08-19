-- 🧹 1. สั่งลบตารางเก่าและตารางขยะทั้งหมดทิ้งก่อน
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS posts;
DROP TABLE IF EXISTS templates;
DROP TABLE IF EXISTS comments;
DROP TABLE IF EXISTS likes;
DROP TABLE IF EXISTS votes;
DROP TABLE IF EXISTS ranking_items;
DROP TABLE IF EXISTS items;
DROP TABLE IF EXISTS rankings;
DROP TABLE IF EXISTS profiles;

-- ✨ 2. สร้างโครงสร้างใหม่ (TierMaker Live Style)

-- ตารางผู้ใช้งาน
CREATE TABLE profiles (
  id TEXT PRIMARY KEY,
  username TEXT,
  email TEXT UNIQUE,
  password TEXT,
  avatar_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ตาราง Ranking (รองรับ Hashtags)
CREATE TABLE rankings (
  id TEXT PRIMARY KEY,
  title TEXT,
  description TEXT,
  category TEXT,
  hashtags TEXT, -- เก็บแฮชแท็ก เช่น "#Gaming,#RPG"
  user_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES profiles(id)
);

-- ตารางไอเทม
CREATE TABLE items (
  id TEXT PRIMARY KEY,
  name TEXT,
  image_url TEXT
);

-- ตารางความสัมพันธ์ (ไอเทมอยู่เทียร์ไหน)
CREATE TABLE ranking_items (
  id TEXT PRIMARY KEY,
  ranking_id TEXT,
  item_id TEXT,
  tier TEXT,
  position INTEGER,
  FOREIGN KEY (ranking_id) REFERENCES rankings(id)
);

-- ตารางโหวต (รองรับทั้ง Like และ Dislike ไว้ทำสถิติฟีด)
CREATE TABLE votes (
  id TEXT PRIMARY KEY,
  ranking_id TEXT,
  user_id TEXT,
  vote_type TEXT CHECK(vote_type IN ('like', 'dislike')), -- บังคับค่าให้เป็นแค่ like หรือ dislike
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(ranking_id, user_id), -- 1 คนโหวตได้ 1 ครั้งต่อโพสต์
  FOREIGN KEY (ranking_id) REFERENCES rankings(id),
  FOREIGN KEY (user_id) REFERENCES profiles(id)
);

-- ตารางคอมเมนต์
CREATE TABLE comments (
  id TEXT PRIMARY KEY,
  ranking_id TEXT,
  user_id TEXT,
  content TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ranking_id) REFERENCES rankings(id),
  FOREIGN KEY (user_id) REFERENCES profiles(id)
);