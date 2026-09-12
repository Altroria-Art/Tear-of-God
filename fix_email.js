const fs = require('fs');
const path = './functions/api/auth.js';
let content = fs.readFileSync(path, 'utf8');

const startIndex = content.indexOf('if (env.RESEND_API_KEY) {');
const endIndexStr = '} else {\n              emailSent = true;\n            }\n          } catch (e) {\n            console.error(\'Resend fetch failed\', { error: e.message });\n          }\n\n          if (!emailSent) {\n            try {\n              await db.prepare(\'DELETE FROM password_resets WHERE user_id = ?\').bind(user.id).run();\n            } catch (cleanupErr) {\n              console.error(\'Failed to cleanup reset token\', { error: cleanupErr.message });\n            }\n          }\n        }';
const endIndex = content.indexOf(endIndexStr);

if (startIndex !== -1 && endIndex !== -1) {
  const replacement = if (env.BREVO_API_KEY) {
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
                htmlContent: \<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>รีเซ็ตรหัสผ่านบัญชี Tear of God</h2>
                    <p>เราได้รับคำขอให้ตั้งรหัสผ่านใหม่สำหรับบัญชีของคุณ</p>
                    <p>กรุณาคลิกปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่:</p>
                    <a href="\" style="display: inline-block; padding: 12px 24px; background: #4f46e5; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 16px 0;">ตั้งรหัสผ่านใหม่</a>
                    <p style="color: #666; font-size: 14px;">ลิงก์นี้มีอายุการใช้งานตามที่ระบบกำหนด (1 ชั่วโมง)</p>
                    <p style="color: #666; font-size: 14px;">หากคุณไม่ได้เป็นผู้ร้องขอให้เปลี่ยนรหัสผ่าน โปรดเพิกเฉยต่ออีเมลฉบับนี้</p>
                  </div>\
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
        };
  
  content = content.substring(0, startIndex) + replacement + content.substring(endIndex + endIndexStr.length);
  fs.writeFileSync(path, content, 'utf8');
  console.log('Replaced successfully!');
} else {
  console.log('Could not find block. startIndex:', startIndex, 'endIndex:', endIndex);
}
