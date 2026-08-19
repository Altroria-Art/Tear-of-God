export async function onRequest({ request, env }) {
  const db = env.tear_of_god_db;
  const jsonResponse = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

  if (request.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }

  try {
    // รับ payload ทั้งหมด รวมถึงตัวแปร action ว่าจะให้ทำอะไร
    const payload = await request.json();
    const { action, email, password, username, avatar_url, id } = payload;

    // 🟢 [1. REGISTER] สมัครสมาชิกด้วยอีเมล
    if (action === 'register') {
      if (!email || !password) return jsonResponse({ success: false, error: 'กรุณากรอกอีเมลและรหัสผ่าน' }, 400);

      const { results: existing } = await db.prepare('SELECT id FROM profiles WHERE email = ?').bind(email).all();
      if (existing.length > 0) return jsonResponse({ success: false, error: 'อีเมลนี้ถูกใช้งานเรียบร้อยแล้ว' }, 400);

      const userId = 'user_' + crypto.randomUUID();
      const name = username || email.split('@')[0];
      const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`;

      await db.prepare(
        'INSERT INTO profiles (id, username, email, password, avatar_url) VALUES (?1, ?2, ?3, ?4, ?5)'
      ).bind(userId, name, email, password, avatar).run();

      return jsonResponse({ success: true, data: { id: userId, username: name, email, avatar_url: avatar } }, 201);
    } 
    
    // 🟢 [2. LOGIN] เข้าสู่ระบบด้วยอีเมล
    else if (action === 'login') {
      if (!email || !password) return jsonResponse({ success: false, error: 'กรุณากรอกอีเมลและรหัสผ่าน' }, 400);

      const { results: users } = await db.prepare('SELECT * FROM profiles WHERE email = ? AND password = ?').bind(email, password).all();
      if (users.length === 0) return jsonResponse({ success: false, error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' }, 401);

      const user = users[0];
      return jsonResponse({ success: true, data: { id: user.id, username: user.username, email: user.email, avatar_url: user.avatar_url } }, 200);
    }

    // 🟢 [3. GOOGLE SYNC] สะพานเชื่อมข้อมูลจาก Firebase
    else if (action === 'google_sync') {
      // เช็คว่าเคยมีอีเมลนี้ในระบบหรือยัง
      const { results: existing } = await db.prepare('SELECT id FROM profiles WHERE email = ?').bind(email).all();
      
      if (existing.length === 0) {
        // ถ้ายูสเซอร์ใหม่เอี่ยม ให้บันทึกลง Database
        await db.prepare(
          'INSERT INTO profiles (id, username, email, avatar_url) VALUES (?1, ?2, ?3, ?4)'
        ).bind(id, username, email, avatar_url).run();
      } else {
        // ถ้าเคยมีอยู่แล้ว ให้อัปเดตชื่อและรูปให้ตรงกับ Google ล่าสุด
        await db.prepare(
          'UPDATE profiles SET username = ?1, avatar_url = ?2 WHERE email = ?3'
        ).bind(username, avatar_url, email).run();
      }
      
      // ส่งข้อมูลกลับไปให้หน้าเว็บใช้งานต่อ
      return jsonResponse({ success: true, data: { id, username, email, avatar_url } }, 200);
    }

    return jsonResponse({ success: false, error: 'Invalid action' }, 400);
  } catch (err) {
    console.error(err);
    return jsonResponse({ success: false, error: err.message }, 500);
  }
}