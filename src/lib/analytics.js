const SESSION_KEY = 'tog-analytics-session';
const trackedOnce = new Set();
let memorySessionId = null;

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

export function trackEvent(eventName, { entityType = null, entityId = null, onceKey = null } = {}) {
  if (onceKey && trackedOnce.has(onceKey)) return;
  if (onceKey) trackedOnce.add(onceKey);

  const payload = {
    event_id: randomId('event'),
    event_name: eventName,
    session_id: analyticsSessionId(),
    entity_type: entityType,
    entity_id: entityId == null ? null : String(entityId),
  };

  // Analytics must never block the user flow. keepalive lets publish/share
  // events finish while React is navigating to the next screen.
  void fetch('/api/analytics', {
    method: 'POST',
    credentials: 'same-origin',
    keepalive: true,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {});
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
