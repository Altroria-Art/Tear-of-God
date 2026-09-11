import { UP_UNIVERSITY_NAME, getFacultyByName, isValidAdmissionYear } from '../../src/lib/university.js';

import { firebaseConfig } from '../../src/lib/firebaseConfig.js';
import { PROFILE_FIELDS, hashPassword, verifyPassword, allowAuthAttempt, createSession, sessionCookie, sessionToken, digest } from '../lib/session.js';

const reply = (body, status = 200, headers = {}) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
const fail = (error, status = 400) => reply({ success: false, error }, status);
const validPassword = value => typeof value === 'string' && value.length >= 8 && value.length <= 256;

async function findByEmail(db, email) {
  const { results } = await db.prepare('SELECT * FROM profiles WHERE lower(email) = ? LIMIT 2').bind(email).all();
  return results.length === 1 ? results[0] : null;
}
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

export async function onRequest({ request, env, data: auth }) {
  const db = env.tear_of_god_db;
  if (request.method === 'GET') return reply({ success: true, data: auth.user });
  if (request.method !== 'POST') return fail('Method not allowed', 405);
  let payload;
  try { payload = await request.json(); } catch { return fail('Invalid JSON'); }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return fail('Invalid request');
  const { action, password } = payload;
  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
  try {

    if (['register', 'login', 'google_sync'].includes(action)) {
      const key = action === 'google_sync' ? 'google:' + (request.headers.get('CF-Connecting-IP') || 'local') : email;
      if (!await allowAuthAttempt(request, db, key)) {
        return reply({ success: false, error: 'ลองใหม่อีกครั้งใน 15 นาที / Please try again in 15 minutes' }, 429, { 'Retry-After': '900' });
      }
    }
    if (action === 'register') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return fail('อีเมลไม่ถูกต้อง / Invalid email');
      if (!validPassword(password)) return fail('รหัสผ่านต้องมี 8–256 ตัวอักษร / Use 8–256 characters');
      const name = typeof payload.username === 'string' ? payload.username.trim() : '';
      if (!name || name.length > 50) return fail('ชื่อต้องมี 1–50 ตัวอักษร / Use 1–50 characters for your name');
      if (await db.prepare('SELECT id FROM profiles WHERE lower(email) = ?').bind(email).first()) return fail('อีเมลนี้ถูกใช้งานแล้ว / Email already registered', 409);
      const userId = 'user_' + crypto.randomUUID();
      const avatar = 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + encodeURIComponent(name);
      await db.prepare('INSERT INTO profiles (id, username, email, password, avatar_url) VALUES (?, ?, ?, ?, ?)')
        .bind(userId, name, email, await hashPassword(password), avatar).run();
      return reply({ success: true }, 201);
    }
    if (action === 'login') {
      if (!email || typeof password !== 'string' || password.length > 256) return fail('อีเมลหรือรหัสผ่านไม่ถูกต้อง / Invalid email or password', 401);
      const user = await findByEmail(db, email);
      const dummy = 'pbkdf2-sha256$100000$' + '0'.repeat(32) + '$' + '0'.repeat(64);
      if (!await verifyPassword(password, user?.password || dummy)) return fail('อีเมลหรือรหัสผ่านไม่ถูกต้อง / Invalid email or password', 401);
      if (!user.password.startsWith('pbkdf2-')) {
        await db.prepare('UPDATE profiles SET password = ? WHERE id = ? AND password = ?').bind(await hashPassword(password), user.id, user.password).run();
      }
      const profile = await db.prepare('SELECT ' + PROFILE_FIELDS + ' FROM profiles WHERE id = ?').bind(user.id).first();
      return reply({ success: true, data: profile }, 200, { 'Set-Cookie': await createSession(request, db, user.id) });
    }
    if (action === 'google_sync') {
      if (typeof payload.idToken !== 'string' || payload.idToken.length > 10000) return fail('Missing Google ID token', 401);
      // Firebase validates the token for this project. Never trust a client-supplied email/uid.
      // https://firebase.google.com/docs/reference/rest/auth#section-get-account-info
      const response = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + firebaseConfig.apiKey, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: payload.idToken }), signal: AbortSignal.timeout(10000)
      });
      const account = (await response.json()).users?.[0];
      if (!response.ok || !account?.localId || !account.emailVerified || account.disabled || !account.providerUserInfo?.some(p => p.providerId === 'google.com')) {
        return fail('ยืนยันบัญชี Google ไม่สำเร็จ / Google verification failed', 401);
      }
      const identity = await db.prepare("SELECT user_id FROM auth_identities WHERE provider = 'google' AND subject = ?").bind(account.localId).first();
      let user = identity ? await db.prepare('SELECT * FROM profiles WHERE id = ?').bind(identity.user_id).first() : await findByEmail(db, account.email.toLowerCase());
      if (!user) {
        const id = 'user_' + crypto.randomUUID();
        await db.prepare('INSERT INTO profiles (id, username, email, avatar_url) VALUES (?, ?, ?, ?)')
          .bind(id, (account.displayName || account.email.split('@')[0]).slice(0, 50), account.email.toLowerCase(), account.photoUrl || null).run();
        user = { id };
      }
      await db.prepare("INSERT OR IGNORE INTO auth_identities (provider, subject, user_id) VALUES ('google', ?, ?)").bind(account.localId, user.id).run();
      const linked = await db.prepare("SELECT user_id FROM auth_identities WHERE provider = 'google' AND subject = ?").bind(account.localId).first();
      const profile = await db.prepare('SELECT ' + PROFILE_FIELDS + ' FROM profiles WHERE id = ?').bind(linked.user_id).first();
      return reply({ success: true, data: profile }, 200, { 'Set-Cookie': await createSession(request, db, profile.id) });
    }
    if (action === 'logout') {
      const token = sessionToken(request);
      if (token) await db.prepare('DELETE FROM auth_sessions WHERE token_hash = ?').bind(await digest(token)).run();
      return reply({ success: true }, 200, { 'Set-Cookie': sessionCookie(request, '', 0) });
    }
    if (action === 'update_profile') {
      if (!auth.user) return fail('กรุณาเข้าสู่ระบบ / Please log in', 401);
      const userId = auth.user.id;
      const { username, bio, avatar_url, university, faculty, major, year } = payload;
      const knownFaculty = getFacultyByName(faculty ?? auth.user.faculty);
      if (university && university !== UP_UNIVERSITY_NAME) return fail('มหาวิทยาลัยไม่ถูกต้อง');
      if (faculty && !knownFaculty) return fail('คณะไม่ถูกต้อง');
      if (major && (!knownFaculty || !knownFaculty.majors.includes(major))) return fail('สาขาไม่ตรงกับคณะที่เลือก');
      if (year && !isValidAdmissionYear(year)) return fail('ปีเข้าศึกษาไม่ถูกต้อง');
      if (username !== undefined && (typeof username !== 'string' || !username.trim() || username.length > 50)) return fail('ชื่อไม่ถูกต้อง / Invalid name');
      if (bio != null && (typeof bio !== 'string' || bio.length > 1000)) return fail('Bio must be at most 1000 characters');
      if (avatar_url && (typeof avatar_url !== 'string' || !/^https:\/\//.test(avatar_url) || avatar_url.length > 2000)) return fail('Invalid avatar URL');
      const fields = { username, bio, avatar_url, university, faculty, major, year };
      if (password !== undefined) {
        if (!validPassword(password) || typeof payload.currentPassword !== 'string' || payload.currentPassword.length > 256) return fail('กรุณาระบุรหัสผ่านปัจจุบันและรหัสใหม่อย่างน้อย 8 ตัวอักษร');
        if (!await allowAuthAttempt(request, db, auth.user.email)) return fail('Please try again later', 429);
        const stored = await db.prepare('SELECT password FROM profiles WHERE id = ?').bind(userId).first();
        if (!await verifyPassword(payload.currentPassword, stored.password)) return fail('รหัสผ่านปัจจุบันไม่ถูกต้อง / Incorrect current password', 403);
        fields.password = await hashPassword(password);
      }
      const entries = Object.entries(fields).filter(([, value]) => value !== undefined);
      if (!entries.length) return fail('No fields to update');
      const statements = [db.prepare('UPDATE profiles SET ' + entries.map(([key]) => key + ' = ?').join(', ') + ' WHERE id = ?').bind(...entries.map(([, value]) => value), userId)];
      if (password !== undefined) statements.push(db.prepare('DELETE FROM auth_sessions WHERE user_id = ?').bind(userId));
      await db.batch(statements);
      const profile = await db.prepare('SELECT ' + PROFILE_FIELDS + ' FROM profiles WHERE id = ?').bind(userId).first();
      return reply({ success: true, data: profile }, 200, password !== undefined ? { 'Set-Cookie': await createSession(request, db, userId) } : {});
    }
    return fail('Invalid action');
  } catch (error) {
    console.error('Authentication failed:', error.message);
    return fail('ไม่สามารถดำเนินการได้ กรุณาลองใหม่ / Please try again', 503);
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
