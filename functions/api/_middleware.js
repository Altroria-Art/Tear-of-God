import { readSession } from '../lib/session.js';

const BASIC_SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'X-Frame-Options': 'SAMEORIGIN',
};

const MAINTENANCE_READ_ONLY_VALUE = '1';
const MAINTENANCE_RETRY_AFTER_SECONDS = 300;

function withSecurityHeaders(response) {
  const securedResponse = new Response(response.body, response);
  for (const [name, value] of Object.entries(BASIC_SECURITY_HEADERS)) {
    securedResponse.headers.set(name, value);
  }
  return securedResponse;
}

export async function onRequest(context) {
  const { request, env } = context;
  const mutation = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
  if (env.MAINTENANCE_READ_ONLY === MAINTENANCE_READ_ONLY_VALUE && mutation) {
    return withSecurityHeaders(Response.json(
      {
        success: false,
        error: 'Service temporarily read-only',
        code: 'MAINTENANCE_READ_ONLY',
      },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store',
          'Retry-After': String(MAINTENANCE_RETRY_AFTER_SECONDS),
        },
      },
    ));
  }

  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, '');
  if (mutation) {
    const origin = request.headers.get('Origin');
    if ((origin && origin !== new URL(request.url).origin) || request.headers.get('Sec-Fetch-Site') === 'cross-site') {
      return withSecurityHeaders(Response.json({ success: false, error: 'Cross-origin request rejected' }, { status: 403 }));
    }
    const contentType = request.headers.get('Content-Type') || '';
    if (path !== '/api/upload' && !contentType.startsWith('application/json')) {
      return withSecurityHeaders(Response.json({ success: false, error: 'Expected application/json' }, { status: 415 }));
    }
  }
  try {
    const isPublicSpotlight = path === '/api/spotlights' && request.method === 'GET';
    const isPublicSuggestion =
      request.method === 'GET' &&
      url.searchParams.get('suggest') === '1' &&
      (
        (path === '/api/templates' && !url.searchParams.has('id')) ||
        path === '/api/hashtags'
      );
    const skipSessionLookup = isPublicSpotlight || isPublicSuggestion;
    context.data.user = skipSessionLookup
      ? null
      : await readSession(request, env.tear_of_god_db);
    const guestMutation = path === '/api/auth' || path === '/api/analytics';
    if (((mutation && !guestMutation) || path === '/api/admin' || path.startsWith('/api/admin/')) && !context.data.user) {
      return withSecurityHeaders(Response.json({ success: false, error: 'กรุณาเข้าสู่ระบบอีกครั้ง / Please log in again' }, { status: 401, headers: { 'Cache-Control': 'no-store' } }));
    }
    const response = await context.next();
    const privateResponse = withSecurityHeaders(response);
    if (!isPublicSpotlight) {
      privateResponse.headers.append('Vary', 'Cookie');
      if (context.data.user || path === '/api/auth') {
        privateResponse.headers.set('Cache-Control', 'private, no-store');
      }
    }
    return privateResponse;
  } catch (error) {
    console.error('API request failed:', { name: error.name, message: error.message });
    return withSecurityHeaders(Response.json({ success: false, error: 'Service temporarily unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }));
  }
}
