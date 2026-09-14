const DEFAULT_DESCRIPTION = 'สร้าง จัดอันดับ และถกเถียง Tier List ไปกับชุมชน Tear of God';

function cleanText(value, fallback = '', maxLength = 180) {
  const text = String(value || fallback)
    .replace(/\p{Cc}+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function replaceMeta(html, attribute, key, content) {
  const tag = `<meta ${attribute}="${key}" content="${escapeHtml(content)}" />`;
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`<meta\\s+${attribute}=["']${escapedKey}["'][^>]*>`, 'i');
  return pattern.test(html)
    ? html.replace(pattern, tag)
    : html.replace('</head>', `    ${tag}\n  </head>`);
}

function replaceCanonical(html, url) {
  const tag = `<link rel="canonical" href="${escapeHtml(url)}" />`;
  const pattern = /<link\s+rel=["']canonical["'][^>]*>/i;
  return pattern.test(html)
    ? html.replace(pattern, tag)
    : html.replace('</head>', `    ${tag}\n  </head>`);
}

export async function serveAppWithMeta(context, metadata = {}) {
  const assetResponse = await context.next();
  const contentType = assetResponse.headers.get('Content-Type') || '';
  if (!contentType.toLowerCase().includes('text/html')) return assetResponse;

  const requestUrl = new URL(context.request.url);
  const canonicalUrl = metadata.url || `${requestUrl.origin}${requestUrl.pathname}${requestUrl.search}`;
  const title = cleanText(metadata.title, 'Tear of God', 90);
  const pageTitle = title === 'Tear of God' ? title : `${title} | Tear of God`;
  const description = cleanText(metadata.description, DEFAULT_DESCRIPTION, 180);
  const imageUrl = metadata.image || `${requestUrl.origin}/og-default.png`;
  const type = metadata.type || 'website';

  let html = await assetResponse.text();
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(pageTitle)}</title>`);
  html = replaceMeta(html, 'name', 'description', description);
  html = replaceMeta(html, 'property', 'og:site_name', 'Tear of God');
  html = replaceMeta(html, 'property', 'og:type', type);
  html = replaceMeta(html, 'property', 'og:title', pageTitle);
  html = replaceMeta(html, 'property', 'og:description', description);
  html = replaceMeta(html, 'property', 'og:url', canonicalUrl);
  html = replaceMeta(html, 'property', 'og:image', imageUrl);
  html = replaceMeta(html, 'property', 'og:image:type', 'image/png');
  html = replaceMeta(html, 'property', 'og:image:width', '1200');
  html = replaceMeta(html, 'property', 'og:image:height', '630');
  html = replaceMeta(html, 'property', 'og:image:alt', metadata.imageAlt || 'Tear of God — Community Tier Lists');
  html = replaceMeta(html, 'name', 'twitter:card', 'summary_large_image');
  html = replaceMeta(html, 'name', 'twitter:title', pageTitle);
  html = replaceMeta(html, 'name', 'twitter:description', description);
  html = replaceMeta(html, 'name', 'twitter:image', imageUrl);
  html = replaceCanonical(html, canonicalUrl);

  const headers = new Headers(assetResponse.headers);
  headers.delete('Content-Length');
  headers.delete('Content-Encoding');
  headers.delete('ETag');
  headers.set('Content-Type', 'text/html; charset=UTF-8');
  headers.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');

  return new Response(html, {
    status: assetResponse.status,
    statusText: assetResponse.statusText,
    headers
  });
}

export function fallbackDescription(subject, itemCount) {
  const countText = Number(itemCount) > 0 ? ` ${Number(itemCount)} รายการ` : '';
  return `มาจัดอันดับ${countText}ใน “${cleanText(subject, 'Tier List', 90)}” แล้วเทียบความเห็นกับชุมชน Tear of God`;
}

export function compactHashtags(raw) {
  return String(raw || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(' ');
}
