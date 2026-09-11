import { UP_UNIVERSITY_NAME, getFacultyByName, isValidAdmissionYear } from '../../src/lib/university.js';
import { createSession, hashPassword, requireUser, revokeSession, verifyFirebaseIdToken, verifyPassword } from './_auth.js';

const jsonResponse = (data, status = 200) => Response.json(data, {
  status,
  headers: { 'Cache-Control': 'no-store' },
});

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function profileData(user, token) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    bio: user.bio || null,
    avatar_url: user.avatar_url || null,
    university: user.university || null,
    faculty: user.faculty || null,
    major: user.major || null,
    year: user.year || null,
    role: user.role || 'user',
    ...(token ? { token } : {}),
  };
}

function validateEducation({ university, faculty, major, year }) {
  const knownFaculty = faculty !== undefined && faculty !== null && faculty !== ''
    ? getFacultyByName(faculty)
    : null;
  if (university !== undefined && university !== null && university !== '' && university !== UP_UNIVERSITY_NAME) return 'มหาวิทยาลัยไม่ถูกต้อง';
  if (faculty !== undefined && faculty !== null && faculty !== '' && !knownFaculty) return 'คณะไม่ถูกต้อง';
  if (major !== undefined && major !== null && major !== '' && (!knownFaculty || !knownFaculty.majors.includes(major))) return 'สาขาไม่ตรงกับคณะที่เลือก';
  if (year !== undefined && year !== null && year !== '' && !isValidAdmissionYear(year)) return 'ปีเข้าศึกษาไม่ถูกต้อง';
  return null;
}

export async function onRequest({ request, env }) {
  const db = env.tear_of_god_db;
  if (request.method !== 'POST') return jsonResponse({ success: false, error: 'Method not allowed' }, 405);

  try {
    const payload = await request.json();

    if (payload.action === 'register') {
      const email = normalizeEmail(payload.email);
      const password = payload.password;
      const username = typeof payload.username === 'string' ? payload.username.trim() : '';
      if (!email || !password || !username) return jsonResponse({ success: false, error: 'กรุณากรอกข้อมูลให้ครบถ้วน' }, 400);
      if (password.length < 8) return jsonResponse({ success: false, error: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' }, 400);
      if (username.length > 60) return jsonResponse({ success: false, error: 'ชื่อผู้ใช้ยาวเกินไป' }, 400);

      const existing = await db.prepare('SELECT id FROM profiles WHERE email = ?').bind(email).first();
      if (existing) return jsonResponse({ success: false, error: 'อีเมลนี้ถูกใช้งานเรียบร้อยแล้ว' }, 409);

      const userId = `user_${crypto.randomUUID()}`;
      const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(username)}`;
      await db.prepare('INSERT INTO profiles (id, username, email, password, avatar_url) VALUES (?1, ?2, ?3, ?4, ?5)')
        .bind(userId, username, email, await hashPassword(password), avatar).run();
      return jsonResponse({ success: true, data: { id: userId, username, email, avatar_url: avatar, role: 'user' } }, 201);
    }

    if (payload.action === 'login') {
      const email = normalizeEmail(payload.email);
      const password = payload.password;
      if (!email || typeof password !== 'string') return jsonResponse({ success: false, error: 'กรุณากรอกอีเมลและรหัสผ่าน' }, 400);

      const user = await db.prepare(
        'SELECT id, username, email, password, bio, avatar_url, university, faculty, major, year, role FROM profiles WHERE email = ? LIMIT 1',
      ).bind(email).first();
      const checked = await verifyPassword(password, user?.password);
      if (!user || !checked.valid) return jsonResponse({ success: false, error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' }, 401);
      if (checked.needsUpgrade) await db.prepare('UPDATE profiles SET password = ? WHERE id = ?').bind(await hashPassword(password), user.id).run();

      return jsonResponse({ success: true, data: profileData(user, await createSession(db, user.id)) });
    }

    if (payload.action === 'google_sync') {
      const claims = await verifyFirebaseIdToken(payload.idToken);
      const email = normalizeEmail(claims.email);
      if (!email || claims.email_verified !== true) return jsonResponse({ success: false, error: 'บัญชี Google นี้ยังไม่ได้ยืนยันอีเมล' }, 401);

      const username = ((typeof claims.name === 'string' && claims.name.trim()) || email.split('@')[0]).slice(0, 60);
      const avatarUrl = typeof claims.picture === 'string' ? claims.picture : null;
      let user = await db.prepare(
        'SELECT id, username, email, bio, avatar_url, university, faculty, major, year, role FROM profiles WHERE email = ? LIMIT 1',
      ).bind(email).first();

      if (!user) {
        const id = `firebase_${claims.sub}`;
        await db.prepare('INSERT INTO profiles (id, username, email, avatar_url) VALUES (?1, ?2, ?3, ?4)')
          .bind(id, username, email, avatarUrl).run();
        user = await db.prepare(
          'SELECT id, username, email, bio, avatar_url, university, faculty, major, year, role FROM profiles WHERE id = ?',
        ).bind(id).first();
      } else {
        await db.prepare('UPDATE profiles SET username = ?1, avatar_url = ?2 WHERE id = ?3').bind(username, avatarUrl, user.id).run();
        user = { ...user, username, avatar_url: avatarUrl };
      }

      return jsonResponse({ success: true, data: profileData(user, await createSession(db, user.id)) });
    }

    if (payload.action === 'logout') {
      await revokeSession(request, env);
      return jsonResponse({ success: true });
    }

    if (payload.action === 'update_profile') {
      const actor = await requireUser(request, env);
      if (!actor) return jsonResponse({ success: false, error: 'กรุณาเข้าสู่ระบบใหม่' }, 401);
      const educationError = validateEducation(payload);
      if (educationError) return jsonResponse({ success: false, error: educationError }, 400);

      const updates = [];
      const params = [];
      if (payload.username !== undefined) {
        const username = typeof payload.username === 'string' ? payload.username.trim() : '';
        if (!username || username.length > 60) return jsonResponse({ success: false, error: 'ชื่อผู้ใช้ไม่ถูกต้อง' }, 400);
        updates.push('username = ?'); params.push(username);
      }
      if (payload.bio !== undefined) {
        if (typeof payload.bio !== 'string' || payload.bio.length > 500) return jsonResponse({ success: false, error: 'ประวัติส่วนตัวยาวเกินไป' }, 400);
        updates.push('bio = ?'); params.push(payload.bio);
      }
      if (payload.avatar_url !== undefined) { updates.push('avatar_url = ?'); params.push(payload.avatar_url); }
      if (payload.university !== undefined) { updates.push('university = ?'); params.push(payload.university); }
      if (payload.faculty !== undefined) { updates.push('faculty = ?'); params.push(payload.faculty); }
      if (payload.major !== undefined) { updates.push('major = ?'); params.push(payload.major); }
      if (payload.year !== undefined) { updates.push('year = ?'); params.push(payload.year); }
      if (payload.password !== undefined) {
        if (typeof payload.password !== 'string' || payload.password.length < 8) return jsonResponse({ success: false, error: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' }, 400);
        updates.push('password = ?'); params.push(await hashPassword(payload.password));
      }
      if (updates.length === 0) return jsonResponse({ success: false, error: 'No fields to update' }, 400);

      params.push(actor.id);
      await db.prepare(`UPDATE profiles SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();
      const user = await db.prepare(
        'SELECT id, username, email, bio, avatar_url, university, faculty, major, year, role FROM profiles WHERE id = ?',
      ).bind(actor.id).first();
      return jsonResponse({ success: true, data: profileData(user) });
    }

    return jsonResponse({ success: false, error: 'Invalid action' }, 400);
  } catch (error) {
    console.error('auth error', error);
    return jsonResponse({ success: false, error: 'เกิดข้อผิดพลาดในการยืนยันตัวตน' }, 500);
  }
}
