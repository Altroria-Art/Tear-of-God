PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE profiles (
  id TEXT PRIMARY KEY,
  username TEXT,
  email TEXT UNIQUE,
  password TEXT,
  avatar_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "profiles" ("id","username","email","password","avatar_url","created_at") VALUES('zdk9t6U4jAVwYxATWdJQzwziTmw1','ᴠɪᴇᴡ ᴏɴᴏᴄʜᴀʏᴀᴍᴀ','pview5678xd@gmail.com',NULL,'https://lh3.googleusercontent.com/a/ACg8ocIhDnAHk1gf_l4A-Z74Lhi3fERSPt4EfL-Z7fN03_p4qj3g3Gg=s96-c','2026-08-20 13:47:23');
INSERT INTO "profiles" ("id","username","email","password","avatar_url","created_at") VALUES('user_e6af7bbf-6dbc-43f9-b774-5da6de1f6c92','view','viewlove@gmail.com','8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92','https://api.dicebear.com/7.x/avataaars/svg?seed=view','2026-08-20 14:36:44');
INSERT INTO "profiles" ("id","username","email","password","avatar_url","created_at") VALUES('user_ba2d0f9c-178d-4c43-a069-8a2854f9305a','Naja','naja555@gmail.com','8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92','https://api.dicebear.com/7.x/avataaars/svg?seed=Naja','2026-08-20 14:38:37');
INSERT INTO "profiles" ("id","username","email","password","avatar_url","created_at") VALUES('3YKOYy8LpKbtalCcg6aNajX278k2','สมพล หยดย้อย','sompolhyodyoi@gmail.com',NULL,'https://lh3.googleusercontent.com/a/ACg8ocJnNEpiDcGQD70H8qLiejucyiTg2291MiDkVNlv7TJqY6sxdzs=s96-c','2026-08-20 14:39:17');
CREATE TABLE rankings (
  id TEXT PRIMARY KEY,
  title TEXT,
  description TEXT,
  category TEXT,
  hashtags TEXT,
  user_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP, template_id TEXT,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);
INSERT INTO "rankings" ("id","title","description","category","hashtags","user_id","created_at","template_id") VALUES('68269326-d490-4168-a369-6fbe16e4495e','เมนูไก่นะ','กินเมนูไก่ไหน','food','#Food','zdk9t6U4jAVwYxATWdJQzwziTmw1','2026-08-20 13:48:31',NULL);
CREATE TABLE ranking_items (
  id TEXT PRIMARY KEY,
  ranking_id TEXT,
  item_id TEXT, -- ปล่อยหลวมไว้รับ Custom Item ที่ไม่ใช่ ID ได้
  tier TEXT,
  position INTEGER,
  FOREIGN KEY (ranking_id) REFERENCES rankings(id) ON DELETE CASCADE
);
INSERT INTO "ranking_items" ("id","ranking_id","item_id","tier","position") VALUES('b1fcb01f-648f-47f4-b9c6-5df50f9d9f27','68269326-d490-4168-a369-6fbe16e4495e','กินตุ๋น','S',0);
INSERT INTO "ranking_items" ("id","ranking_id","item_id","tier","position") VALUES('930a9ca2-0aa9-4df0-ae02-15f0becd2da0','68269326-d490-4168-a369-6fbe16e4495e','ไก่นึ่ง','A',1);
INSERT INTO "ranking_items" ("id","ranking_id","item_id","tier","position") VALUES('8d2228fe-c45b-460f-9613-b44efdda0ee8','68269326-d490-4168-a369-6fbe16e4495e','ไก่ต้ม','B',2);
INSERT INTO "ranking_items" ("id","ranking_id","item_id","tier","position") VALUES('de36472d-d425-46ea-b1c8-ea27835d7338','68269326-d490-4168-a369-6fbe16e4495e','ลาบไก้','C',3);
INSERT INTO "ranking_items" ("id","ranking_id","item_id","tier","position") VALUES('cbd5217c-7a4a-4d86-ba38-d6182788a4ab','68269326-d490-4168-a369-6fbe16e4495e','คั่วไก่','D',4);
CREATE TABLE votes (
  id TEXT PRIMARY KEY,
  ranking_id TEXT,
  user_id TEXT,
  vote_type TEXT CHECK(vote_type IN ('like', 'dislike')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(ranking_id, user_id),
  FOREIGN KEY (ranking_id) REFERENCES rankings(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);
INSERT INTO "votes" ("id","ranking_id","user_id","vote_type","created_at") VALUES('41ae1d2b-07f3-4e25-ad27-2c666e2b3dcd','68269326-d490-4168-a369-6fbe16e4495e','zdk9t6U4jAVwYxATWdJQzwziTmw1','like','2026-08-20 13:51:48');
INSERT INTO "votes" ("id","ranking_id","user_id","vote_type","created_at") VALUES('c0d351e6-7f51-472d-81bd-edfbfc46843c','68269326-d490-4168-a369-6fbe16e4495e','user_e6af7bbf-6dbc-43f9-b774-5da6de1f6c92','like','2026-08-20 14:36:51');
INSERT INTO "votes" ("id","ranking_id","user_id","vote_type","created_at") VALUES('7427a37f-8eb5-4a4b-9fd5-c76b55e614f5','68269326-d490-4168-a369-6fbe16e4495e','user_ba2d0f9c-178d-4c43-a069-8a2854f9305a','like','2026-08-20 14:38:50');
INSERT INTO "votes" ("id","ranking_id","user_id","vote_type","created_at") VALUES('8766a594-2c6b-47ef-b3fa-2bb734364e51','68269326-d490-4168-a369-6fbe16e4495e','3YKOYy8LpKbtalCcg6aNajX278k2','like','2026-08-20 14:39:22');
CREATE TABLE comments (
  id TEXT PRIMARY KEY,
  ranking_id TEXT,
  user_id TEXT,
  content TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ranking_id) REFERENCES rankings(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);
INSERT INTO "comments" ("id","ranking_id","user_id","content","created_at") VALUES('3251d1f2-0eed-421f-86ca-c91341d4e612','68269326-d490-4168-a369-6fbe16e4495e','zdk9t6U4jAVwYxATWdJQzwziTmw1','อยากกินไก่มากๆครับ','2026-08-20 13:51:15');
INSERT INTO "comments" ("id","ranking_id","user_id","content","created_at") VALUES('eb818297-490e-4f1c-ad24-59030d5e9c3a','68269326-d490-4168-a369-6fbe16e4495e','3YKOYy8LpKbtalCcg6aNajX278k2','ไม่กินไก่','2026-08-20 14:40:52');
CREATE TABLE items (
  id TEXT PRIMARY KEY,
  name TEXT,
  image_url TEXT
);
CREATE TABLE templates (
  id TEXT PRIMARY KEY,
  creator_id TEXT,
  title TEXT,
  description TEXT,
  category TEXT,
  use_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (creator_id) REFERENCES profiles(id) ON DELETE CASCADE
);
CREATE TABLE template_items (
  id TEXT PRIMARY KEY,
  template_id TEXT,
  item_id TEXT,
  position INTEGER,
  FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
);
CREATE INDEX idx_rankings_user_id ON rankings(user_id);
CREATE INDEX idx_rankings_category ON rankings(category);
CREATE INDEX idx_ranking_items_ranking_id ON ranking_items(ranking_id);
CREATE INDEX idx_votes_ranking_id ON votes(ranking_id);
CREATE INDEX idx_comments_ranking_id ON comments(ranking_id);
CREATE INDEX idx_rankings_template_id ON rankings(template_id);
CREATE INDEX idx_templates_creator_id ON templates(creator_id);
CREATE INDEX idx_template_items_template_id ON template_items(template_id);
