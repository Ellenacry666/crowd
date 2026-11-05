import { useEffect, useState } from 'react';
import { api, errMsg, isAbort } from './api';

export const REFRESH_MS = 5000;

/**
 * Mengambil satu endpoint (dan memperbaruinya berkala) dengan state sendiri.
 * Dipakai terpisah untuk tiap kartu supaya kegagalan satu sumber data tidak menyembunyikan yang lain.
 */
export function usePolling<T>(path: string | null, live: boolean) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setData(null);
    setError('');
    if (!path) return;
    let ctrl = new AbortController();
    const load = () => {
      ctrl.abort();
      ctrl = new AbortController();
      api<T>(path, { signal: ctrl.signal })
        .then((d) => { setData(d); setError(''); })
        .catch((e) => { if (!isAbort(e)) setError(errMsg(e)); });
    };
    load();
    const timer = live ? setInterval(load, REFRESH_MS) : null;
    return () => {
      ctrl.abort();
      if (timer) clearInterval(timer);
    };
  }, [path, live]);

  return { data, error };
}
