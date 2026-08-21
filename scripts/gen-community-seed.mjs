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
];

// Rankings-per-template: scaled from the old (now-retired) use_count so the
// popular templates still get the deepest pagination to exercise against.
const OLD_USE_COUNT = {
  tmpl_001: 15200, tmpl_002: 8800, tmpl_003: 6300, tmpl_004: 5100,
  tmpl_005: 12300, tmpl_006: 9200, tmpl_007: 7100, tmpl_008: 11400,
  tmpl_009: 13500, tmpl_010: 10800, tmpl_011: 6700, tmpl_012: 4200,
  tmpl_013: 9600, tmpl_014: 3400, tmpl_015: 8100, tmpl_016: 5500,
};
function rankingCountFor(templateId) {
  const base = Math.round(OLD_USE_COUNT[templateId] / 1000) + 3;
  return Math.max(6, Math.min(18, base));
}

// ---- community users ----
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
];

const COMMENT_POOL = [
  'จัดอันดับนี้โคตรตรงใจเลย',
  'อันนี้เห็นด้วยบางส่วน แต่บางอันน่าจะขยับได้นะ',
  'สุดยอด ชอบมาก',
  'อันนี้ต้องเลื่อนขึ้น S แล้วมั้ง',
  'รอดูอันต่อไปเลย',
  'เกณฑ์การจัดโหดจริง',
  'อันนี้คือของจริง',
];

// ---- deterministic "true quality" per item → drives realistic averages ----
function itemQuality(name) {
  return (hashStr(name) % 1000) / 1000; // 0..1, higher = better
}

const BASE_DATE = new Date('2026-08-21T00:00:00Z').getTime();
function randomTimestamp() {
  const daysAgo = randInt(1, 150);
  const hoursAgo = randInt(0, 23);
  const minsAgo = randInt(0, 59);
  const ms = BASE_DATE - daysAgo * 86400000 - hoursAgo * 3600000 - minsAgo * 60000;
  return new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
}

const lines = [];
lines.push('-- Generated by scripts/gen-community-seed.mjs — do not hand-edit, regenerate instead.');
lines.push('-- Deterministic (fixed PRNG seed): re-running the generator reproduces this file exactly.');
lines.push('PRAGMA foreign_keys = OFF;');
lines.push('');

// 1. community profiles
lines.push('-- ==========================================');
lines.push('-- 1. บัญชีผู้ใช้ชุมชน (สำหรับสร้าง Community Rankings)');
lines.push('-- ==========================================');
lines.push('INSERT OR IGNORE INTO profiles (id, username, email, avatar_url) VALUES');
lines.push(
  USERS.map(([id, name]) =>
    `('${id}', '${esc(name)}', '${esc(name)}@example.com', 'https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}')`
  ).join(',\n') + ';'
);
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
    const createdAt = randomTimestamp();

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

    // votes: a handful of other users, weighted toward "like"
    const voters = pickN(USERS.filter(([id]) => id !== userId), randInt(2, 8));
    voters.forEach(([voterId], vIdx) => {
      const voteType = rng() < 0.75 ? 'like' : 'dislike';
      const voteId = `v2_${tnum}_${seq}_${vIdx}`;
      voteRows.push(`('${voteId}', '${rankingId}', '${voterId}', '${voteType}')`);
    });

    // comments: ~40% of rankings get one
    if (rng() < 0.4) {
      const [commenterId] = pick(USERS.filter(([id]) => id !== userId));
      const commentId = `cm2_${tnum}_${seq}`;
      const body = pick(COMMENT_POOL);
      lines._pendingComment = true;
      commentRows.push(`('${commentId}', '${rankingId}', '${commenterId}', '${esc(body)}')`);
    }
  }
});

lines.push('-- ==========================================');
lines.push('-- 2. Community Rankings');
lines.push('-- ==========================================');
lines.push('INSERT OR IGNORE INTO rankings (id, title, description, category, hashtags, user_id, template_id, created_at) VALUES');
lines.push(rankingRows.join(',\n') + ';');
lines.push('');

lines.push('-- ==========================================');
lines.push('-- 3. Ranking Items (การจัดไอเทมของแต่ละคน)');
lines.push('-- ==========================================');
lines.push('INSERT OR IGNORE INTO ranking_items (id, ranking_id, item_id, tier, position) VALUES');
lines.push(rankingItemRows.join(',\n') + ';');
lines.push('');

lines.push('-- ==========================================');
lines.push('-- 4. Votes');
lines.push('-- ==========================================');
lines.push('INSERT OR IGNORE INTO votes (id, ranking_id, user_id, vote_type) VALUES');
lines.push(voteRows.join(',\n') + ';');
lines.push('');

lines.push('-- ==========================================');
lines.push('-- 5. Comments');
lines.push('-- ==========================================');
lines.push('INSERT OR IGNORE INTO comments (id, ranking_id, user_id, content) VALUES');
lines.push(commentRows.join(',\n') + ';');
lines.push('');

lines.push('PRAGMA foreign_keys = ON;');
lines.push('');

writeFileSync(OUT_PATH, lines.join('\n'), 'utf8');
console.log(`Wrote ${rankingRows.length} rankings, ${rankingItemRows.length} ranking_items, ${voteRows.length} votes, ${commentRows.length} comments to ${OUT_PATH}`);
