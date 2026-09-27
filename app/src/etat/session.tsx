// Sesión de la vendedora en este teléfono (sobrevive a una recarga, no al cierre del navegador) y toasts.
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const CLE_SESSION = 'mon-stand.vendeurId';

export interface Toast {
  id: number;
  message: string;
  detail?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** ms; 0 = hasta que se cierre. */
  duree: number;
  tone?: 'neutral' | 'success' | 'danger';
}

interface Session {
  vendeurId: string | null;
  connecter: (vendeurId: string) => void;
  deconnecter: () => void;
  toast: Toast | null;
  notifier: (t: Omit<Toast, 'id' | 'duree'> & { duree?: number }) => void;
  fermerToast: () => void;
}

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [vendeurId, setVendeurId] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(CLE_SESSION);
    } catch {
      return null;
    }
  });
  const [toast, setToast] = useState<Toast | null>(null);

  const connecter = useCallback((id: string) => {
    setVendeurId(id);
    try {
      sessionStorage.setItem(CLE_SESSION, id);
    } catch {
      /* navegación privada: la sesión dura lo que la página */
    }
  }, []);

  const deconnecter = useCallback(() => {
    setVendeurId(null);
    try {
      sessionStorage.removeItem(CLE_SESSION);
    } catch {
      /* idem */
    }
  }, []);

  const notifier = useCallback<Session['notifier']>((tst) => {
    setToast({ id: Date.now(), duree: 3000, ...tst });
  }, []);
  const fermerToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    if (!toast || toast.duree === 0) return;
    const id = window.setTimeout(() => setToast((actuel) => (actuel?.id === toast.id ? null : actuel)), toast.duree);
    return () => window.clearTimeout(id);
  }, [toast]);

  const valeur = useMemo<Session>(
    () => ({ vendeurId, connecter, deconnecter, toast, notifier, fermerToast }),
    [vendeurId, connecter, deconnecter, toast, notifier, fermerToast],
  );
  return <SessionContext.Provider value={valeur}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const s = useContext(SessionContext);
  if (!s) throw new Error('useSession hors de SessionProvider');
  return s;
}
