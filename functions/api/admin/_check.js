// 📍 helper ตรวจสิทธิ์แอดมิน — ใช้โดยทุก endpoint ในโฟลเดอร์ functions/api/admin/
// เช็ค role จาก database จริงทุก request (ไม่เชื่อค่าจากหน้าบ้าน)
//
// userId must come from context.data.user set by /api/_middleware.js.

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
