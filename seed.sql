PRAGMA foreign_keys = OFF;

-- ==========================================
-- 1. ข้อมูลผู้ใช้งานปลอม (Profiles)
-- ==========================================
INSERT OR IGNORE INTO profiles (id, username, email, avatar_url) VALUES 
('user_001', 'GodPlayer', 'god@example.com', 'https://api.dicebear.com/7.x/avataaars/svg?seed=God'),
('user_002', 'OtakuKing', 'otaku@example.com', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Otaku'),
('user_003', 'ProGamerTH', 'gamer@example.com', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Gamer'),
('user_004', 'TechGuru', 'tech@example.com', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Tech'),
('user_005', 'CinephileX', 'movie@example.com', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Movie');

-- ==========================================
-- 2. โพสต์จัดอันดับปลอม (Rankings) - หลากหลายหมวด
-- ==========================================
INSERT OR IGNORE INTO rankings (id, title, description, category, user_id) VALUES 
('rank_001', 'จัดอันดับอนิเมะในดวงใจ ปี 2026', 'รวมอนิเมะที่เนื้อเรื่องโคตรพีคและงานภาพระดับพระเจ้า', 'anime', 'user_002'),
('rank_002', 'Tier List สุดยอดเกม RPG ในตำนาน', 'คัดมาเฉพาะเกมที่ใช้เวลาเล่นคุ้มค่าเงินที่สุด', 'games', 'user_003'),
('rank_003', 'จัดอันดับภาษายอดฮิตสาย Tech', 'ภาษาโปรแกรมไหนรุ่ง ภาษาไหนร่วงในปีนี้', 'tech', 'user_004'),
('rank_004', 'หนังไซไฟในดวงใจตลอดกาล', 'ดูจบแล้วสมองไหล อินจัดจนต้องดูซ้ำ', 'movies', 'user_005');

-- ==========================================
-- 3. รายการไอเทมทั้งหมด (ตาราง items)
-- ==========================================
INSERT OR IGNORE INTO items (id, name, image_url) VALUES 
-- หมวดอนิเมะ
('item_001', 'Attack on Titan', 'https://via.placeholder.com/150'),
('item_002', 'Demon Slayer', 'https://via.placeholder.com/150'),
('item_003', 'One Piece', 'https://via.placeholder.com/150'),
('item_004', 'Boruto', 'https://via.placeholder.com/150'),
-- หมวดเกม
('item_005', 'The Witcher 3', 'https://via.placeholder.com/150'),
('item_006', 'Elden Ring', 'https://via.placeholder.com/150'),
('item_007', 'Cyberpunk 2077', 'https://via.placeholder.com/150'),
('item_008', 'Skyrim', 'https://via.placeholder.com/150'),
-- หมวด Tech
('item_009', 'TypeScript', 'https://via.placeholder.com/150'),
('item_010', 'Python', 'https://via.placeholder.com/150'),
('item_011', 'Rust', 'https://via.placeholder.com/150'),
('item_012', 'PHP', 'https://via.placeholder.com/150'),
-- หมวดหนัง
('item_013', 'Interstellar', 'https://via.placeholder.com/150'),
('item_014', 'Inception', 'https://via.placeholder.com/150'),
('item_015', 'The Matrix', 'https://via.placeholder.com/150');

-- ==========================================
-- 4. จัดไอเทมลงกระดาน Tier (ตาราง ranking_items)
-- ==========================================
INSERT OR IGNORE INTO ranking_items (id, ranking_id, item_id, tier, position) VALUES 
-- โพสต์ 1: อนิเมะ
('ri_001', 'rank_001', 'item_001', 'S', 1),
('ri_002', 'rank_001', 'item_002', 'A', 2),
('ri_003', 'rank_001', 'item_003', 'S', 3),
('ri_004', 'rank_001', 'item_004', 'C', 4),
-- โพสต์ 2: เกม RPG
('ri_005', 'rank_002', 'item_005', 'S', 1),
('ri_006', 'rank_002', 'item_006', 'S', 2),
('ri_007', 'rank_002', 'item_007', 'A', 3),
('ri_008', 'rank_002', 'item_008', 'B', 4),
-- โพสต์ 3: Tech
('ri_009', 'rank_003', 'item_009', 'S', 1),
('ri_010', 'rank_003', 'item_010', 'S', 2),
('ri_011', 'rank_003', 'item_011', 'A', 3),
('ri_012', 'rank_003', 'item_012', 'C', 4),
-- โพสต์ 4: หนัง
('ri_013', 'rank_004', 'item_013', 'S', 1),
('ri_014', 'rank_004', 'item_014', 'S', 2),
('ri_015', 'rank_004', 'item_015', 'A', 3);

-- ==========================================
-- 5. คอมเมนต์ปลอมเดือดๆ (Comments)
-- ==========================================
INSERT OR IGNORE INTO comments (id, ranking_id, user_id, content) VALUES 
('comm_001', 'rank_001', 'user_001', 'เห็นด้วยอย่างยิ่ง Attack on Titan ต้อง S Tier เท่านั้น!'),
('comm_002', 'rank_001', 'user_003', 'พล็อตเรื่องโคตรพีค ยกให้เป็นอันดับหนึ่งในใจเลย'),
('comm_003', 'rank_002', 'user_002', 'Witcher 3 ขึ้นหิ้งตลอดกาล เล่นกี่รอบก็ไม่เบื่อ'),
('comm_004', 'rank_003', 'user_005', 'TypeScript นี่ขาดไม่ได้จริงๆ ชีวิตคนเขียนโค้ดดีขึ้นเยอะ'),
('comm_005', 'rank_004', 'user_001', 'Interstellar คือที่สุดของหนังไซไฟแห่งยุคแล้ว!');

-- ==========================================
-- 6. คะแนนโหวตจำลอง (Votes)
-- ==========================================
INSERT OR IGNORE INTO votes (ranking_id, user_id, vote_type) VALUES 
('rank_001', 'user_001', 'up'),
('rank_001', 'user_003', 'up'),
('rank_002', 'user_001', 'up'),
('rank_002', 'user_004', 'up'),
('rank_003', 'user_002', 'up'),
('rank_004', 'user_003', 'up');

PRAGMA foreign_keys = ON;