import { IMAGE_TYPES, INPUT_LIMITS, consumeMemoryRateLimit, hasValidImageSignature, rateLimitResponse, readFormDataBody, requestErrorResponse } from '../lib/request-guard.js';

export async function onRequest({ request, env, data: auth }) {
  const jsonResponse = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const user_id = auth.user.id;
    const gate = consumeMemoryRateLimit('image-upload', user_id, { limit: 5, windowSeconds: 900 });
    if (!gate.allowed) return rateLimitResponse(gate);

    // Check if the STORAGE binding exists (configured in wrangler.toml)
    if (!env.STORAGE) {
      return jsonResponse({ error: 'Service temporarily unavailable' }, 500);
    }

    const formData = await readFormDataBody(request);
    const file = formData.get('file');
    const user = await env.tear_of_god_db.prepare('SELECT id FROM profiles WHERE id = ?').bind(user_id).first();
    if (!user) {
      return jsonResponse({ error: 'Unauthorized: invalid user' }, 403);
    }

    if (!file || typeof file.arrayBuffer !== 'function' || typeof file.stream !== 'function') {
      return jsonResponse({ error: 'No file provided' }, 400);
    }

    // จำกัด type: allowlist รูปภาพเท่านั้น (กัน SVG ที่ฝัง script ได้ = XSS ผ่าน avatar_url)
    const fileExtension = IMAGE_TYPES[file.type];
    if (!fileExtension) {
      return jsonResponse({ error: 'ชนิดไฟล์ไม่ถูกต้อง — อนุญาตเฉพาะ JPG, PNG, WEBP, GIF' }, 415);
    }

    // จำกัดขนาด ≤ 5MB — กัน memory/bandwidth abuse
    if (!Number.isFinite(file.size) || file.size <= 0 || file.size > INPUT_LIMITS.uploadBytes) {
      return jsonResponse({ error: 'ไฟล์ใหญ่เกินไป — จำกัดสูงสุด 5MB' }, 413);
    }
    if (!await hasValidImageSignature(file)) {
      return jsonResponse({ error: 'เนื้อหาไฟล์ไม่ตรงกับชนิดรูปภาพ' }, 415);
    }

    // You must replace this with your actual R2 public URL or custom domain URL
    const R2_PUBLIC_URL = env.R2_PUBLIC_URL || 'https://pub-dd67d11fd9e04c8183c7121ba6ea7a5a.r2.dev'; 

    const uniqueFilename = `profiles/${crypto.randomUUID()}.${fileExtension}`;

    // Upload to R2
    await env.STORAGE.put(uniqueFilename, file.stream(), {
      httpMetadata: {
        contentType: file.type,
      },
    });

    const publicUrl = `${R2_PUBLIC_URL}/${uniqueFilename}`;
    
    return jsonResponse({ success: true, url: publicUrl });

  } catch (err) {
    const invalid = requestErrorResponse(err);
    if (invalid) return invalid;
    console.error('Upload failed:', err.message);
    return jsonResponse({ error: 'Service temporarily unavailable' }, 500);
  }
}
