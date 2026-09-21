export const POLL_IDLE_MS = 5 * 60 * 1000;

// Polling needs recent interaction, not just an open foreground tab.
export function createPollActivity(now = Date.now) {
  let lastActivity = now();
  return {
    active: () => now() - lastActivity < POLL_IDLE_MS,
    touch() {
      const resumed = now() - lastActivity >= POLL_IDLE_MS;
      lastActivity = now();
      return resumed;
    },
  };
}

export function watchPollActivity(target, activity, onResume) {
  const handle = () => { if (activity.touch()) onResume(); };
  const events = ['pointerdown', 'keydown', 'scroll'];
  for (const event of events) target.addEventListener(event, handle, { passive: true, capture: true });
  return () => {
    for (const event of events) target.removeEventListener(event, handle, { capture: true });
  };
}
