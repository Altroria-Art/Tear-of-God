// "โพสต์ที่เพิ่ง publish" ของผู้ใช้ปัจจุบัน — module-scope เท่านั้น (ไม่ใช่ localStorage):
// อยู่ได้ข้าม SPA navigation แต่หายทันทีเมื่อโหลดหน้าใหม่ (module ถูก import ใหม่) จึง
// ให้ Home Feed pin โพสต์ใหม่ขึ้นอันแรกได้แค่ครั้งเดียว แล้วกลับไปเป็นสับสุ่มแบบเดิม
let last = null; // { rankingId, userId }

export function markLastPublished(rankingId, userId) {
  if (!rankingId || !userId) return;
  last = { rankingId, userId };
}

// คืน rankingId แล้วลบทิ้งทันที — เรียกได้ครั้งเดียวต่อ publish
export function takeLastPublished(userId) {
  if (!last || !userId || last.userId !== userId) return null;
  const id = last.rankingId;
  last = null;
  return id;
}