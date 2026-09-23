// 📍 Shared helper สำหรับ Cache API ของ /api/spotlights
// ใช้สร้าง cache key ที่ตรงกันระหว่าง spotlights.js และ mutation endpoints
// พร้อม helper ในการ invalidate cache ทันทีที่มีการสร้างหรือลบคอมเมนต์

export const SPOTLIGHTS_CACHE_SCHEMA = 'hashtags-v1';

export function getSpotlightsCacheKey(requestOrUrl) {
  const url = typeof requestOrUrl === 'string'
    ? new URL(requestOrUrl)
    : new URL(requestOrUrl.url);
  return new Request(`${url.origin}/api/spotlights?schema=${SPOTLIGHTS_CACHE_SCHEMA}`, { method: 'GET' });
}

export async function invalidateSpotlightsCache(requestOrUrl) {
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  if (!cache) return false;
  try {
    const key = getSpotlightsCacheKey(requestOrUrl);
    return await cache.delete(key);
  } catch (err) {
    console.warn('Spotlights cache invalidation failed:', { name: err?.name, message: err?.message });
    return false;
  }
}
