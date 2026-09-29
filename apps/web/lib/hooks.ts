'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { get } from './api';

/** SWR-ish polling fetch hook. */
export function usePoll<T>(path: string | null, intervalMs = 0): {
  data: T | null;
  error: string | null;
  reload: () => void;
} {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const mounted = useRef(true);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!path) {
      setData(null);
      return;
    }
    let stop = false;
    const load = async () => {
      try {
        const d = await get<T>(path);
        if (!stop && mounted.current) {
          setData(d);
          setError(null);
        }
      } catch (e) {
        if (!stop && mounted.current) setError(e instanceof Error ? e.message : 'error');
      }
    };
    void load();
    if (intervalMs > 0) {
      const iv = setInterval(load, intervalMs);
      return () => {
        stop = true;
        clearInterval(iv);
      };
    }
    return () => {
      stop = true;
    };
  }, [path, tick, intervalMs]);

  return { data, error, reload };
}
