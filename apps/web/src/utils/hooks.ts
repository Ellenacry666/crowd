import { useCallback, useEffect, useState } from 'react';
import { getErrorMessage } from '../api/client';

interface AsyncState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

/** Memuat data async dan memuat ulang saat deps berubah atau reload() dipanggil. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<AsyncState<T>>({ data: null, error: null, loading: true });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    fn()
      .then((data) => {
        if (!cancelled) setState({ data, error: null, loading: false });
      })
      .catch((e) => {
        if (!cancelled) setState({ data: null, error: getErrorMessage(e), loading: false });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}

export function useDebounce<T>(value: T, delayMs = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/**
 * Mengambil gambar dari endpoint terautentikasi sebagai Blob dan membuat object URL untuk <img>.
 * URL dilepas otomatis saat komponen dilepas atau saat deps berubah.
 */
export function useBlobUrl(fetcher: (() => Promise<Blob>) | null, deps: unknown[]) {
  const [state, setState] = useState<{ url: string | null; failed: boolean }>({ url: null, failed: false });

  useEffect(() => {
    if (!fetcher) {
      setState({ url: null, failed: false });
      return;
    }
    let cancelled = false;
    let objectUrl: string | null = null;
    fetcher()
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setState({ url: objectUrl, failed: false });
      })
      .catch(() => {
        if (!cancelled) setState({ url: null, failed: true });
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}
