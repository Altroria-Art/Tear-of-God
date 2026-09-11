export function loginPath(next) {
  return `/login?next=${encodeURIComponent(next)}`;
}

export function returnPath(search) {
  const next = new URLSearchParams(search).get('next');
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return '/';
  const url = new URL(next, window.location.origin);
  return url.origin === window.location.origin && url.pathname !== '/login' ? url.pathname + url.search + url.hash : '/';
}
