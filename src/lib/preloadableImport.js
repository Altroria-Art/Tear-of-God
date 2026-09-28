// Warm the same promise React.lazy will consume. Failed preloads are retryable
// and must not produce unhandled rejections while session restoration runs.
export function preloadableImport(importModule) {
  let pending;
  const load = () => {
    if (!pending) {
      pending = importModule().catch(error => {
        pending = undefined;
        throw error;
      });
    }
    return pending;
  };
  return { load, preload: () => { void load().catch(() => {}); } };
}
