export const DATA_CHANGE_EVENT = 'tog-data-change';
const SOCIAL_PATHS = /^\/api\/(comments|template-comments|votes|template-votes|notifications|rankings|templates|follows|topic-follows|bookmarks|admin\/comments)$/;
let channel;

// Only invalidation metadata crosses tabs; never send comment text or account data.
function getChannel() {
  if (channel || typeof window === 'undefined' || !window.BroadcastChannel) return channel;
  try { channel = new window.BroadcastChannel('tog-data-change'); }
  catch { return undefined; }
  channel.onmessage = ({ data }) => {
    if (data?.phase === 'settled' && SOCIAL_PATHS.test(data.path)) {
      window.dispatchEvent(new CustomEvent(DATA_CHANGE_EVENT, { detail: data }));
    }
  };
  return channel;
}

export function beginDataChange(path, body) {
  if (typeof window === 'undefined' || !SOCIAL_PATHS.test(path)) return () => {};
  let input = {};
  try { input = JSON.parse(body || '{}'); } catch { /* Non-JSON bodies have no scope. */ }
  if (!input || typeof input !== 'object') input = {};
  const detail = {
    id: crypto.randomUUID(), path, phase: 'started',
    rankingId: input.rankingId || input.ranking_id || (path === '/api/rankings' ? input.id : undefined),
    templateId: input.template_id,
  };
  getChannel();
  window.dispatchEvent(new CustomEvent(DATA_CHANGE_EVENT, { detail }));
  return () => {
    const settled = { ...detail, phase: 'settled' };
    window.dispatchEvent(new CustomEvent(DATA_CHANGE_EVENT, { detail: settled }));
    try { getChannel()?.postMessage(settled); }
    catch { /* A blocked/closed channel must never fail the primary action. */ }
  };
}

// One request per mounted resource. Background reads cannot overwrite a newer
// mutation, and a change during a read queues one fresh read after it settles.
export function startLiveRefresh({
  load, apply, onSettled = () => {}, matches = () => true, interval = 10000,
  initial = true, target = window, doc = document, now = Date.now,
  setTimer = setTimeout, clearTimer = clearTimeout,
}) {
  getChannel();
  let stopped = false;
  let timer;
  let pending;
  let controller;
  let revision = 0;
  let dirty = false;
  let lastStarted = -Infinity;
  const writes = new Set();
  const visible = () => doc.visibilityState === 'visible' && target.navigator?.onLine !== false;
  const schedule = () => {
    clearTimer(timer);
    if (!stopped && visible()) timer = setTimer(() => refresh(true), interval);
  };
  function refresh(force = false) {
    if (stopped || !visible()) return Promise.resolve();
    if (writes.size || pending) return pending || Promise.resolve();
    if (!force && now() - lastStarted < 1000) return Promise.resolve();
    clearTimer(timer);
    dirty = false;
    lastStarted = now();
    const readingRevision = revision;
    controller = new AbortController();
    pending = Promise.resolve().then(() => load(controller.signal)).then(result => {
      if (!stopped && readingRevision === revision && result?.success !== false && !result?.error) apply(result);
    }).catch(() => {
      // Keep the last good snapshot during an outage; the next tick retries.
    }).finally(() => {
      pending = null;
      if (stopped) return;
      onSettled();
      if (dirty && !writes.size && visible()) refresh(true);
      else schedule();
    });
    return pending;
  }
  const change = ({ detail }) => {
    if (!detail || !matches(detail)) return;
    revision += 1;
    dirty = true;
    if (detail.phase === 'started') writes.add(detail.id);
    else { writes.delete(detail.id); refresh(true); }
  };
  const resume = () => {
    clearTimer(timer);
    if (visible()) { refresh(dirty); schedule(); }
  };
  target.addEventListener(DATA_CHANGE_EVENT, change);
  target.addEventListener('focus', resume);
  target.addEventListener('online', resume);
  doc.addEventListener('visibilitychange', resume);
  if (initial) refresh(true);
  else schedule();
  return {
    refresh,
    stop() {
      stopped = true;
      clearTimer(timer);
      controller?.abort();
      target.removeEventListener(DATA_CHANGE_EVENT, change);
      target.removeEventListener('focus', resume);
      target.removeEventListener('online', resume);
      doc.removeEventListener('visibilitychange', resume);
    },
  };
}
