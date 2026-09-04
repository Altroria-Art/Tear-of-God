export async function onRequest({ request, env }) {
  const db = env.tear_of_god_db;
  const jsonResponse = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

  async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  if (request.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }

  try {
    const payload = await request.json();
    const { action, email, password, username, bio, avatar_url, id, user_id, university, faculty, major, year } = payload;

    if (action === 'register') {
      if (!email || !password) return jsonResponse({ success: false, error: 'กรุณากรอกอีเมลและรหัสผ่าน' }, 400);

      const { results: existing } = await db.prepare('SELECT id FROM profiles WHERE email = ?').bind(email).all();
      if (existing.length > 0) return jsonResponse({ success: false, error: 'อีเมลนี้ถูกใช้งานเรียบร้อยแล้ว' }, 400);

      const userId = 'user_' + crypto.randomUUID();
      const name = username || email.split('@')[0];
      const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`;
      const hashedPassword = await hashPassword(password);

      await db.prepare(
        'INSERT INTO profiles (id, username, email, password, avatar_url) VALUES (?1, ?2, ?3, ?4, ?5)'
      ).bind(userId, name, email, hashedPassword, avatar).run();

      return jsonResponse({ success: true, data: { id: userId, username: name, email, avatar_url: avatar, role: 'user' } }, 201);
    } 
    
    else if (action === 'login') {
      if (!email || !password) return jsonResponse({ success: false, error: 'กรุณากรอกอีเมลและรหัสผ่าน' }, 400);

      const hashedPassword = await hashPassword(password);
      const { results: users } = await db.prepare('SELECT * FROM profiles WHERE email = ? AND password = ?').bind(email, hashedPassword).all();
      if (users.length === 0) return jsonResponse({ success: false, error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' }, 401);

      const user = users[0];
      return jsonResponse({ success: true, data: { id: user.id, username: user.username, email: user.email, bio: user.bio || null, avatar_url: user.avatar_url, university: user.university || null, faculty: user.faculty || null, major: user.major || null, year: user.year || null, role: user.role || 'user' } }, 200);
    }

    else if (action === 'google_sync') {
      const { results: existing } = await db.prepare('SELECT id FROM profiles WHERE email = ?').bind(email).all();
      
      if (existing.length === 0) {
        await db.prepare(
          'INSERT INTO profiles (id, username, email, avatar_url) VALUES (?1, ?2, ?3, ?4)'
        ).bind(id, username, email, avatar_url).run();
      } else {
        await db.prepare(
          'UPDATE profiles SET username = ?1, avatar_url = ?2 WHERE email = ?3'
        ).bind(username, avatar_url, email).run();
      }

      // ดึง role ที่แท้จริงจาก DB (ถ้าเป็น admin ที่สมัครด้วย Google จะได้ 'admin' กลับมา)
      const { results: roleRows } = await db.prepare('SELECT role FROM profiles WHERE email = ?').bind(email).all();
      const role = roleRows[0]?.role || 'user';

      // สำคัญ: return id จริงจาก DB ไม่ใช่ Firebase uid — ผู้ใช้ที่เคยสมัครด้วย email/password
      // (id รูป user_xxx) แล้วมา login ผ่าน Google (email เดียวกัน) จะถูก UPDATE ที่แถวเดิม
      // ถ้า return Firebase uid กลับไป user_id ทุก action หลังจะชี้ไปที่แถวที่ไม่มีอยู่จริง
      const { results: dbUser } = await db.prepare('SELECT id FROM profiles WHERE email = ?').bind(email).all();
      return jsonResponse({ success: true, data: { id: dbUser[0].id, username, email, avatar_url, role } }, 200);
    }

    else if (action === 'update_profile') {
      if (!user_id) return jsonResponse({ success: false, error: 'Missing user_id' }, 400);

      const updates = [];
      const params = [];
      if (username !== undefined) { updates.push('username = ?'); params.push(username); }
      if (bio !== undefined) { updates.push('bio = ?'); params.push(bio); }
      if (avatar_url !== undefined) { updates.push('avatar_url = ?'); params.push(avatar_url); }
      if (university !== undefined) { updates.push('university = ?'); params.push(university); }
      if (faculty !== undefined) { updates.push('faculty = ?'); params.push(faculty); }
      if (major !== undefined) { updates.push('major = ?'); params.push(major); }
      if (year !== undefined) { updates.push('year = ?'); params.push(year); }
      if (password !== undefined) { updates.push('password = ?'); params.push(await hashPassword(password)); }

      if (updates.length === 0) return jsonResponse({ success: false, error: 'No fields to update' }, 400);

      params.push(user_id);
      await db.prepare(`UPDATE profiles SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();

      const { results: users } = await db.prepare('SELECT id, username, email, bio, avatar_url, university, faculty, major, year, role FROM profiles WHERE id = ?').bind(user_id).all();
      return jsonResponse({ success: true, data: users[0] || null }, 200);
    }

    return jsonResponse({ success: false, error: 'Invalid action' }, 400);
  } catch (err) {
    console.error(err);
    return jsonResponse({ success: false, error: err.message }, 500);
  }
}