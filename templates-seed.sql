-- Fake curator accounts + starter templates for the Discover page.
-- Safe to re-run: everything uses INSERT OR IGNORE.
PRAGMA foreign_keys = OFF;

-- ==========================================
-- 1. คิวเรเตอร์ (Profiles)
-- ==========================================
INSERT OR IGNORE INTO profiles (id, username, email, avatar_url) VALUES
('curator_001', 'animelover', 'animelover@example.com', 'https://api.dicebear.com/7.x/avataaars/svg?seed=animelover'),
('curator_002', 'cinephile', 'cinephile@example.com', 'https://api.dicebear.com/7.x/avataaars/svg?seed=cinephile'),
('curator_003', 'foodie_dave', 'foodie_dave@example.com', 'https://api.dicebear.com/7.x/avataaars/svg?seed=foodie_dave'),
('curator_004', 'nintendoguy', 'nintendoguy@example.com', 'https://api.dicebear.com/7.x/avataaars/svg?seed=nintendoguy'),
('curator_005', 'melodymaster', 'melodymaster@example.com', 'https://api.dicebear.com/7.x/avataaars/svg?seed=melodymaster');

-- ==========================================
-- 2. Templates (16 อัน กระจายตาม hashtag)
-- ==========================================
INSERT OR IGNORE INTO templates (id, creator_id, title, description, category, hashtags, tiers, use_count) VALUES
('tmpl_001', 'curator_001', 'Top Shonen Anime', 'จัดอันดับโชเน็นที่ทุกคนต้องดูสักครั้งในชีวิต', 'anime', '#Anime,#Tierlist',
  '[{"label":"S","color":"bg-[#ff7f7f]"},{"label":"A","color":"bg-[#ffbf7f]"},{"label":"B","color":"bg-[#ffff7f]"},{"label":"C","color":"bg-[#7fff7f]"},{"label":"D","color":"bg-[#7fbfff]"}]', 15200),
('tmpl_002', 'curator_002', 'Ghibli Movies', 'รวมผลงานสตูดิโอจิบลิที่งดงามที่สุด', 'anime', '#Anime,#Movie',
  '[{"label":"S","color":"bg-[#ff7f7f]"},{"label":"A","color":"bg-[#ffbf7f]"},{"label":"B","color":"bg-[#ffff7f]"},{"label":"C","color":"bg-[#7fff7f]"},{"label":"D","color":"bg-[#7fbfff]"}]', 8800),
('tmpl_003', 'curator_001', '2000s Anime', 'อนิเมะยุคทองที่นิยามความคลาสสิก', 'anime', '#Anime,#Retro',
  '[{"label":"S","color":"bg-[#ff7f7f]"},{"label":"A","color":"bg-[#ffbf7f]"},{"label":"B","color":"bg-[#ffff7f]"},{"label":"C","color":"bg-[#7fff7f]"},{"label":"D","color":"bg-[#7fbfff]"}]', 6300),
('tmpl_004', 'curator_001', 'Isekai ยอดนิยม', 'ข้ามภพข้ามชาติไปกับอนิเมะ Isekai ที่ดีที่สุด', 'anime', '#Anime,#Isekai',
  '[{"label":"S","color":"bg-[#ff7f7f]"},{"label":"A","color":"bg-[#ffbf7f]"},{"label":"B","color":"bg-[#ffff7f]"},{"label":"C","color":"bg-[#7fff7f]"},{"label":"D","color":"bg-[#7fbfff]"}]', 5100),

('tmpl_005', 'curator_002', 'Best 90s Thrillers', 'หนังทริลเลอร์ยุค 90 ที่ลุ้นระทึกจนหายใจไม่ทั่วท้อง', 'movie', '#Movie,#Thriller',
  '[{"label":"S","color":"bg-[#ff7f7f]"},{"label":"A","color":"bg-[#ffbf7f]"},{"label":"B","color":"bg-[#ffff7f]"},{"label":"C","color":"bg-[#7fff7f]"},{"label":"D","color":"bg-[#7fbfff]"}]', 12300),
('tmpl_006', 'curator_002', 'Sci-Fi Masterpieces', 'สุดยอดหนังไซไฟที่เปลี่ยนวงการภาพยนตร์', 'movie', '#Movie,#SciFi',
  '[{"label":"S","color":"bg-[#ff7f7f]"},{"label":"A","color":"bg-[#ffbf7f]"},{"label":"B","color":"bg-[#ffff7f]"},{"label":"C","color":"bg-[#7fff7f]"},{"label":"D","color":"bg-[#7fbfff]"}]', 9200),
('tmpl_007', 'curator_002', 'Mobster Films', 'หนังมาเฟียที่ทุกซีนคือตำนาน', 'movie', '#Movie,#Crime',
  '[{"label":"S","color":"bg-[#ff7f7f]"},{"label":"A","color":"bg-[#ffbf7f]"},{"label":"B","color":"bg-[#ffff7f]"},{"label":"C","color":"bg-[#7fff7f]"},{"label":"D","color":"bg-[#7fbfff]"}]', 7100),
('tmpl_008', 'curator_002', 'Marvel Phase 1-3', 'จัดอันดับหนัง MCU ยุค Infinity Saga', 'movie', '#Movie,#Superhero',
  '[{"label":"S","color":"bg-[#ff7f7f]"},{"label":"A","color":"bg-[#ffbf7f]"},{"label":"B","color":"bg-[#ffff7f]"},{"label":"C","color":"bg-[#7fff7f]"},{"label":"D","color":"bg-[#7fbfff]"}]', 11400),

('tmpl_009', 'curator_004', 'Switch Games', 'เกม Nintendo Switch ที่ต้องมีติดเครื่อง', 'gaming', '#Gaming,#Nintendo',
  '[{"label":"S","color":"bg-[#ff7f7f]"},{"label":"A","color":"bg-[#ffbf7f]"},{"label":"B","color":"bg-[#ffff7f]"},{"label":"C","color":"bg-[#7fff7f]"},{"label":"D","color":"bg-[#7fbfff]"}]', 13500),
('tmpl_010', 'curator_004', 'สุดยอดเกม RPG ในตำนาน', 'คัดมาเฉพาะเกมที่ใช้เวลาเล่นคุ้มค่าเงินที่สุด', 'gaming', '#Gaming,#RPG',
  '[{"label":"S","color":"bg-[#ff7f7f]"},{"label":"A","color":"bg-[#ffbf7f]"},{"label":"B","color":"bg-[#ffff7f]"},{"label":"C","color":"bg-[#7fff7f]"},{"label":"D","color":"bg-[#7fbfff]"}]', 10800),
('tmpl_011', 'curator_004', 'Soulslike', 'เกมยากที่วัดใจ ตายแล้วตายอีกก็ไม่ยอมแพ้', 'gaming', '#Gaming,#Souls',
  '[{"label":"โคตรโหด","color":"bg-[#ff7f7f]"},{"label":"ยาก","color":"bg-[#ffbf7f]"},{"label":"กำลังดี","color":"bg-[#ffff7f]"},{"label":"ง่ายไป","color":"bg-[#7fbfff]"}]', 6700),
('tmpl_012', 'curator_004', 'เกมมือถือ', 'เกมมือถือที่คนไทยเล่นเยอะที่สุด', 'gaming', '#Gaming,#Mobile',
  '[{"label":"S","color":"bg-[#ff7f7f]"},{"label":"A","color":"bg-[#ffbf7f]"},{"label":"B","color":"bg-[#ffff7f]"},{"label":"C","color":"bg-[#7fff7f]"},{"label":"D","color":"bg-[#7fbfff]"}]', 4200),

('tmpl_013', 'curator_003', 'Street Food Classics', 'สตรีทฟู้ดไทยที่กินแล้วต้องกลับมากินอีก', 'food', '#Food,#StreetFood',
  '[{"label":"อร่อยเทพ","color":"bg-[#ff7f7f]"},{"label":"อร่อย","color":"bg-[#ffbf7f]"},{"label":"พอไหว","color":"bg-[#ffff7f]"},{"label":"ไม่รอด","color":"bg-[#7fbfff]"}]', 9600),
('tmpl_014', 'curator_003', 'เมนูข้าวมันไก่', 'ข้าวมันไก่แบบไหนครองใจคนไทยมากที่สุด', 'food', '#Food,#Thai',
  '[{"label":"S","color":"bg-[#ff7f7f]"},{"label":"A","color":"bg-[#ffbf7f]"},{"label":"B","color":"bg-[#ffff7f]"},{"label":"C","color":"bg-[#7fff7f]"},{"label":"D","color":"bg-[#7fbfff]"}]', 3400),

('tmpl_015', 'curator_005', 'T-Pop ปี 2025', 'ศิลปิน T-Pop ที่มาแรงที่สุดในปีนี้', 'music', '#Music,#TPop',
  '[{"label":"S","color":"bg-[#ff7f7f]"},{"label":"A","color":"bg-[#ffbf7f]"},{"label":"B","color":"bg-[#ffff7f]"},{"label":"C","color":"bg-[#7fff7f]"},{"label":"D","color":"bg-[#7fbfff]"}]', 8100),
('tmpl_016', 'curator_005', 'เพลงร็อคไทยยุค 90', 'วงร็อคไทยตำนานที่นิยามยุคทองเพลงร็อค', 'music', '#Music,#RockThai',
  '[{"label":"S","color":"bg-[#ff7f7f]"},{"label":"A","color":"bg-[#ffbf7f]"},{"label":"B","color":"bg-[#ffff7f]"},{"label":"C","color":"bg-[#7fff7f]"},{"label":"D","color":"bg-[#7fbfff]"}]', 5500);

-- ==========================================
-- 3. Template Items (ไอเทมในแต่ละ template)
-- tier ใส่เฉพาะ 4 ตัวแรกไว้โชว์ preview บนการ์ด (S,S,A,A) ที่เหลือปล่อย NULL ลงกอง Unranked Pool
-- ==========================================
INSERT OR IGNORE INTO template_items (id, template_id, item_id, tier, position) VALUES
-- tmpl_001 Top Shonen Anime
('ti_001_01','tmpl_001','One Piece','S',0),('ti_001_02','tmpl_001','Naruto','S',1),
('ti_001_03','tmpl_001','Attack on Titan','A',2),('ti_001_04','tmpl_001','Demon Slayer','A',3),
('ti_001_05','tmpl_001','My Hero Academia',NULL,4),('ti_001_06','tmpl_001','Jujutsu Kaisen',NULL,5),
('ti_001_07','tmpl_001','Bleach',NULL,6),('ti_001_08','tmpl_001','Dragon Ball Z',NULL,7),
('ti_001_09','tmpl_001','Hunter x Hunter',NULL,8),('ti_001_10','tmpl_001','Black Clover',NULL,9),

-- tmpl_002 Ghibli Movies
('ti_002_01','tmpl_002','Spirited Away','S',0),('ti_002_02','tmpl_002','Princess Mononoke','S',1),
('ti_002_03','tmpl_002','Howl''s Moving Castle','A',2),('ti_002_04','tmpl_002','My Neighbor Totoro','A',3),
('ti_002_05','tmpl_002','Grave of the Fireflies',NULL,4),('ti_002_06','tmpl_002','Ponyo',NULL,5),
('ti_002_07','tmpl_002','The Wind Rises',NULL,6),('ti_002_08','tmpl_002','Kiki''s Delivery Service',NULL,7),
('ti_002_09','tmpl_002','Castle in the Sky',NULL,8),

-- tmpl_003 2000s Anime
('ti_003_01','tmpl_003','Fullmetal Alchemist','S',0),('ti_003_02','tmpl_003','Cowboy Bebop','S',1),
('ti_003_03','tmpl_003','Death Note','A',2),('ti_003_04','tmpl_003','Code Geass','A',3),
('ti_003_05','tmpl_003','Samurai Champloo',NULL,4),('ti_003_06','tmpl_003','Trigun',NULL,5),
('ti_003_07','tmpl_003','Elfen Lied',NULL,6),('ti_003_08','tmpl_003','Great Teacher Onizuka',NULL,7),
('ti_003_09','tmpl_003','Gundam Seed',NULL,8),

-- tmpl_004 Isekai ยอดนิยม
('ti_004_01','tmpl_004','Re:Zero','S',0),('ti_004_02','tmpl_004','Mushoku Tensei','S',1),
('ti_004_03','tmpl_004','Overlord','A',2),('ti_004_04','tmpl_004','That Time I Got Reincarnated as a Slime','A',3),
('ti_004_05','tmpl_004','Konosuba',NULL,4),('ti_004_06','tmpl_004','No Game No Life',NULL,5),
('ti_004_07','tmpl_004','The Rising of the Shield Hero',NULL,6),('ti_004_08','tmpl_004','Sword Art Online',NULL,7),

-- tmpl_005 Best 90s Thrillers
('ti_005_01','tmpl_005','Se7en','S',0),('ti_005_02','tmpl_005','The Silence of the Lambs','S',1),
('ti_005_03','tmpl_005','Fargo','A',2),('ti_005_04','tmpl_005','Heat','A',3),
('ti_005_05','tmpl_005','Pulp Fiction',NULL,4),('ti_005_06','tmpl_005','The Usual Suspects',NULL,5),
('ti_005_07','tmpl_005','L.A. Confidential',NULL,6),('ti_005_08','tmpl_005','Reservoir Dogs',NULL,7),

-- tmpl_006 Sci-Fi Masterpieces
('ti_006_01','tmpl_006','Blade Runner','S',0),('ti_006_02','tmpl_006','Interstellar','S',1),
('ti_006_03','tmpl_006','The Matrix','A',2),('ti_006_04','tmpl_006','2001: A Space Odyssey','A',3),
('ti_006_05','tmpl_006','Arrival',NULL,4),('ti_006_06','tmpl_006','Ex Machina',NULL,5),
('ti_006_07','tmpl_006','Inception',NULL,6),('ti_006_08','tmpl_006','Dune',NULL,7),

-- tmpl_007 Mobster Films
('ti_007_01','tmpl_007','The Godfather','S',0),('ti_007_02','tmpl_007','Goodfellas','S',1),
('ti_007_03','tmpl_007','Casino','A',2),('ti_007_04','tmpl_007','The Departed','A',3),
('ti_007_05','tmpl_007','Scarface',NULL,4),('ti_007_06','tmpl_007','Once Upon a Time in America',NULL,5),
('ti_007_07','tmpl_007','A Bronx Tale',NULL,6),

-- tmpl_008 Marvel Phase 1-3
('ti_008_01','tmpl_008','Avengers: Endgame','S',0),('ti_008_02','tmpl_008','Avengers: Infinity War','S',1),
('ti_008_03','tmpl_008','Iron Man','A',2),('ti_008_04','tmpl_008','Captain America: Civil War','A',3),
('ti_008_05','tmpl_008','Guardians of the Galaxy',NULL,4),('ti_008_06','tmpl_008','Black Panther',NULL,5),
('ti_008_07','tmpl_008','Thor: Ragnarok',NULL,6),('ti_008_08','tmpl_008','Spider-Man: Homecoming',NULL,7),

-- tmpl_009 Switch Games
('ti_009_01','tmpl_009','The Legend of Zelda: TOTK','S',0),('ti_009_02','tmpl_009','Super Mario Odyssey','S',1),
('ti_009_03','tmpl_009','Animal Crossing: New Horizons','A',2),('ti_009_04','tmpl_009','Splatoon 3','A',3),
('ti_009_05','tmpl_009','Metroid Dread',NULL,4),('ti_009_06','tmpl_009','Fire Emblem Engage',NULL,5),
('ti_009_07','tmpl_009','Xenoblade Chronicles 3',NULL,6),('ti_009_08','tmpl_009','Kirby and the Forgotten Land',NULL,7),

-- tmpl_010 สุดยอดเกม RPG ในตำนาน
('ti_010_01','tmpl_010','The Witcher 3','S',0),('ti_010_02','tmpl_010','Elden Ring','S',1),
('ti_010_03','tmpl_010','Persona 5','A',2),('ti_010_04','tmpl_010','Baldur''s Gate 3','A',3),
('ti_010_05','tmpl_010','Final Fantasy VII Remake',NULL,4),('ti_010_06','tmpl_010','Disco Elysium',NULL,5),
('ti_010_07','tmpl_010','Mass Effect 2',NULL,6),('ti_010_08','tmpl_010','Dragon Age: Inquisition',NULL,7),

-- tmpl_011 Soulslike (custom tiers)
('ti_011_01','tmpl_011','Elden Ring','โคตรโหด',0),('ti_011_02','tmpl_011','Sekiro','โคตรโหด',1),
('ti_011_03','tmpl_011','Dark Souls 3','ยาก',2),('ti_011_04','tmpl_011','Bloodborne','ยาก',3),
('ti_011_05','tmpl_011','Hollow Knight',NULL,4),('ti_011_06','tmpl_011','Lies of P',NULL,5),
('ti_011_07','tmpl_011','Nioh 2',NULL,6),('ti_011_08','tmpl_011','Lords of the Fallen',NULL,7),

-- tmpl_012 เกมมือถือ
('ti_012_01','tmpl_012','Genshin Impact','S',0),('ti_012_02','tmpl_012','RoV','S',1),
('ti_012_03','tmpl_012','PUBG Mobile','A',2),('ti_012_04','tmpl_012','Honkai: Star Rail','A',3),
('ti_012_05','tmpl_012','Mobile Legends',NULL,4),('ti_012_06','tmpl_012','Free Fire',NULL,5),
('ti_012_07','tmpl_012','Clash Royale',NULL,6),

-- tmpl_013 Street Food Classics (custom tiers)
('ti_013_01','tmpl_013','ผัดไทย','อร่อยเทพ',0),('ti_013_02','tmpl_013','ส้มตำ','อร่อยเทพ',1),
('ti_013_03','tmpl_013','หมูปิ้ง','อร่อย',2),('ti_013_04','tmpl_013','ไก่ย่าง','อร่อย',3),
('ti_013_05','tmpl_013','ก๋วยเตี๋ยวเรือ',NULL,4),('ti_013_06','tmpl_013','ข้าวเหนียวมะม่วง',NULL,5),
('ti_013_07','tmpl_013','ลูกชิ้นปิ้ง',NULL,6),('ti_013_08','tmpl_013','ข้าวเกรียบปากหม้อ',NULL,7),

-- tmpl_014 เมนูข้าวมันไก่
('ti_014_01','tmpl_014','ข้าวมันไก่ทอด','S',0),('ti_014_02','tmpl_014','ข้าวมันไก่ต้ม','S',1),
('ti_014_03','tmpl_014','ข้าวมันไก่แขก','A',2),('ti_014_04','tmpl_014','ข้าวมันไก่ย่าง','A',3),
('ti_014_05','tmpl_014','ข้าวมันไก่ผัดซีอิ๊ว',NULL,4),('ti_014_06','tmpl_014','ข้าวมันไก่นึ่ง',NULL,5),

-- tmpl_015 T-Pop ปี 2025
('ti_015_01','tmpl_015','BUS''YA','S',0),('ti_015_02','tmpl_015','4EVE','S',1),
('ti_015_03','tmpl_015','PiXXiE','A',2),('ti_015_04','tmpl_015','Da Endorphine','A',3),
('ti_015_05','tmpl_015','Three Man Down',NULL,4),('ti_015_06','tmpl_015','Getsunova',NULL,5),
('ti_015_07','tmpl_015','Musketeers',NULL,6),('ti_015_08','tmpl_015','Instinct',NULL,7),

-- tmpl_016 เพลงร็อคไทยยุค 90
('ti_016_01','tmpl_016','Bodyslam','S',0),('ti_016_02','tmpl_016','Silly Fools','S',1),
('ti_016_03','tmpl_016','Loso','A',2),('ti_016_04','tmpl_016','Big Ass','A',3),
('ti_016_05','tmpl_016','Clash',NULL,4),('ti_016_06','tmpl_016','Labanoon',NULL,5),
('ti_016_07','tmpl_016','Groove Riders',NULL,6),('ti_016_08','tmpl_016','Paradox',NULL,7);

PRAGMA foreign_keys = ON;
