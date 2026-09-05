export async function onRequest({ request, env }) {
  const jsonResponse = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    // Check if the STORAGE binding exists (configured in wrangler.toml)
    if (!env.STORAGE) {
      return jsonResponse({ error: 'R2 bucket binding (STORAGE) is not configured' }, 500);
    }

    const formData = await request.formData();
    const file = formData.get('file');
    // folder ที่เซฟลง R2 — จำกัดให้เจอแค่ค่าที่เรากำหนดเท่านั้น (กัน abuse ยัด path ตามใจ)
    const folder = formData.get('folder') || 'profiles/';
    const ALLOWED_FOLDERS = ['profiles/', 'items/'];
    if (!ALLOWED_FOLDERS.includes(folder)) {
      return jsonResponse({ error: 'โฟลเดอร์ไม่ถูกต้อง' }, 400);
    }

    if (!file || !file.name) {
      return jsonResponse({ error: 'No file provided' }, 400);
    }

    // จำกัด type: allowlist รูปภาพเท่านั้น (กัน SVG ที่ฝัง script ได้ = XSS ผ่าน avatar_url)
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif'];

    const fileExtension = (file.name.split('.').pop() || '').toLowerCase();
    if (!file.type || !ALLOWED_TYPES.includes(file.type)) {
      return jsonResponse({ error: 'ชนิดไฟล์ไม่ถูกต้อง — อนุญาตเฉพาะ JPG, PNG, WEBP, GIF' }, 415);
    }
    if (!allowedExtensions.includes(fileExtension)) {
      return jsonResponse({ error: 'นามสกุลไฟล์ไม่ถูกต้อง' }, 415);
    }

    // จำกัดขนาด ≤ 5MB — กัน memory/bandwidth abuse
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return jsonResponse({ error: 'ไฟล์ใหญ่เกินไป — จำกัดสูงสุด 5MB' }, 413);
    }

    // You must replace this with your actual R2 public URL or custom domain URL
    const R2_PUBLIC_URL = 'https://pub-dd67d11fd9e04c8183c7121ba6ea7a5a.r2.dev'; 

    const uniqueFilename = `${folder}${crypto.randomUUID()}.${fileExtension}`;

    // Upload to R2
    await env.STORAGE.put(uniqueFilename, file.stream(), {
      httpMetadata: {
        contentType: file.type,
      },
    });

    const publicUrl = `${R2_PUBLIC_URL}/${uniqueFilename}`;
    
    return jsonResponse({ success: true, url: publicUrl });

  } catch (err) {
    console.error(err);
    return jsonResponse({ error: err.message }, 500);
  }
}
