import { useCallback, useEffect, useRef } from 'react';
import { startLiveRefresh } from './liveRefresh';

export default function useLiveRefresh({ resourceKey, enabled = true, ...options }) {
  const latest = useRef(options);
  latest.current = options;
  const live = useRef(null);
  const interval = options.interval;
  useEffect(() => {
    if (!enabled) return;
    const controller = startLiveRefresh({
      interval,
      load: (signal, policy) => latest.current.load(signal, policy),
      apply: result => latest.current.apply(result),
      matches: detail => latest.current.matches?.(detail) ?? true,
      onSettled: () => latest.current.onSettled?.(),
    });
    live.current = controller;
    return () => {
      controller.stop();
      if (live.current === controller) live.current = null;
    };
  }, [resourceKey, enabled, interval]);
  return useCallback(() => live.current?.refresh(true), []);
}
