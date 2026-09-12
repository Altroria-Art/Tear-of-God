export const INPUT_LIMITS = Object.freeze({
  json: 16 * 1024,
  authJson: 32 * 1024,
  rankingJson: 512 * 1024,
  uploadBytes: 5 * 1024 * 1024,
  uploadRequestBytes: 5 * 1024 * 1024 + 256 * 1024,
  title: 200,
  description: 5000,
  category: 100,
  tiers: 20,
  tierLabel: 50,
  tierColor: 100,
  items: 500,
  itemName: 100,
  hashtags: 20,
  hashtag: 50,
  comment: 1000,
  reportReason: 1000,
  id: 128,
});

export class RequestError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'RequestError';
    this.status = status;
  }
}

export function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

async function readBodyBytes(request, maxBytes) {
  const declared = Number(request.headers.get('Content-Length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new RequestError('Request body is too large', 413);
  }
  if (!request.body) throw new RequestError('Request body is required');

  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      try { await reader.cancel(); } catch { /* The response will still be rejected. */ }
      throw new RequestError('Request body is too large', 413);
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function readJsonBody(request, maxBytes = INPUT_LIMITS.json) {
  const bytes = await readBodyBytes(request, maxBytes);
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new RequestError('Invalid JSON body'); }
}

export async function readFormDataBody(request, maxBytes = INPUT_LIMITS.uploadRequestBytes) {
  const contentType = request.headers.get('Content-Type') || '';
  if (!contentType.toLowerCase().startsWith('multipart/form-data;')) {
    throw new RequestError('Expected multipart form data', 415);
  }
  const bytes = await readBodyBytes(request, maxBytes);
  try {
    return await new Response(bytes, { headers: { 'Content-Type': contentType } }).formData();
  } catch {
    throw new RequestError('Invalid multipart form data');
  }
}

export function assertString(value, field, { min = 0, max, trim = false, optional = false } = {}) {
  if (optional && (value === undefined || value === null)) return value;
  if (typeof value !== 'string') throw new RequestError(`${field} must be a string`);
  const checked = trim ? value.trim() : value;
  if (checked.length < min || (max !== undefined && checked.length > max)) {
    const range = min > 0 ? `${min}-${max}` : `at most ${max}`;
    throw new RequestError(`${field} must be ${range} characters`);
  }
  return checked;
}

export function assertId(value, field = 'id', { optional = false } = {}) {
  if (optional && (value === undefined || value === null || value === '')) return value;
  const checked = assertString(value, field, { min: 1, max: INPUT_LIMITS.id, trim: true });
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(checked)) {
    throw new RequestError(`${field} is invalid`);
  }
  return checked;
}

export function assertInteger(value, field, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RequestError(`${field} must be an integer between ${min} and ${max}`);
  }
  return value;
}

export function assertHashtags(value, field = 'hashtags', { required = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new RequestError(`${field} is required`);
    return [];
  }
  assertString(value, field, { max: INPUT_LIMITS.hashtags * (INPUT_LIMITS.hashtag + 2) });
  const tags = value.split(',').map((tag) => tag.trim()).filter(Boolean);
  if ((required && tags.length === 0) || tags.length > INPUT_LIMITS.hashtags) {
    throw new RequestError(`${field} must contain 1-${INPUT_LIMITS.hashtags} tags`);
  }
  for (const tag of tags) {
    const text = tag.replace(/^#/, '').trim();
    if (!text || text.length > INPUT_LIMITS.hashtag || text.includes(',') || [...text].some(char => char.charCodeAt(0) <= 31)) {
      throw new RequestError(`Each hashtag must be 1-${INPUT_LIMITS.hashtag} characters`);
    }
  }
  return tags;
}

const memoryBuckets = new Map();
const MAX_BUCKETS = 10000;
let lastSweep = 0;

export function clientAddress(request) {
  return request.headers.get('CF-Connecting-IP') || 'unknown';
}

export function consumeMemoryRateLimit(scope, subject, { limit, windowSeconds }) {
  const now = Date.now();
  if (now - lastSweep > 60000) {
    for (const [key, entry] of memoryBuckets) {
      if (entry.resetAt <= now) memoryBuckets.delete(key);
    }
    lastSweep = now;
  }
  while (memoryBuckets.size >= MAX_BUCKETS) {
    memoryBuckets.delete(memoryBuckets.keys().next().value);
  }

  const key = `${scope}:${subject}`;
  let entry = memoryBuckets.get(key);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + windowSeconds * 1000 };
    memoryBuckets.set(key, entry);
  }
  entry.count += 1;
  const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
  return { allowed: entry.count <= limit, retryAfter };
}

export function rateLimitResponse(result, error = 'Too many requests') {
  return Response.json(
    { success: false, error },
    { status: 429, headers: { 'Cache-Control': 'no-store', 'Retry-After': String(result.retryAfter) } }
  );
}

export function requestErrorResponse(error) {
  if (!(error instanceof RequestError)) return null;
  return Response.json(
    { success: false, error: error.message },
    { status: error.status, headers: { 'Cache-Control': 'no-store' } }
  );
}

export function checkContentLength(request, maxBytes) {
  const declared = Number(request.headers.get('Content-Length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new RequestError('Request body is too large', 413);
  }
}

export const IMAGE_TYPES = Object.freeze({
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
});

export async function hasValidImageSignature(file) {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (file.type === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (file.type === 'image/png') return bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, i) => bytes[i] === byte);
  if (file.type === 'image/gif') {
    const signature = new TextDecoder().decode(bytes.slice(0, 6));
    return signature === 'GIF87a' || signature === 'GIF89a';
  }
  if (file.type === 'image/webp') {
    return new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF'
      && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP';
  }
  return false;
}
