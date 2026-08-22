// Deterministic generator for community-rankings-seed.sql.
// Re-running produces byte-identical output (fixed PRNG seed) so the file
// can be regenerated and diffed instead of hand-edited.
//
// Usage: node scripts/gen-community-seed.mjs
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, '..', 'community-rankings-seed.sql');

// ---- deterministic PRNG (mulberry32) ----
function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(424242);
const randInt = (min, max) => Math.floor(rng() * (max - min + 1)) + min;
const pick = (arr) => arr[randInt(0, arr.length - 1)];
function pickN(arr, n) {
  const pool = [...arr];
  const out = [];
  n = Math.min(n, pool.length);
  for (let i = 0; i < n; i++) {
    const idx = randInt(0, pool.length - 1);
    out.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return out;
}
function esc(s) {
  return String(s).replace(/'/g, "''");
}
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ---- templates (mirrors templates-seed.sql — item names/order/tiers must match) ----
const STD_TIERS = ['S', 'A', 'B', 'C', 'D'];
const TEMPLATES = [
  { id: 'tmpl_001', category: 'anime', hashtags: '#Anime,#Tierlist', title: 'Top Shonen Anime', tiers: STD_TIERS,
    items: ['One Piece', 'Naruto', 'Attack on Titan', 'Demon Slayer', 'My Hero Academia', 'Jujutsu Kaisen', 'Bleach', 'Dragon Ball Z', 'Hunter x Hunter', 'Black Clover'] },
  { id: 'tmpl_002', category: 'anime', hashtags: '#Anime,#Movie', title: 'Ghibli Movies', tiers: STD_TIERS,
    items: ['Spirited Away', 'Princess Mononoke', "Howl's Moving Castle", 'My Neighbor Totoro', 'Grave of the Fireflies', 'Ponyo', 'The Wind Rises', "Kiki's Delivery Service", 'Castle in the Sky'] },
  { id: 'tmpl_003', category: 'anime', hashtags: '#Anime,#Retro', title: '2000s Anime', tiers: STD_TIERS,
    items: ['Fullmetal Alchemist', 'Cowboy Bebop', 'Death Note', 'Code Geass', 'Samurai Champloo', 'Trigun', 'Elfen Lied', 'Great Teacher Onizuka', 'Gundam Seed'] },
  { id: 'tmpl_004', category: 'anime', hashtags: '#Anime,#Isekai', title: 'Isekai ยอดนิยม', tiers: STD_TIERS,
    items: ['Re:Zero', 'Mushoku Tensei', 'Overlord', 'That Time I Got Reincarnated as a Slime', 'Konosuba', 'No Game No Life', 'The Rising of the Shield Hero', 'Sword Art Online'] },
  { id: 'tmpl_005', category: 'movie', hashtags: '#Movie,#Thriller', title: 'Best 90s Thrillers', tiers: STD_TIERS,
    items: ['Se7en', 'The Silence of the Lambs', 'Fargo', 'Heat', 'Pulp Fiction', 'The Usual Suspects', 'L.A. Confidential', 'Reservoir Dogs'] },
  { id: 'tmpl_006', category: 'movie', hashtags: '#Movie,#SciFi', title: 'Sci-Fi Masterpieces', tiers: STD_TIERS,
    items: ['Blade Runner', 'Interstellar', 'The Matrix', '2001: A Space Odyssey', 'Arrival', 'Ex Machina', 'Inception', 'Dune'] },
  { id: 'tmpl_007', category: 'movie', hashtags: '#Movie,#Crime', title: 'Mobster Films', tiers: STD_TIERS,
    items: ['The Godfather', 'Goodfellas', 'Casino', 'The Departed', 'Scarface', 'Once Upon a Time in America', 'A Bronx Tale'] },
  { id: 'tmpl_008', category: 'movie', hashtags: '#Movie,#Superhero', title: 'Marvel Phase 1-3', tiers: STD_TIERS,
    items: ['Avengers: Endgame', 'Avengers: Infinity War', 'Iron Man', 'Captain America: Civil War', 'Guardians of the Galaxy', 'Black Panther', 'Thor: Ragnarok', 'Spider-Man: Homecoming'] },
  { id: 'tmpl_009', category: 'gaming', hashtags: '#Gaming,#Nintendo', title: 'Switch Games', tiers: STD_TIERS,
    items: ['The Legend of Zelda: TOTK', 'Super Mario Odyssey', 'Animal Crossing: New Horizons', 'Splatoon 3', 'Metroid Dread', 'Fire Emblem Engage', 'Xenoblade Chronicles 3', 'Kirby and the Forgotten Land'] },
  { id: 'tmpl_010', category: 'gaming', hashtags: '#Gaming,#RPG', title: 'สุดยอดเกม RPG ในตำนาน', tiers: STD_TIERS,
    items: ['The Witcher 3', 'Elden Ring', 'Persona 5', "Baldur's Gate 3", 'Final Fantasy VII Remake', 'Disco Elysium', 'Mass Effect 2', 'Dragon Age: Inquisition'] },
  { id: 'tmpl_011', category: 'gaming', hashtags: '#Gaming,#Souls', title: 'Soulslike', tiers: ['โคตรโหด', 'ยาก', 'กำลังดี', 'ง่ายไป'],
    items: ['Elden Ring', 'Sekiro', 'Dark Souls 3', 'Bloodborne', 'Hollow Knight', 'Lies of P', 'Nioh 2', 'Lords of the Fallen'] },
  { id: 'tmpl_012', category: 'gaming', hashtags: '#Gaming,#Mobile', title: 'เกมมือถือ', tiers: STD_TIERS,
    items: ['Genshin Impact', 'RoV', 'PUBG Mobile', 'Honkai: Star Rail', 'Mobile Legends', 'Free Fire', 'Clash Royale'] },
  { id: 'tmpl_013', category: 'food', hashtags: '#Food,#StreetFood', title: 'Street Food Classics', tiers: ['อร่อยเทพ', 'อร่อย', 'พอไหว', 'ไม่รอด'],
    items: ['ผัดไทย', 'ส้มตำ', 'หมูปิ้ง', 'ไก่ย่าง', 'ก๋วยเตี๋ยวเรือ', 'ข้าวเหนียวมะม่วง', 'ลูกชิ้นปิ้ง', 'ข้าวเกรียบปากหม้อ'] },
  { id: 'tmpl_014', category: 'food', hashtags: '#Food,#Thai', title: 'เมนูข้าวมันไก่', tiers: STD_TIERS,
    items: ['ข้าวมันไก่ทอด', 'ข้าวมันไก่ต้ม', 'ข้าวมันไก่แขก', 'ข้าวมันไก่ย่าง', 'ข้าวมันไก่ผัดซีอิ๊ว', 'ข้าวมันไก่นึ่ง'] },
  { id: 'tmpl_015', category: 'music', hashtags: '#Music,#TPop', title: 'T-Pop ปี 2025', tiers: STD_TIERS,
    items: ["BUS'YA", '4EVE', 'PiXXiE', 'Da Endorphine', 'Three Man Down', 'Getsunova', 'Musketeers', 'Instinct'] },
  { id: 'tmpl_016', category: 'music', hashtags: '#Music,#RockThai', title: 'เพลงร็อคไทยยุค 90', tiers: STD_TIERS,
    items: ['Bodyslam', 'Silly Fools', 'Loso', 'Big Ass', 'Clash', 'Labanoon', 'Groove Riders', 'Paradox'] },

  // tmpl_017-020: คู่กับ rank_001-004 ใน seed.sql ที่แต่เดิมไม่มี template — ไอเทมต้องเป็น
  // superset ของไอเทมที่ rank_00N จัดไว้จริง ไม่งั้น Community Average จะขาดไอเทมไป
  { id: 'tmpl_017', category: 'anime', hashtags: '#Anime,#2026', title: 'อนิเมะในดวงใจ ปี 2026', tiers: STD_TIERS,
    items: ['Attack on Titan', 'Demon Slayer', 'One Piece', 'Boruto', 'Jujutsu Kaisen', 'Chainsaw Man', 'Spy x Family', "Frieren: Beyond Journey's End", 'Vinland Saga', 'Mashle'] },
  { id: 'tmpl_018', category: 'gaming', hashtags: '#Gaming,#OpenWorld', title: 'Open-World RPG ยอดนิยม', tiers: STD_TIERS,
    items: ['The Witcher 3', 'Elden Ring', 'Cyberpunk 2077', 'Skyrim', 'Horizon Zero Dawn', 'Red Dead Redemption 2', 'Ghost of Tsushima', 'Starfield', 'Breath of the Wild', 'Fallout 4'] },
  { id: 'tmpl_019', category: 'tech', hashtags: '#Tech,#Programming', title: 'ภาษาโปรแกรมสาย Dev', tiers: STD_TIERS,
    items: ['TypeScript', 'Python', 'Rust', 'PHP', 'JavaScript', 'Go', 'Java', 'C++', 'Kotlin', 'Swift'] },
  { id: 'tmpl_020', category: 'movie', hashtags: '#Movie,#MindBender', title: 'หนังไซไฟสายสมองแตก', tiers: STD_TIERS,
    items: ['Interstellar', 'Inception', 'The Matrix', 'Tenet', 'Primer', 'Donnie Darko', 'Predestination', 'Looper', 'Edge of Tomorrow', 'Source Code'] },

  // tmpl_021-032: หมวดใหม่ (series, sports, book) + เพิ่มความลึกให้หมวดเดิม
  { id: 'tmpl_021', category: 'series', hashtags: '#Series,#Netflix', title: 'Netflix Originals ยอดฮิต', tiers: STD_TIERS,
    items: ['Stranger Things', 'Wednesday', 'The Witcher', 'Money Heist', 'Squid Game', 'Dark', 'Ozark', 'The Crown', 'Bridgerton'] },
  { id: 'tmpl_022', category: 'series', hashtags: '#Series,#KDrama', title: 'K-Drama ในดวงใจ', tiers: STD_TIERS,
    items: ['Crash Landing on You', 'Goblin', 'Reply 1988', 'Itaewon Class', 'Hospital Playlist', 'Vincenzo', "It's Okay to Not Be Okay", 'Business Proposal', 'My Mister'] },
  { id: 'tmpl_023', category: 'series', hashtags: '#Series,#ThaiSeries', title: 'ซีรีส์ไทยยอดนิยม', tiers: STD_TIERS,
    items: ['บุพเพสันนิวาส', 'เลือดข้นคนจาง', 'เมีย 2018', 'สืบสันดาน', 'แปลรักฉันด้วยใจเธอ', 'ฮอร์โมนส์ วัยว้าวุ่น', 'กลิ่นกาสะลอง', 'ทองเอก หมอยาท่าโฉลง'] },
  { id: 'tmpl_024', category: 'sports', hashtags: '#Sports,#PremierLeague', title: 'นักเตะพรีเมียร์ลีกที่เก่งที่สุด', tiers: STD_TIERS,
    items: ['Erling Haaland', 'Mohamed Salah', 'Kevin De Bruyne', 'Bukayo Saka', 'Son Heung-min', 'Declan Rice', 'Cole Palmer', 'Martin Odegaard', 'Virgil van Dijk', 'Rodri'] },
  { id: 'tmpl_025', category: 'sports', hashtags: '#Sports,#ThaiFootball', title: 'นักฟุตบอลไทยในดวงใจ', tiers: STD_TIERS,
    items: ['ธีรศิลป์ แดงดา', 'ชนาธิป สรงกระสินธ์', 'ธีราทร บุญมาทัน', 'ศศลักษณ์ ไหประโคน', 'สุภโชค สารชาติ', 'ธีรเทพ วิโนทัย', 'กวินทร์ ธรรมสัจจานันท์', 'ปกป้อง ป้อมประเสริฐ'] },
  { id: 'tmpl_026', category: 'book', hashtags: '#Book,#Fantasy', title: 'นิยายแฟนตาซีที่ต้องอ่าน', tiers: STD_TIERS,
    items: ['The Name of the Wind', 'A Game of Thrones', 'The Way of Kings', 'Mistborn', 'The Hobbit', "Harry Potter and the Philosopher's Stone", 'The Fellowship of the Ring', 'The Priory of the Orange Tree', 'Six of Crows'] },
  { id: 'tmpl_027', category: 'book', hashtags: '#Book,#SelfHelp', title: 'หนังสือ Self-Help เปลี่ยนชีวิต', tiers: STD_TIERS,
    items: ['Atomic Habits', 'Deep Work', 'Think and Grow Rich', 'The 7 Habits of Highly Effective People', 'The Subtle Art of Not Giving a F*ck', "Man's Search for Meaning", 'The Power of Now', 'Grit'] },
  { id: 'tmpl_028', category: 'tech', hashtags: '#Tech,#Smartphone', title: 'แบรนด์สมาร์ทโฟนยอดนิยม', tiers: STD_TIERS,
    items: ['iPhone', 'Samsung Galaxy', 'Google Pixel', 'Xiaomi', 'OnePlus', 'OPPO', 'vivo', 'ASUS ROG Phone'] },
  { id: 'tmpl_029', category: 'anime', hashtags: '#Anime,#SportsAnime', title: 'อนิเมะกีฬาที่มันส์ที่สุด', tiers: STD_TIERS,
    items: ['Haikyuu!!', 'Blue Lock', 'Slam Dunk', "Kuroko's Basketball", 'Hajime no Ippo', 'Captain Tsubasa', 'Ace of Diamond', 'Free!'] },
  { id: 'tmpl_030', category: 'gaming', hashtags: '#Gaming,#Esports', title: 'เกม Esport ยอดนิยม', tiers: STD_TIERS,
    items: ['League of Legends', 'Valorant', 'Counter-Strike 2', 'Dota 2', 'Overwatch 2', 'RoV', 'Mobile Legends', 'Apex Legends'] },
  { id: 'tmpl_031', category: 'food', hashtags: '#Food,#Dessert', title: 'ของหวานไทยที่ต้องลอง', tiers: STD_TIERS,
    items: ['ทับทิมกรอบ', 'ข้าวเหนียวมะม่วง', 'ลอดช่องสิงคโปร์', 'บัวลอย', 'ขนมชั้น', 'ฝอยทอง', 'ทองหยิบ', 'สังขยาฟักทอง'] },
  { id: 'tmpl_032', category: 'music', hashtags: '#Music,#Pop', title: 'เพลงป็อปสากลมาแรง', tiers: STD_TIERS,
    items: ['Taylor Swift - Anti-Hero', 'Dua Lipa - Houdini', 'The Weeknd - Blinding Lights', 'Billie Eilish - LUNCH', 'Olivia Rodrigo - vampire', 'Ariana Grande - yes, and?', 'Sabrina Carpenter - Espresso', 'Doja Cat - Paint The Town Red', 'Chappell Roan - Good Luck, Babe!'] },
];

// Rankings-per-template: scaled from the old (now-retired) use_count so the
// popular templates still get the deepest pagination to exercise against.
const OLD_USE_COUNT = {
  tmpl_001: 15200, tmpl_002: 8800, tmpl_003: 6300, tmpl_004: 5100,
  tmpl_005: 12300, tmpl_006: 9200, tmpl_007: 7100, tmpl_008: 11400,
  tmpl_009: 13500, tmpl_010: 10800, tmpl_011: 6700, tmpl_012: 4200,
  tmpl_013: 9600, tmpl_014: 3400, tmpl_015: 8100, tmpl_016: 5500,
  tmpl_017: 7200, tmpl_018: 9800, tmpl_019: 6100, tmpl_020: 8400,
  tmpl_021: 10500, tmpl_022: 9100, tmpl_023: 5800, tmpl_024: 11200,
  tmpl_025: 4600, tmpl_026: 6900, tmpl_027: 5200, tmpl_028: 8700,
  tmpl_029: 6400, tmpl_030: 7800, tmpl_031: 5300, tmpl_032: 8200,
};
function rankingCountFor(templateId) {
  const base = Math.round(OLD_USE_COUNT[templateId] / 500) + 5;
  return Math.max(12, Math.min(35, base));
}

// ---- community users ----
// "Named" users are the only ones ever shown by name — ranking authors and
// commenters. Voters are anonymous in the UI (only aggregate counts render),
// so a large filler pool below covers vote volume without needing 300 more
// hand-written usernames.
const USERS = [
  ['community_001', 'shonen_fan_99'],
  ['community_002', 'tierlist_queen'],
  ['community_003', 'retro_otaku'],
  ['community_004', 'isekai_addict'],
  ['community_005', 'film_buff_th'],
  ['community_006', 'scifi_nerd'],
  ['community_007', 'mob_movie_fan'],
  ['community_008', 'marvel_stan'],
  ['community_009', 'switch_master'],
  ['community_010', 'rpg_veteran'],
  ['community_011', 'soulsborne_pro'],
  ['community_012', 'streetfood_hunter'],
  ['community_013', 'ricechicken_lover'],
  ['community_014', 'tpop_stan'],
  ['community_015', 'rockthai_head'],
  ['community_016', 'openworld_wanderer'],
  ['community_017', 'devops_night'],
  ['community_018', 'mindbender_fan'],
  ['community_019', 'bingewatch_th'],
  ['community_020', 'kdrama_crier'],
  ['community_021', 'lakorn_addict'],
  ['community_022', 'plfanatic'],
  ['community_023', 'changthai_ultras'],
  ['community_024', 'fantasyreader'],
  ['community_025', 'selfhelp_junkie'],
  ['community_026', 'gadget_reviewer'],
  ['community_027', 'sportsanime_fan'],
  ['community_028', 'esports_caster'],
  ['community_029', 'khanomthai_fan'],
  ['community_030', 'popcharts_daily'],
  ['community_031', 'mecha_otaku'],
  ['community_032', 'jrpg_hoarder'],
  ['community_033', 'horror_movie_th'],
  ['community_034', 'boardgame_night'],
  ['community_035', 'cafe_hopper'],
  ['community_036', 'indie_music_th'],
  ['community_037', 'manga_binger'],
  ['community_038', 'retro_gamer_99'],
  ['community_039', 'thaidrama_night'],
  ['community_040', 'streetball_th'],
];

// Anonymous filler voters — never displayed by username, only used to reach
// realistic vote totals. UNIQUE(ranking_id, user_id) on votes means the pool
// must comfortably exceed the largest per-ranking vote count generated below.
const FILLER_VOTER_COUNT = 300;
const FILLER_VOTERS = [];
for (let i = 1; i <= FILLER_VOTER_COUNT; i++) {
  const n = String(i).padStart(4, '0');
  FILLER_VOTERS.push([`filler_${n}`, `voter${n}`]);
}
const ALL_VOTERS = [...USERS, ...FILLER_VOTERS];

const COMMENT_POOL = [
  'จัดอันดับนี้โคตรตรงใจเลย',
  'อันนี้เห็นด้วยบางส่วน แต่บางอันน่าจะขยับได้นะ',
  'สุดยอด ชอบมาก',
  'อันนี้ต้องเลื่อนขึ้น S แล้วมั้ง',
  'รอดูอันต่อไปเลย',
  'เกณฑ์การจัดโหดจริง',
  'อันนี้คือของจริง',
  'จัดได้โหดมาก ตรงกับที่คิดไว้เป๊ะ',
  'ทำไมอันนี้อยู่ต่ำจัง ทั้งที่ดีมาก',
  'เกณฑ์การจัดอันนี้แฟร์ดี',
  'ขอบคุณที่จัดให้ดู ตรงใจสุดๆ',
  'อยากให้ขยับอันนี้ลงมาอีกนิด',
  'โหวตให้เลย ชอบการจัดอันดับแบบนี้',
  'มุมมองน่าสนใจ ไม่เคยคิดแบบนี้มาก่อน',
  'เห็นด้วย 100% เลย',
  'อันนี้คือสมควรอยู่บนสุดอยู่แล้ว',
  'จัดได้ดีกว่าที่คิดไว้อีก',
  'มีอันไหนตกหล่นไปไหม อยากเห็นเพิ่ม',
  'รสนิยมตรงกันเป๊ะ ชอบมาก',
  'บางอันเถียงในใจอยู่ แต่โดยรวมโอเค',
  'สุดยอดจริงๆ แชร์ต่อเลย',
  'เกณฑ์นี้ยุติธรรมมาก ไม่เอนเอียง',
  'จัดอันดับได้ครบทุกมุมเลย',
  'นี่แหละของจริง ไม่มีกั๊ก',
  'ต้องลองจัดของตัวเองดูบ้างแล้ว',
  'ดูจบแล้วอยากไปตามดู/เล่นเพิ่มเลย',
  'แบบนี้แหละที่รอดู',
  'คอมเมนต์เดือดจัง แต่จัดมาดีมาก',
  'อยากรู้เกณฑ์การให้คะแนนเพิ่มเติม',
  'สุดท้ายนี้คือเทพจริง',
  'จัดอันดับสายนี้หายาก ขอบคุณที่ทำ',
  'เห็นแล้วคิดถึงตอนดู/เล่นครั้งแรกเลย',
  'มาตรฐานสูงมาก ชอบสไตล์การจัด',
  'ลิสต์นี้ทำให้อยากย้อนกลับไปดูใหม่',
  'จัดได้ครบ ไม่มีตกหล่นเลย',
  'อยากให้ทำ tier list ต่อภาคหน้าด้วย',
  'เกณฑ์คมมาก ยกนิ้วให้เลย',
  'นี่คือลิสต์ที่รอมานาน',
  'ดีใจที่มีคนจัดอันดับสายเดียวกับเรา',
  'S Tier ของฉันเหมือนกันเป๊ะเลย',
  'ตรงกับที่เพื่อนๆ พูดถึงบ่อยๆ',
  'จัดแบบนี้มันส์ดี ได้ถกเถียงกันต่อ',
  'ดูจบแล้วต้องมาคอมเมนต์เลย',
  'อันนี้คือมาตรฐานทองคำของหมวดนี้',
  'จัดได้ไม่ลำเอียงเลย ชอบมาก',
  'เก็บลิสต์นี้ไว้อ้างอิงแน่นอน',
];

// ---- deterministic "true quality" per item → drives realistic averages ----
function itemQuality(name) {
  return (hashStr(name) % 1000) / 1000; // 0..1, higher = better
}

const BASE_DATE = new Date('2026-08-21T00:00:00Z').getTime();
function fmtDate(ms) {
  return new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
}
function randomTimestampMs() {
  const daysAgo = randInt(1, 150);
  const hoursAgo = randInt(0, 23);
  const minsAgo = randInt(0, 59);
  return BASE_DATE - daysAgo * 86400000 - hoursAgo * 3600000 - minsAgo * 60000;
}

// เดโพสต์ทั่วไปมียอดโหวตพอประมาณ ส่วนน้อยจะไวรัลยอดสูงลิ่ว — สัดส่วน 80/15/5
function voteCountFor() {
  const r = rng();
  if (r < 0.05) return randInt(150, 280); // ไวรัล
  if (r < 0.20) return randInt(50, 120); // กระแสดี
  return randInt(15, 45); // ทั่วไป
}

// แบ่งเป็น "INSERT ... VALUES" หลายก้อน ก้อนละไม่เกิน chunkSize แถว กัน
// statement เดียวใหญ่เกินไปตอนยิงผ่าน wrangler d1 execute
function chunkedInsert(tableClause, rows, chunkSize = 500) {
  const blocks = [];
  for (let i = 0; i < rows.length; i += chunkSize) {
    blocks.push(`${tableClause}\n${rows.slice(i, i + chunkSize).join(',\n')};`);
  }
  return blocks.join('\n\n');
}

const lines = [];
lines.push('-- Generated by scripts/gen-community-seed.mjs — do not hand-edit, regenerate instead.');
lines.push('-- Deterministic (fixed PRNG seed): re-running the generator reproduces this file exactly.');
lines.push('PRAGMA foreign_keys = OFF;');
lines.push('');

// 1. community profiles — named users (authors/commenters) + anonymous filler voters
lines.push('-- ==========================================');
lines.push('-- 1. บัญชีผู้ใช้ชุมชน (สำหรับสร้าง Community Rankings) + filler voters');
lines.push('-- ==========================================');
const profileRows = ALL_VOTERS.map(([id, name]) =>
  `('${id}', '${esc(name)}', '${esc(name)}@example.com', 'https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}')`
);
lines.push(chunkedInsert('INSERT OR IGNORE INTO profiles (id, username, email, avatar_url) VALUES', profileRows));
lines.push('');

// build all rankings first (need ids for items/votes/comments)
const rankingRows = [];
const rankingItemRows = [];
const voteRows = [];
const commentRows = [];

TEMPLATES.forEach((tmpl, tIdx) => {
  const tnum = String(tIdx + 1).padStart(3, '0');
  const count = rankingCountFor(tmpl.id);
  const N = tmpl.tiers.length;

  for (let seq = 1; seq <= count; seq++) {
    const rankingId = `rk_${tnum}_${String(seq).padStart(2, '0')}`;
    const [userId] = pick(USERS);
    const createdAtMs = randomTimestampMs();
    const createdAt = fmtDate(createdAtMs);

    rankingRows.push(
      `('${rankingId}', '${esc(tmpl.title)}', '', '${tmpl.category}', '${tmpl.hashtags}', '${userId}', '${tmpl.id}', '${createdAt}')`
    );

    // assign each item to a tier (or leave unranked) based on deterministic
    // quality + per-ranking noise, so the community average is meaningful
    tmpl.items.forEach((item, itemIdx) => {
      const leaveUnranked = rng() < 0.12;
      const itemId = `rki_${tnum}_${seq}_${itemIdx}`;
      if (leaveUnranked) {
        rankingItemRows.push(`('${itemId}', '${rankingId}', '${esc(item)}', NULL, ${itemIdx})`);
        return;
      }
      const quality = itemQuality(item);
      let idx = Math.round((1 - quality) * (N - 1)) + randInt(-1, 1);
      idx = Math.max(0, Math.min(N - 1, idx));
      const tierLabel = tmpl.tiers[idx];
      rankingItemRows.push(`('${itemId}', '${rankingId}', '${esc(item)}', '${esc(tierLabel)}', ${itemIdx})`);
    });

    // votes: draw from named users + anonymous filler pool, skewed toward "like"
    const voteCount = voteCountFor();
    const voters = pickN(ALL_VOTERS.filter(([id]) => id !== userId), voteCount);
    voters.forEach(([voterId], vIdx) => {
      const voteType = rng() < 0.8 ? 'like' : 'dislike';
      const voteId = `v2_${tnum}_${seq}_${vIdx}`;
      voteRows.push(`('${voteId}', '${rankingId}', '${voterId}', '${voteType}')`);
    });

    // comments: 2-12 distinct commenters, each with a distinct line from the pool,
    // posted at a distinct time after the ranking itself was created
    const commentCount = randInt(2, 12);
    const commenters = pickN(USERS.filter(([id]) => id !== userId), commentCount);
    const bodies = pickN(COMMENT_POOL, commenters.length);
    commenters.forEach(([commenterId], cIdx) => {
      const commentId = `cm2_${tnum}_${seq}_${cIdx}`;
      const commentMs = Math.min(createdAtMs + randInt(1, 96) * 3600000, BASE_DATE - 60000);
      const commentAt = fmtDate(commentMs);
      commentRows.push(`('${commentId}', '${rankingId}', '${commenterId}', '${esc(bodies[cIdx])}', '${commentAt}')`);
    });
  }
});

lines.push('-- ==========================================');
lines.push('-- 2. Community Rankings');
lines.push('-- ==========================================');
lines.push(chunkedInsert(
  'INSERT OR IGNORE INTO rankings (id, title, description, category, hashtags, user_id, template_id, created_at) VALUES',
  rankingRows
));
lines.push('');

lines.push('-- ==========================================');
lines.push('-- 3. Ranking Items (การจัดไอเทมของแต่ละคน)');
lines.push('-- ==========================================');
lines.push(chunkedInsert(
  'INSERT OR IGNORE INTO ranking_items (id, ranking_id, item_id, tier, position) VALUES',
  rankingItemRows
));
lines.push('');

lines.push('-- ==========================================');
lines.push('-- 4. Votes');
lines.push('-- ==========================================');
lines.push(chunkedInsert(
  'INSERT OR IGNORE INTO votes (id, ranking_id, user_id, vote_type) VALUES',
  voteRows
));
lines.push('');

lines.push('-- ==========================================');
lines.push('-- 5. Comments');
lines.push('-- ==========================================');
lines.push(chunkedInsert(
  'INSERT OR IGNORE INTO comments (id, ranking_id, user_id, content, created_at) VALUES',
  commentRows
));
lines.push('');

lines.push('PRAGMA foreign_keys = ON;');
lines.push('');

writeFileSync(OUT_PATH, lines.join('\n'), 'utf8');
console.log(`Wrote ${profileRows.length} profiles, ${rankingRows.length} rankings, ${rankingItemRows.length} ranking_items, ${voteRows.length} votes, ${commentRows.length} comments to ${OUT_PATH}`);
