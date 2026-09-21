const SESSION_KEY = 'tog-analytics-session';
const trackedOnce = new Set();
let memorySessionId = null;
let pendingEvents = [];

function sendEvent(payload, scopedKey) {
  pendingEvents.push({ payload, scopedKey });
  if (pendingEvents.length === 1) queueMicrotask(flushEvents);
}

function flushEvents() {
  const events = pendingEvents;
  pendingEvents = [];
  for (let offset = 0; offset < events.length; offset += 20) {
    const batch = events.slice(offset, offset + 20);
    const payload = batch.length === 1 ? batch[0].payload : { events: batch.map(event => event.payload) };
    // Same-tick batching only: no timer or unload buffer, and no event sampling.
    void fetch('/api/analytics', {
      method: 'POST', credentials: 'same-origin', keepalive: true,
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    }).then(response => {
      for (const { scopedKey } of batch) {
        if (!scopedKey) continue;
        if (response.ok) markOncePersisted(scopedKey);
        else trackedOnce.delete(scopedKey);
      }
    }).catch(() => {
      for (const { scopedKey } of batch) if (scopedKey) trackedOnce.delete(scopedKey);
    });
  }
}

function randomId(prefix) {
  if (globalThis.crypto?.randomUUID) return `${prefix}_${globalThis.crypto.randomUUID()}`;
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

function analyticsSessionId() {
  if (memorySessionId) return memorySessionId;
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) {
      memorySessionId = existing;
      return existing;
    }
    memorySessionId = randomId('session');
    sessionStorage.setItem(SESSION_KEY, memorySessionId);
    return memorySessionId;
  } catch {
    memorySessionId = randomId('session');
    return memorySessionId;
  }
}

// Deterministic non-cryptographic 64-bit hash (dual 32-bit streams) for compact
// event identity. Synchronous and zero-dependency to avoid microtask delays before
// dispatching keepalive fetch requests.
function hash64Hex(str) {
  let h1 = 0x811c9dc5;
  let h2 = 0x27d4eb2f;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x5bd1e995) >>> 0;
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}

function sessionOnceKey(sessionId, onceKey) {
  return `${sessionId}:${onceKey}`;
}

function isOnceTracked(scopedKey) {
  if (!scopedKey) return false;
  if (trackedOnce.has(scopedKey)) return true;
  try {
    return sessionStorage.getItem(`analytics-once:${scopedKey}`) === '1';
  } catch {
    return false;
  }
}

function markOncePersisted(scopedKey) {
  if (!scopedKey) return;
  try {
    sessionStorage.setItem(`analytics-once:${scopedKey}`, '1');
  } catch {
    // sessionStorage unavailable or quota exceeded; fallback to in-memory trackedOnce
  }
}

function deterministicEventId(sessionId, eventName, onceKey) {
  const hash = hash64Hex(String(onceKey));
  return `evt_${sessionId}:${eventName}:${hash}`;
}

export function trackEvent(eventName, { entityType = null, entityId = null, onceKey = null } = {}) {
  const sessionId = analyticsSessionId();
  const scopedKey = onceKey ? sessionOnceKey(sessionId, onceKey) : null;

  if (scopedKey && isOnceTracked(scopedKey)) return;
  if (scopedKey) trackedOnce.add(scopedKey);

  const eventId = onceKey
    ? deterministicEventId(sessionId, eventName, onceKey)
    : randomId('event');

  const payload = {
    event_id: eventId,
    event_name: eventName,
    session_id: sessionId,
    entity_type: entityType,
    entity_id: entityId == null ? null : String(entityId),
  };

  sendEvent(payload, scopedKey);
}

function entityFromUrl(target) {
  try {
    const url = new URL(target, window.location.origin);
    const segments = url.pathname.split('/').filter(Boolean);
    if (segments[0] === 'post' && segments[1]) return { entityType: 'ranking', entityId: segments[1] };
    if (segments[0] === 'template' && segments[1]) return { entityType: 'template', entityId: segments[1] };
    if (segments[0] === 'compare' && segments[1] && segments[2]) {
      return { entityType: 'comparison', entityId: `${segments[1]}:${segments[2]}` };
    }
    const challengeId = url.searchParams.get('challenge');
    if (segments[0] === 'rank' && challengeId) return { entityType: 'challenge', entityId: challengeId };
  } catch {
    // A malformed target still records a generic share without including it.
  }
  return {};
}

export function trackShare(target, kind = 'share') {
  const entity = entityFromUrl(target);
  trackEvent('share_complete', entity);
  if (kind === 'challenge' && entity.entityId) {
    trackEvent('challenge_share', { entityType: 'challenge', entityId: entity.entityId });
  }
}
