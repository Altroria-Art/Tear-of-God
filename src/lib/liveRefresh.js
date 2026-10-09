import { createPollActivity, watchPollActivity } from './pollActivity.js';

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
  let failures = 0;
  const activity = createPollActivity(now);
  const writes = new Set();
  const visible = () => doc.visibilityState === 'visible' && target.navigator?.onLine !== false;
  const schedule = () => {
    clearTimer(timer);
    if (!stopped && visible() && activity.active()) {
      const delay = Math.min(interval * (2 ** failures), Math.max(interval, 60000));
      timer = setTimer(() => {
        if (activity.active()) refresh(true);
      }, delay);
    }
  };
  function refresh(force = false, fresh = false) {
    if (stopped || !visible()) return Promise.resolve();
    if (writes.size || pending) return pending || Promise.resolve();
    if (!force && now() - lastStarted < interval) return Promise.resolve();
    clearTimer(timer);
    const bypassSnapshot = fresh || dirty;
    dirty = false;
    lastStarted = now();
    const readingRevision = revision;
    controller = new AbortController();
    pending = Promise.resolve().then(() => load(controller.signal, { fresh: bypassSnapshot })).then(result => {
      if (result?.success === false || result?.error) failures = Math.min(failures + 1, 6);
      else {
        failures = 0;
        if (!stopped && readingRevision === revision) apply(result);
      }
    }).catch(() => {
      failures = Math.min(failures + 1, 6);
      // Keep the last good snapshot; back off while the service is unavailable.
    }).finally(() => {
      pending = null;
      if (stopped) return;
      onSettled();
      if (dirty && !writes.size && visible() && activity.active()) refresh(true);
      else schedule();
    });
    return pending;
  }
  const change = ({ detail }) => {
    if (!detail || !matches(detail)) return;
    revision += 1;
    dirty = true;
    if (detail.phase === 'started') writes.add(detail.id);
    else {
      writes.delete(detail.id);
      failures = 0;
      if (activity.active()) refresh(true);
    }
  };
  const resume = () => {
    clearTimer(timer);
    if (visible()) {
      activity.touch();
      failures = 0;
      refresh(dirty);
      schedule();
    }
  };
  const unwatchActivity = watchPollActivity(target, activity, resume);
  target.addEventListener(DATA_CHANGE_EVENT, change);
  target.addEventListener('focus', resume);
  target.addEventListener('online', resume);
  doc.addEventListener('visibilitychange', resume);
  if (initial) refresh(true, true);
  else schedule();
  return {
    refresh(force = false) {
      activity.touch();
      failures = 0;
      return refresh(force, true);
    },
    stop() {
      stopped = true;
      clearTimer(timer);
      controller?.abort();
      unwatchActivity();
      target.removeEventListener(DATA_CHANGE_EVENT, change);
      target.removeEventListener('focus', resume);
      target.removeEventListener('online', resume);
      doc.removeEventListener('visibilitychange', resume);
    },
  };
}
