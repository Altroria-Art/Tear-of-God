// src/lib/feed.js

// ฟังก์ชันสลับตำแหน่งอาเรย์ (Shuffle)
export function shuffle(array) {
  if (!Array.isArray(array)) return [];
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ฟังก์ชันคำนวณสถิติยอดไลก์/ดิสไลก์ตามแอคชันของผู้ใช้
export function statsWithVote(stats, userVote) {
  const baseLikes = stats?.likes || 0;
  const baseDislikes = stats?.dislikes || 0;
  const baseComments = stats?.comments || 0;

  let likes = baseLikes;
  let dislikes = baseDislikes;

  if (userVote === 'like') {
    likes += 1;
  } else if (userVote === 'dislike') {
    dislikes += 1;
  }

  return {
    likes,
    dislikes,
    comments: baseComments,
  };
}