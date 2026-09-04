// 📍 helper ตรวจสิทธิ์แอดมิน — ใช้โดยทุก endpoint ในโฟลเดอร์ functions/api/admin/
// เช็ค role จาก database จริงทุก request (ไม่เชื่อค่าจากหน้าบ้าน)
//
// ⚠️ ข้อควรระวังด้านความปลอดภัย (ดู AGENTS.md §Backend): ระบบนี้ยังไม่มี session/token
// จริง — endpoint ทั่วไปรับ user_id จาก client payload โดยตรง วิธีเช็คแบบนี้เป็นแค่
// baseline ขั้นต่ำเพื่อกัน user ธรรมดาปลอมตัวเป็น admin ยังควรวางแผนทำ session/token
// แบบจริงโดยรวมในภายหลัง อย่าเอาวิธีนี้ไปถือว่าปลอดภัยสมบูรณ์

export async function requireAdmin(env, userId) {
  if (!userId) return false;
  try {
    const row = await env.tear_of_god_db
      .prepare('SELECT role FROM profiles WHERE id = ?')
      .bind(userId)
      .first();
    return row?.role === 'admin';
  } catch (err) {
    console.error('requireAdmin error:', err);
    return false;
  }
}
