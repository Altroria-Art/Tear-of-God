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

    if (!file || !file.name) {
      return jsonResponse({ error: 'No file provided' }, 400);
    }

    // You must replace this with your actual R2 public URL or custom domain URL
    const R2_PUBLIC_URL = 'https://pub-dd67d11fd9e04c8183c7121ba6ea7a5a.r2.dev'; 

    const fileExtension = file.name.split('.').pop();
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
    console.error(err);
    return jsonResponse({ error: err.message }, 500);
  }
}
