import { UP_UNIVERSITY_NAME, getFacultyByName, isValidAdmissionYear } from '../../src/lib/university.js';
import { firebaseConfig } from '../../src/lib/firebaseConfig.js';
import { PROFILE_FIELDS, hashPassword, verifyPassword, allowAuthAttempt, createSession, sessionCookie, sessionToken, digest, randomToken } from '../lib/session.js';
import { INPUT_LIMITS, assertString, clientAddress, consumeMemoryRateLimit, isPlainObject, rateLimitResponse, readJsonBody, requestErrorResponse } from '../lib/request-guard.js';

const reply = (body, status = 200, headers = {}) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
const fail = (error, status = 400) => reply({ success: false, error }, status);
const validPassword = value => typeof value === 'string' && value.length >= 8 && value.length <= 256;

async function findByEmail(db, email) {
  const { results } = await db.prepare('SELECT * FROM profiles WHERE lower(email) = ? LIMIT 2').bind(email).all();
  return results.length === 1 ? results[0] : null;
}

export async function onRequest({ request, env, data: auth }) {
  const db = env.tear_of_god_db;
  if (request.method === 'GET') return reply({ success: true, data: auth.user });
  if (request.method !== 'POST') return fail('Method not allowed', 405);
  const bodyGate = consumeMemoryRateLimit('auth-body', clientAddress(request), { limit: 60, windowSeconds: 60 });
  if (!bodyGate.allowed) return rateLimitResponse(bodyGate);
  let payload;
  try { payload = await readJsonBody(request, INPUT_LIMITS.authJson); } catch (error) { return requestErrorResponse(error) || fail('Invalid request'); }
  if (!isPlainObject(payload)) return fail('Invalid request');
  const { action, password } = payload;
  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
  try {
    const authPolicies = {
      login: { limit: 10, windowSeconds: 900 },
      register: { limit: 5, windowSeconds: 3600 },
      google_sync: { limit: 20, windowSeconds: 900 },
      forgot_password: { limit: 3, windowSeconds: 3600 },
      reset_password: { limit: 5, windowSeconds: 900 },
    };
    const authPolicy = authPolicies[action];
    if (authPolicy) {
      const identity = action === 'google_sync'
        ? clientAddress(request)
        : action === 'reset_password'
          ? (typeof payload.token === 'string' ? payload.token : clientAddress(request))
          : (email || clientAddress(request));
      const rate = await allowAuthAttempt(request, db, identity, { scope: action, ...authPolicy });
      if (!rate.allowed) return rateLimitResponse(rate, 'ลองใหม่ภายหลัง / Please try again later');
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
    if (action === 'forgot_password') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return fail('อีเมลไม่ถูกต้อง');
      
      const user = await findByEmail(db, email);
      if (user) {
        const token = randomToken();
        const tokenHash = await digest(token);
        const expiresAt = new Date(Date.now() + 3600000).toISOString();
        
        await db.batch([
          db.prepare('DELETE FROM password_resets WHERE user_id = ?').bind(user.id),
          db.prepare('INSERT INTO password_resets (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)')
            .bind('pr_' + crypto.randomUUID(), user.id, tokenHash, expiresAt)
        ]);

        const resetUrl = `${env.APP_URL || 'https://tear-of-god.pages.dev'}/reset-password?token=${token}`;
        
        if (env.BREVO_API_KEY) {
          let emailSent = false;
          try {
            const res = await fetch('https://api.brevo.com/v3/smtp/email', {
              method: 'POST',
              headers: {
                'accept': 'application/json',
                'content-type': 'application/json',
                'api-key': env.BREVO_API_KEY
              },
              body: JSON.stringify({
                sender: {
                  name: env.BREVO_FROM_NAME || 'Tear of God',
                  email: env.BREVO_FROM_EMAIL || 'pview5678fc@gmail.com'
                },
                to: [{ email: user.email }],
                subject: 'รีเซ็ตรหัสผ่าน Tear of God',
                htmlContent: `
                  <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>รีเซ็ตรหัสผ่านบัญชี Tear of God</h2>
                    <p>เราได้รับคำขอให้ตั้งรหัสผ่านใหม่สำหรับบัญชีของคุณ</p>
                    <p>กรุณาคลิกปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่:</p>
                    <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background: #4f46e5; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 16px 0;">ตั้งรหัสผ่านใหม่</a>
                    <p style="color: #666; font-size: 14px;">ลิงก์นี้มีอายุการใช้งานตามที่ระบบกำหนด (1 ชั่วโมง)</p>
                    <p style="color: #666; font-size: 14px;">หากคุณไม่ได้เป็นผู้ร้องขอให้เปลี่ยนรหัสผ่าน โปรดเพิกเฉยต่ออีเมลฉบับนี้</p>
                  </div>
                `
              })
            });
            if (!res.ok) {
              const errBody = await res.json().catch(() => ({}));
              console.error('Brevo send failed', { status: res.status, code: errBody.code });
            } else {
              emailSent = true;
            }
          } catch (e) {
            console.error('Brevo fetch failed', { error: e.message });
          }

          if (!emailSent) {
            try {
              await db.prepare('DELETE FROM password_resets WHERE user_id = ?').bind(user.id).run();
            } catch (cleanupErr) {
              console.error('Failed to cleanup reset token', { error: cleanupErr.message });
            }
          }
        }
      }
      return reply({ success: true, message: 'หากอีเมลนี้มีอยู่ในระบบ เราได้ส่งลิงก์สำหรับตั้งรหัสผ่านใหม่แล้ว' });
    }
    if (action === 'reset_password') {
      const { token, password: newPassword } = payload;
      
      if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) {
        return fail('ข้อมูลไม่ถูกต้อง');
      }
      if (!validPassword(newPassword)) {
        return fail('รหัสผ่านต้องมี 8–256 ตัวอักษร');
      }

      const tokenHash = await digest(token);
      const pr = await db.prepare('SELECT user_id, expires_at FROM password_resets WHERE token_hash = ?').bind(tokenHash).first();
      
      if (!pr) {
        return fail('ลิงก์ไม่ถูกต้องหรือถูกใช้งานไปแล้ว');
      }
      if (new Date(pr.expires_at).getTime() < Date.now()) {
        await db.prepare('DELETE FROM password_resets WHERE token_hash = ?').bind(tokenHash).run();
        return fail('ลิงก์หมดอายุแล้ว กรุณาขอลิงก์ใหม่');
      }

      const hashedNew = await hashPassword(newPassword);
      try {
        await db.batch([
          db.prepare('UPDATE profiles SET password = ? WHERE id = ?').bind(hashedNew, pr.user_id),
          db.prepare('DELETE FROM auth_sessions WHERE user_id = ?').bind(pr.user_id),
          db.prepare('DELETE FROM password_resets WHERE user_id = ?').bind(pr.user_id)
        ]);
        return reply({ success: true, message: 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว' });
      } catch (err) {
        console.error("Reset password DB error:", err.message);
        return fail('เกิดข้อผิดพลาดฐานข้อมูล');
      }
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
      const profileGate = consumeMemoryRateLimit('profile-update', userId, { limit: 20, windowSeconds: 3600 });
      if (!profileGate.allowed) return rateLimitResponse(profileGate);
      if (username !== undefined) assertString(username, 'username', { min: 1, max: 50, trim: true });
      if (bio != null) assertString(bio, 'bio', { max: 1000 });
      if (avatar_url != null) assertString(avatar_url, 'avatar_url', { max: 2000 });
      if (university != null) assertString(university, 'university', { max: 200 });
      if (faculty != null) assertString(faculty, 'faculty', { max: 200 });
      if (major != null) assertString(major, 'major', { max: 200 });
      if (year != null && typeof year !== 'string' && typeof year !== 'number') return fail('ปีเข้าศึกษาไม่ถูกต้อง');
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
        const passwordRate = await allowAuthAttempt(request, db, auth.user.email, { scope: 'change_password', limit: 5, windowSeconds: 900 });
        if (!passwordRate.allowed) return rateLimitResponse(passwordRate, 'Please try again later');
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
    const invalid = requestErrorResponse(error);
    if (invalid) return invalid;
    console.error('Authentication failed:', error.message);
    return fail('ไม่สามารถดำเนินการได้ กรุณาลองใหม่ / Please try again', 503);
  }
}
