import { useEffect, useMemo, useState } from 'react';

// Use the server's remaining duration so a client's clock/time zone cannot
// prolong the lock. No polling is needed to unlock an editor left open.
export default function useCooldown(cooldown) {
  const deadline = useMemo(() => cooldown?.active
    ? Date.now() + Math.max(0, Number(cooldown.remainingSeconds) || 0) * 1000 : 0, [cooldown]);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    setNow(Date.now());
    if (!deadline) return;
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= deadline) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [deadline]);
  const remainingSeconds = Math.max(0, Math.ceil((deadline - now) / 1000));
  return cooldown ? { ...cooldown, active: remainingSeconds > 0, remainingSeconds } : null;
}
