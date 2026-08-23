// 📍 โปรไฟล์สาธารณะของผู้ใช้ — ใช้โดยหน้า /profile/:userId ตอนดูโปรไฟล์คนอื่น
// ส่งกลับเฉพาะฟิลด์ที่ปลอดภัย (ไม่มี email/password เด็ดขาด)
export async function onRequest({ request, env }) {
  const db = env.tear_of_god_db;
  const jsonResponse = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

  if (request.method !== 'GET') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }

  try {
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return jsonResponse({ success: false, error: 'Missing id' }, 400);

    // SELECT p.* แทนการระบุคอลัมน์ตรงๆ — ถ้า DB ยังไม่รัน migration 0003 (bio)
    // จะไม่พังทั้ง endpoint แค่ bio เป็น null เฉยๆ (ตอบกลับเฉพาะฟิลด์สาธารณะด้านล่างอยู่แล้ว
    // email/password ไม่หลุดออกไปแน่นอน)
    const { results } = await db.prepare(`
      SELECT p.*,
        (SELECT COUNT(*) FROM rankings r WHERE r.user_id = p.id) as posts_count
      FROM profiles p
      WHERE p.id = ?
    `).bind(id).all();

    if (results.length === 0) {
      return jsonResponse({ success: false, error: 'ไม่พบผู้ใช้นี้' }, 404);
    }

    const user = results[0];
    return jsonResponse({
      success: true,
      data: {
        id: user.id,
        username: user.username || 'Unknown',
        avatar_url: user.avatar_url || null,
        bio: user.bio || null,
        created_at: user.created_at || null,
        posts_count: user.posts_count || 0,
      },
    });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message }, 500);
  }
}
