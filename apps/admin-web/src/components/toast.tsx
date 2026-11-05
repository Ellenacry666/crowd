import { Icon } from './Icon';
import { createContext, ReactNode, useCallback, useContext, useRef, useState } from 'react';

type Kind = 'ok' | 'bad';
interface Item { id: number; kind: Kind; text: string }
interface Api { success: (t: string) => void; error: (t: string) => void }

const Ctx = createContext<Api | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const seq = useRef(0);

  const push = useCallback((kind: Kind, text: string) => {
    const id = ++seq.current;
    setItems((p) => [...p, { id, kind, text }]);
    setTimeout(() => setItems((p) => p.filter((i) => i.id !== id)), kind === 'bad' ? 7000 : 4000);
  }, []);

  const api: Api = { success: (t) => push('ok', t), error: (t) => push('bad', t) };
  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map((i) => (
          <div key={i.id} className={`toast ${i.kind}`} role={i.kind === 'bad' ? 'alert' : 'status'}>
            <Icon name={i.kind === 'ok' ? 'check' : 'alert'} size={16} />{i.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useToast harus di dalam ToastProvider');
  return v;
}
