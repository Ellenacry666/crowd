import { useCallback, useEffect, useState } from 'react';
import { api, errMsg, isAbort } from './api';

/** GET sekali (dan setiap path berubah) dengan state error sendiri dan reload() manual. */
export function useFetch<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!path) { setData(null); return; }
    const ctrl = new AbortController();
    setError('');
    api<T>(path, { signal: ctrl.signal })
      .then(setData)
      .catch((e) => { if (!isAbort(e)) setError(errMsg(e)); });
    return () => ctrl.abort();
  }, [path, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, reload };
}
