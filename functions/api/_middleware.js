import { readSession } from '../lib/session.js';

export async function onRequest(context) {
  const { request, env } = context;
  const path = new URL(request.url).pathname.replace(/\/$/, '');
  const mutation = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
  if (mutation) {
    const origin = request.headers.get('Origin');
    if ((origin && origin !== new URL(request.url).origin) || request.headers.get('Sec-Fetch-Site') === 'cross-site') {
      return Response.json({ success: false, error: 'Cross-origin request rejected' }, { status: 403 });
    }
    const contentType = request.headers.get('Content-Type') || '';
    if (path !== '/api/upload' && !contentType.startsWith('application/json')) {
      return Response.json({ success: false, error: 'Expected application/json' }, { status: 415 });
    }
  }
  try {
    context.data.user = await readSession(request, env.tear_of_god_db);
    if (((mutation && path !== '/api/auth') || path === '/api/admin' || path.startsWith('/api/admin/')) && !context.data.user) {
      return Response.json({ success: false, error: 'กรุณาเข้าสู่ระบบอีกครั้ง / Please log in again' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
    }
    const response = await context.next();
    const privateResponse = new Response(response.body, response);
    privateResponse.headers.append('Vary', 'Cookie');
    if (context.data.user || path === '/api/auth') {
      privateResponse.headers.set('Cache-Control', 'private, no-store');
    }
    return privateResponse;
  } catch (error) {
    console.error('API request failed:', { name: error.name, message: error.message });
    return Response.json({ success: false, error: 'Service temporarily unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
