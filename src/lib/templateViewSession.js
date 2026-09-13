const STORAGE_PREFIX = 'tog:template-view:v1:';

function storageKey(userId, templateId) {
  return `${STORAGE_PREFIX}${encodeURIComponent(userId)}:${encodeURIComponent(templateId)}`;
}

function skippedResult(rawViews) {
  const views = Number(rawViews);
  return {
    success: true,
    counted: false,
    ...(rawViews !== '' && Number.isFinite(views) ? { views } : {}),
  };
}

export function createTemplateViewSessionGuard({ getStorage = () => globalThis.sessionStorage } = {}) {
  const recorded = new Map();
  const inFlight = new Map();

  function readRecorded(key) {
    if (recorded.has(key)) return recorded.get(key);
    try {
      const raw = getStorage()?.getItem(key);
      if (raw == null) return null;
      const result = skippedResult(raw);
      recorded.set(key, result);
      return result;
    } catch {
      return null;
    }
  }

  function markRecorded(key, result) {
    const stored = skippedResult(result?.views == null ? '' : String(result.views));
    recorded.set(key, stored);
    try {
      getStorage()?.setItem(key, result?.views == null ? '' : String(result.views));
    } catch {
      // Storage can be disabled by browser/privacy policy; the in-memory guard still works.
    }
  }

  return async function recordOnce({ userId, templateId, record }) {
    const key = storageKey(userId, templateId);
    const prior = readRecorded(key);
    if (prior) return prior;
    if (inFlight.has(key)) return inFlight.get(key);

    const request = Promise.resolve()
      .then(record)
      .then((result) => {
        // Only a confirmed successful response suppresses retries.
        if (result?.success === true) markRecorded(key, result);
        return result;
      })
      .finally(() => inFlight.delete(key));

    inFlight.set(key, request);
    return request;
  };
}
