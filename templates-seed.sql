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
('curator_005', 'melodymaster', 'melodymaster@example.com', 'https://api.dicebear.com/7.x/avataaars/svg?seed=melodymaster'),
('curator_006', 'code_sensei', 'code_sensei@example.com', 'https://api.dicebear.com/7.x/avataaars/svg?seed=code_sensei'),
('curator_007', 'binge_watcher', 'binge_watcher@example.com', 'https://api.dicebear.com/7.x/avataaars/svg?seed=binge_watcher'),
('curator_008', 'football_fanatic', 'football_fanatic@example.com', 'https://api.dicebear.com/7.x/avataaars/svg?seed=football_fanatic'),
('curator_009', 'bookworm_nan', 'bookworm_nan@example.com', 'https://api.dicebear.com/7.x/avataaars/svg?seed=bookworm_nan');

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
-- 2b. Templates เพิ่มเติม (tmpl_017-020 คู่กับ rank_001-004 ที่ไม่เคยมี template,
-- tmpl_021-032 เปิดหมวดใหม่: series, sports, book, และเพิ่ม tech/anime/gaming/food/music)
-- ==========================================
INSERT OR IGNORE INTO templates (id, creator_id, title, description, category, hashtags, tiers, use_count) VALUES
('tmpl_017', 'curator_001', 'อนิเมะในดวงใจ ปี 2026', 'รวมอนิเมะที่เนื้อเรื่องโคตรพีคและงานภาพระดับพระเจ้า', 'anime', '#Anime,#2026',
  '[{"label":"S","color":"bg-[#ff7f7f]"},{"label":"A","color":"bg-[#ffbf7f]"},{"label":"B","color":"bg-[#ffff7f]"},{"label":"C","color":"bg-[#7fff7f]"},{"label":"D","color":"bg-[#7fbfff]"}]', 7200),
('tmpl_018', 'curator_004', 'Open-World RPG ยอดนิยม', 'เกมโลกเปิดที่เล่นเพลินจนลืมเวลา', 'gaming', '#Gaming,#OpenWorld',
  '[{"label":"S","color":"bg-[#ff7f7f]"},{"label":"A","color":"bg-[#ffbf7f]"},{"label":"B","color":"bg-[#ffff7f]"},{"label":"C","color":"bg-[#7fff7f]"},{"label":"D","color":"bg-[#7fbfff]"}]', 9800),
('tmpl_019', 'curator_006', 'ภาษาโปรแกรมสาย Dev', 'ภาษาโปรแกรมไหนรุ่ง ภาษาไหนร่วงในปีนี้', 'tech', '#Tech,#Programming',
  '[{"label":"S","color":"bg-[#ff7f7f]"},{"label":"A","color":"bg-[#ffbf7f]"},{"label":"B","color":"bg-[#ffff7f]"},{"label":"C","color":"bg-[#7fff7f]"},{"label":"D","color":"bg-[#7fbfff]"}]', 6100),
('tmpl_020', 'curator_002', 'หนังไซไฟสายสมองแตก', 'ดูจบแล้วสมองไหล อินจัดจนต้องดูซ้ำ', 'movie', '#Movie,#MindBender',
  '[{"label":"S","color":"bg-[#ff7f7f]"},{"label":"A","color":"bg-[#ffbf7f]"},{"label":"B","color":"bg-[#ffff7f]"},{"label":"C","color":"bg-[#7fff7f]"},{"label":"D","color":"bg-[#7fbfff]"}]', 8400),

('tmpl_021', 'curator_007', 'Netflix Originals ยอดฮิต', 'ซีรีส์ Netflix ที่ดูรวดเดียวจบทั้งซีซั่น', 'series', '#Series,#Netflix',
  '[{"label":"S","color":"bg-[#ff7f7f]"},{"label":"A","color":"bg-[#ffbf7f]"},{"label":"B","color":"bg-[#ffff7f]"},{"label":"C","color":"bg-[#7fff7f]"},{"label":"D","color":"bg-[#7fbfff]"}]', 10500),
('tmpl_022', 'curator_007', 'K-Drama ในดวงใจ', 'ซีรีส์เกาหลีที่ดูแล้วต้องร้องไห้', 'series', '#Series,#KDrama',
  '[{"label":"S","color":"bg-[#ff7f7f]"},{"label":"A","color":"bg-[#ffbf7f]"},{"label":"B","color":"bg-[#ffff7f]"},{"label":"C","color":"bg-[#7fff7f]"},{"label":"D","color":"bg-[#7fbfff]"}]', 9100),
('tmpl_023', 'curator_007', 'ซีรีส์ไทยยอดนิยม', 'ซีรีส์ไทยที่คนพูดถึงมากที่สุด', 'series', '#Series,#ThaiSeries',
  '[{"label":"S","color":"bg-[#ff7f7f]"},{"label":"A","color":"bg-[#ffbf7f]"},{"label":"B","color":"bg-[#ffff7f]"},{"label":"C","color":"bg-[#7fff7f]"},{"label":"D","color":"bg-[#7fbfff]"}]', 5800),

('tmpl_024', 'curator_008', 'นักเตะพรีเมียร์ลีกที่เก่งที่สุด', 'จัดอันดับสตาร์พรีเมียร์ลีกยุคปัจจุบัน', 'sports', '#Sports,#PremierLeague',
  '[{"label":"S","color":"bg-[#ff7f7f]"},{"label":"A","color":"bg-[#ffbf7f]"},{"label":"B","color":"bg-[#ffff7f]"},{"label":"C","color":"bg-[#7fff7f]"},{"label":"D","color":"bg-[#7fbfff]"}]', 11200),
('tmpl_025', 'curator_008', 'นักฟุตบอลไทยในดวงใจ', 'นักเตะทีมชาติไทยที่แฟนบอลรักที่สุด', 'sports', '#Sports,#ThaiFootball',
  '[{"label":"S","color":"bg-[#ff7f7f]"},{"label":"A","color":"bg-[#ffbf7f]"},{"label":"B","color":"bg-[#ffff7f]"},{"label":"C","color":"bg-[#7fff7f]"},{"label":"D","color":"bg-[#7fbfff]"}]', 4600),

('tmpl_026', 'curator_009', 'นิยายแฟนตาซีที่ต้องอ่าน', 'นิยายแฟนตาซีที่พาหนีไปโลกอื่นได้จริง', 'book', '#Book,#Fantasy',
  '[{"label":"S","color":"bg-[#ff7f7f]"},{"label":"A","color":"bg-[#ffbf7f]"},{"label":"B","color":"bg-[#ffff7f]"},{"label":"C","color":"bg-[#7fff7f]"},{"label":"D","color":"bg-[#7fbfff]"}]', 6900),
('tmpl_027', 'curator_009', 'หนังสือ Self-Help เปลี่ยนชีวิต', 'อ่านจบแล้วชีวิตเปลี่ยนจริง ไม่ใช่แค่แรงบันดาลใจ', 'book', '#Book,#SelfHelp',
  '[{"label":"S","color":"bg-[#ff7f7f]"},{"label":"A","color":"bg-[#ffbf7f]"},{"label":"B","color":"bg-[#ffff7f]"},{"label":"C","color":"bg-[#7fff7f]"},{"label":"D","color":"bg-[#7fbfff]"}]', 5200),

('tmpl_028', 'curator_006', 'แบรนด์สมาร์ทโฟนยอดนิยม', 'แบรนด์มือถือไหนครองใจคนไทยที่สุด', 'tech', '#Tech,#Smartphone',
  '[{"label":"S","color":"bg-[#ff7f7f]"},{"label":"A","color":"bg-[#ffbf7f]"},{"label":"B","color":"bg-[#ffff7f]"},{"label":"C","color":"bg-[#7fff7f]"},{"label":"D","color":"bg-[#7fbfff]"}]', 8700),
('tmpl_029', 'curator_001', 'อนิเมะกีฬาที่มันส์ที่สุด', 'อนิเมะกีฬาที่ดูแล้วฮึกเหิมอยากลุกไปวิ่ง', 'anime', '#Anime,#SportsAnime',
  '[{"label":"S","color":"bg-[#ff7f7f]"},{"label":"A","color":"bg-[#ffbf7f]"},{"label":"B","color":"bg-[#ffff7f]"},{"label":"C","color":"bg-[#7fff7f]"},{"label":"D","color":"bg-[#7fbfff]"}]', 6400),
('tmpl_030', 'curator_004', 'เกม Esport ยอดนิยม', 'เกมแข่งขันที่มีซีนแข่งใหญ่ที่สุดตอนนี้', 'gaming', '#Gaming,#Esports',
  '[{"label":"S","color":"bg-[#ff7f7f]"},{"label":"A","color":"bg-[#ffbf7f]"},{"label":"B","color":"bg-[#ffff7f]"},{"label":"C","color":"bg-[#7fff7f]"},{"label":"D","color":"bg-[#7fbfff]"}]', 7800),
('tmpl_031', 'curator_003', 'ของหวานไทยที่ต้องลอง', 'ขนมไทยที่กินแล้วต้องยกนิ้วให้', 'food', '#Food,#Dessert',
  '[{"label":"S","color":"bg-[#ff7f7f]"},{"label":"A","color":"bg-[#ffbf7f]"},{"label":"B","color":"bg-[#ffff7f]"},{"label":"C","color":"bg-[#7fff7f]"},{"label":"D","color":"bg-[#7fbfff]"}]', 5300),
('tmpl_032', 'curator_005', 'เพลงป็อปสากลมาแรง', 'เพลงป็อปสากลที่ครองชาร์ตทั่วโลก', 'music', '#Music,#Pop',
  '[{"label":"S","color":"bg-[#ff7f7f]"},{"label":"A","color":"bg-[#ffbf7f]"},{"label":"B","color":"bg-[#ffff7f]"},{"label":"C","color":"bg-[#7fff7f]"},{"label":"D","color":"bg-[#7fbfff]"}]', 8200);

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

-- ==========================================
-- 3b. Template Items เพิ่มเติม (tmpl_017-032)
-- ==========================================
INSERT OR IGNORE INTO template_items (id, template_id, item_id, tier, position) VALUES
-- tmpl_017 อนิเมะในดวงใจ ปี 2026
('ti_017_01','tmpl_017','Attack on Titan','S',0),('ti_017_02','tmpl_017','Demon Slayer','S',1),
('ti_017_03','tmpl_017','One Piece','A',2),('ti_017_04','tmpl_017','Boruto','A',3),
('ti_017_05','tmpl_017','Jujutsu Kaisen',NULL,4),('ti_017_06','tmpl_017','Chainsaw Man',NULL,5),
('ti_017_07','tmpl_017','Spy x Family',NULL,6),('ti_017_08','tmpl_017','Frieren: Beyond Journey''s End',NULL,7),
('ti_017_09','tmpl_017','Vinland Saga',NULL,8),('ti_017_10','tmpl_017','Mashle',NULL,9),

-- tmpl_018 Open-World RPG ยอดนิยม
('ti_018_01','tmpl_018','The Witcher 3','S',0),('ti_018_02','tmpl_018','Elden Ring','S',1),
('ti_018_03','tmpl_018','Cyberpunk 2077','A',2),('ti_018_04','tmpl_018','Skyrim','A',3),
('ti_018_05','tmpl_018','Horizon Zero Dawn',NULL,4),('ti_018_06','tmpl_018','Red Dead Redemption 2',NULL,5),
('ti_018_07','tmpl_018','Ghost of Tsushima',NULL,6),('ti_018_08','tmpl_018','Starfield',NULL,7),
('ti_018_09','tmpl_018','Breath of the Wild',NULL,8),('ti_018_10','tmpl_018','Fallout 4',NULL,9),

-- tmpl_019 ภาษาโปรแกรมสาย Dev
('ti_019_01','tmpl_019','TypeScript','S',0),('ti_019_02','tmpl_019','Python','S',1),
('ti_019_03','tmpl_019','Rust','A',2),('ti_019_04','tmpl_019','PHP','A',3),
('ti_019_05','tmpl_019','JavaScript',NULL,4),('ti_019_06','tmpl_019','Go',NULL,5),
('ti_019_07','tmpl_019','Java',NULL,6),('ti_019_08','tmpl_019','C++',NULL,7),
('ti_019_09','tmpl_019','Kotlin',NULL,8),('ti_019_10','tmpl_019','Swift',NULL,9),

-- tmpl_020 หนังไซไฟสายสมองแตก
('ti_020_01','tmpl_020','Interstellar','S',0),('ti_020_02','tmpl_020','Inception','S',1),
('ti_020_03','tmpl_020','The Matrix','A',2),('ti_020_04','tmpl_020','Tenet','A',3),
('ti_020_05','tmpl_020','Primer',NULL,4),('ti_020_06','tmpl_020','Donnie Darko',NULL,5),
('ti_020_07','tmpl_020','Predestination',NULL,6),('ti_020_08','tmpl_020','Looper',NULL,7),
('ti_020_09','tmpl_020','Edge of Tomorrow',NULL,8),('ti_020_10','tmpl_020','Source Code',NULL,9),

-- tmpl_021 Netflix Originals ยอดฮิต
('ti_021_01','tmpl_021','Stranger Things','S',0),('ti_021_02','tmpl_021','Wednesday','S',1),
('ti_021_03','tmpl_021','The Witcher','A',2),('ti_021_04','tmpl_021','Money Heist','A',3),
('ti_021_05','tmpl_021','Squid Game',NULL,4),('ti_021_06','tmpl_021','Dark',NULL,5),
('ti_021_07','tmpl_021','Ozark',NULL,6),('ti_021_08','tmpl_021','The Crown',NULL,7),
('ti_021_09','tmpl_021','Bridgerton',NULL,8),

-- tmpl_022 K-Drama ในดวงใจ
('ti_022_01','tmpl_022','Crash Landing on You','S',0),('ti_022_02','tmpl_022','Goblin','S',1),
('ti_022_03','tmpl_022','Reply 1988','A',2),('ti_022_04','tmpl_022','Itaewon Class','A',3),
('ti_022_05','tmpl_022','Hospital Playlist',NULL,4),('ti_022_06','tmpl_022','Vincenzo',NULL,5),
('ti_022_07','tmpl_022','It''s Okay to Not Be Okay',NULL,6),('ti_022_08','tmpl_022','Business Proposal',NULL,7),
('ti_022_09','tmpl_022','My Mister',NULL,8),

-- tmpl_023 ซีรีส์ไทยยอดนิยม
('ti_023_01','tmpl_023','บุพเพสันนิวาส','S',0),('ti_023_02','tmpl_023','เลือดข้นคนจาง','S',1),
('ti_023_03','tmpl_023','เมีย 2018','A',2),('ti_023_04','tmpl_023','สืบสันดาน','A',3),
('ti_023_05','tmpl_023','แปลรักฉันด้วยใจเธอ',NULL,4),('ti_023_06','tmpl_023','ฮอร์โมนส์ วัยว้าวุ่น',NULL,5),
('ti_023_07','tmpl_023','กลิ่นกาสะลอง',NULL,6),('ti_023_08','tmpl_023','ทองเอก หมอยาท่าโฉลง',NULL,7),

-- tmpl_024 นักเตะพรีเมียร์ลีกที่เก่งที่สุด
('ti_024_01','tmpl_024','Erling Haaland','S',0),('ti_024_02','tmpl_024','Mohamed Salah','S',1),
('ti_024_03','tmpl_024','Kevin De Bruyne','A',2),('ti_024_04','tmpl_024','Bukayo Saka','A',3),
('ti_024_05','tmpl_024','Son Heung-min',NULL,4),('ti_024_06','tmpl_024','Declan Rice',NULL,5),
('ti_024_07','tmpl_024','Cole Palmer',NULL,6),('ti_024_08','tmpl_024','Martin Odegaard',NULL,7),
('ti_024_09','tmpl_024','Virgil van Dijk',NULL,8),('ti_024_10','tmpl_024','Rodri',NULL,9),

-- tmpl_025 นักฟุตบอลไทยในดวงใจ
('ti_025_01','tmpl_025','ธีรศิลป์ แดงดา','S',0),('ti_025_02','tmpl_025','ชนาธิป สรงกระสินธ์','S',1),
('ti_025_03','tmpl_025','ธีราทร บุญมาทัน','A',2),('ti_025_04','tmpl_025','ศศลักษณ์ ไหประโคน','A',3),
('ti_025_05','tmpl_025','สุภโชค สารชาติ',NULL,4),('ti_025_06','tmpl_025','ธีรเทพ วิโนทัย',NULL,5),
('ti_025_07','tmpl_025','กวินทร์ ธรรมสัจจานันท์',NULL,6),('ti_025_08','tmpl_025','ปกป้อง ป้อมประเสริฐ',NULL,7),

-- tmpl_026 นิยายแฟนตาซีที่ต้องอ่าน
('ti_026_01','tmpl_026','The Name of the Wind','S',0),('ti_026_02','tmpl_026','A Game of Thrones','S',1),
('ti_026_03','tmpl_026','The Way of Kings','A',2),('ti_026_04','tmpl_026','Mistborn','A',3),
('ti_026_05','tmpl_026','The Hobbit',NULL,4),('ti_026_06','tmpl_026','Harry Potter and the Philosopher''s Stone',NULL,5),
('ti_026_07','tmpl_026','The Fellowship of the Ring',NULL,6),('ti_026_08','tmpl_026','The Priory of the Orange Tree',NULL,7),
('ti_026_09','tmpl_026','Six of Crows',NULL,8),

-- tmpl_027 หนังสือ Self-Help เปลี่ยนชีวิต
('ti_027_01','tmpl_027','Atomic Habits','S',0),('ti_027_02','tmpl_027','Deep Work','S',1),
('ti_027_03','tmpl_027','Think and Grow Rich','A',2),('ti_027_04','tmpl_027','The 7 Habits of Highly Effective People','A',3),
('ti_027_05','tmpl_027','The Subtle Art of Not Giving a F*ck',NULL,4),('ti_027_06','tmpl_027','Man''s Search for Meaning',NULL,5),
('ti_027_07','tmpl_027','The Power of Now',NULL,6),('ti_027_08','tmpl_027','Grit',NULL,7),

-- tmpl_028 แบรนด์สมาร์ทโฟนยอดนิยม
('ti_028_01','tmpl_028','iPhone','S',0),('ti_028_02','tmpl_028','Samsung Galaxy','S',1),
('ti_028_03','tmpl_028','Google Pixel','A',2),('ti_028_04','tmpl_028','Xiaomi','A',3),
('ti_028_05','tmpl_028','OnePlus',NULL,4),('ti_028_06','tmpl_028','OPPO',NULL,5),
('ti_028_07','tmpl_028','vivo',NULL,6),('ti_028_08','tmpl_028','ASUS ROG Phone',NULL,7),

-- tmpl_029 อนิเมะกีฬาที่มันส์ที่สุด
('ti_029_01','tmpl_029','Haikyuu!!','S',0),('ti_029_02','tmpl_029','Blue Lock','S',1),
('ti_029_03','tmpl_029','Slam Dunk','A',2),('ti_029_04','tmpl_029','Kuroko''s Basketball','A',3),
('ti_029_05','tmpl_029','Hajime no Ippo',NULL,4),('ti_029_06','tmpl_029','Captain Tsubasa',NULL,5),
('ti_029_07','tmpl_029','Ace of Diamond',NULL,6),('ti_029_08','tmpl_029','Free!',NULL,7),

-- tmpl_030 เกม Esport ยอดนิยม
('ti_030_01','tmpl_030','League of Legends','S',0),('ti_030_02','tmpl_030','Valorant','S',1),
('ti_030_03','tmpl_030','Counter-Strike 2','A',2),('ti_030_04','tmpl_030','Dota 2','A',3),
('ti_030_05','tmpl_030','Overwatch 2',NULL,4),('ti_030_06','tmpl_030','RoV',NULL,5),
('ti_030_07','tmpl_030','Mobile Legends',NULL,6),('ti_030_08','tmpl_030','Apex Legends',NULL,7),

-- tmpl_031 ของหวานไทยที่ต้องลอง
('ti_031_01','tmpl_031','ทับทิมกรอบ','S',0),('ti_031_02','tmpl_031','ข้าวเหนียวมะม่วง','S',1),
('ti_031_03','tmpl_031','ลอดช่องสิงคโปร์','A',2),('ti_031_04','tmpl_031','บัวลอย','A',3),
('ti_031_05','tmpl_031','ขนมชั้น',NULL,4),('ti_031_06','tmpl_031','ฝอยทอง',NULL,5),
('ti_031_07','tmpl_031','ทองหยิบ',NULL,6),('ti_031_08','tmpl_031','สังขยาฟักทอง',NULL,7),

-- tmpl_032 เพลงป็อปสากลมาแรง
('ti_032_01','tmpl_032','Taylor Swift - Anti-Hero','S',0),('ti_032_02','tmpl_032','Dua Lipa - Houdini','S',1),
('ti_032_03','tmpl_032','The Weeknd - Blinding Lights','A',2),('ti_032_04','tmpl_032','Billie Eilish - LUNCH','A',3),
('ti_032_05','tmpl_032','Olivia Rodrigo - vampire',NULL,4),('ti_032_06','tmpl_032','Ariana Grande - yes, and?',NULL,5),
('ti_032_07','tmpl_032','Sabrina Carpenter - Espresso',NULL,6),('ti_032_08','tmpl_032','Doja Cat - Paint The Town Red',NULL,7),
('ti_032_09','tmpl_032','Chappell Roan - Good Luck, Babe!',NULL,8);

PRAGMA foreign_keys = ON;
