// 📍 placeholder ที่ยืนยันว่ามีจริงในข้อมูล: items.image_url ของตัวอย่างข้อมูลถูก seed เป็น
// '/item-placeholder.svg' (ไฟล์ static ที่โหลด HTTP 200 สำเร็จ) — onError ของ <img>
// จึงไม่เคยทำงาน เพราะฉะนั้นต้องตัดสินใจที่ layer นี้ก่อน render ว่า "เป็นรูปจริง" หรือไม่
// ดูได้จาก .d1-snapshot.sql และ public/item-placeholder.svg
const PLACEHOLDER_PATTERNS = ['/item-placeholder.svg'];

export function isUsableImageUrl(value) {
  if (value === null || value === undefined) return false;
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  if (lower === 'null' || lower === 'undefined') return false;
  // ครอบคลุมทั้ง path ตรง ('/item-placeholder.svg') และ absolute URL ที่ browser resolve แล้ว
  if (PLACEHOLDER_PATTERNS.some((p) => lower === p || lower.endsWith(p))) return false;
  return true;
}

export function normalizeImageUrl(value) {
  return isUsableImageUrl(value) ? value.trim() : null;
}