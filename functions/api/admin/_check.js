
// 📍 helper ตรวจสิทธิ์แอดมิน — ใช้โดยทุก endpoint ในโฟลเดอร์ functions/api/admin/
// เช็ค role จาก database จริงทุก request (ไม่เชื่อค่าจากหน้าบ้าน)
//
// userId must come from context.data.user set by /api/_middleware.js.
=======
import { requireAdmin as requireSessionAdmin } from '../_auth.js';


// Authorization is derived exclusively from a validated bearer session.
// Client-provided IDs are deliberately ignored.
export async function requireAdmin(env, request) {
  try {
    return await requireSessionAdmin(request, env);
  } catch (error) {
    console.error('requireAdmin error:', error);
    return null;
  }
}
