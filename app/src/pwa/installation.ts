// Instalación de la PWA: guarda el evento de Chrome (se dispara una sola vez), detecta iPhone/iPad y navegadores
// integrados donde no se puede instalar, y recuerda «Pas maintenant» durante 14 días.
import { useCallback, useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let evenementDiffere: BeforeInstallPromptEvent | null = null;
const ecouteurs = new Set<() => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    evenementDiffere = e as BeforeInstallPromptEvent;
    ecouteurs.forEach((f) => f());
  });
  window.addEventListener('appinstalled', () => {
    evenementDiffere = null;
    ecouteurs.forEach((f) => f());
  });
}

export type Situation = 'installee' | 'native' | 'ios' | 'integre' | 'manuel';

const CLE_REPORT = 'mon-stand.installation.reportee';
const DUREE_REPORT_MS = 14 * 86400000;

export function estInstallee(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true)
  );
}

function estIos(): boolean {
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function estNavigateurIntegre(): boolean {
  const ua = navigator.userAgent;
  return (
    /FBAN|FBAV|Instagram|TikTok|Line\/|Twitter|Snapchat/i.test(ua) ||
    (estIos() && !/Safari/i.test(ua)) ||
    (estIos() && /CriOS|FxiOS/i.test(ua))
  );
}

export function useInstallation() {
  const [, forcer] = useState(0);
  useEffect(() => {
    const f = () => forcer((n) => n + 1);
    ecouteurs.add(f);
    return () => {
      ecouteurs.delete(f);
    };
  }, []);

  const situation: Situation = estInstallee()
    ? 'installee'
    : evenementDiffere
      ? 'native'
      : estNavigateurIntegre()
        ? 'integre'
        : estIos()
          ? 'ios'
          : 'manuel';

  const installer = useCallback(async () => {
    if (!evenementDiffere) return false;
    await evenementDiffere.prompt();
    const { outcome } = await evenementDiffere.userChoice;
    if (outcome === 'accepted') evenementDiffere = null;
    return outcome === 'accepted';
  }, []);

  const reportee = (() => {
    try {
      const v = localStorage.getItem(CLE_REPORT);
      return v !== null && Date.now() - Number(v) < DUREE_REPORT_MS;
    } catch {
      return false;
    }
  })();

  const reporter = useCallback(() => {
    try {
      localStorage.setItem(CLE_REPORT, String(Date.now()));
    } catch {
      /* sin almacenamiento */
    }
    forcer((n) => n + 1);
  }, []);

  return { situation, installer, reportee, reporter };
}
