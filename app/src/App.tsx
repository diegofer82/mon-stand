// Coquille: /admin (propietario) o la app de la vendedora: emparejamiento → acceso → 4 pestañas
// (Caisse · Stock · Heures · Clôture), réglages en el menú del avatar, estado de sincronización y toasts.
import { Clock, CloudOff, Package, ReceiptText, Settings, ShoppingBasket, TriangleAlert } from 'lucide-react';
import { lazy, Suspense, useEffect, useState } from 'react';

import { dateMetier } from '../shared/dates';
import { Avatar, Banniere } from './composants/ui/Affichage';
import { BarreApp, BarreOnglets, StatutSync, Toast } from './composants/ui/Structure';
import { useJourneeOuverte, useMeta, useOutboxCount, useVendeur } from './db/hooks';
import { Acces } from './ecrans/Acces';
import { Appairage } from './ecrans/Appairage';
import { Caisse } from './ecrans/Caisse';
import { SessionProvider, useSession } from './etat/session';
import { appliquerTheme, lireTheme } from './etat/theme';
import { demarrerSync } from './sync/client';
import { useSync } from './sync/useSync';
import { t } from './textes/fr';
import { dateCourte } from './utils/format';

const Stock = lazy(() => import('./ecrans/Stock').then((m) => ({ default: m.Stock })));
const Heures = lazy(() => import('./ecrans/Heures').then((m) => ({ default: m.Heures })));
const Cloture = lazy(() => import('./ecrans/Cloture').then((m) => ({ default: m.Cloture })));
const Reglages = lazy(() => import('./ecrans/Reglages').then((m) => ({ default: m.Reglages })));
const Admin = lazy(() => import('./ecrans/Admin').then((m) => ({ default: m.Admin })));

type Onglet = 'caisse' | 'stock' | 'heures' | 'cloture';

const ONGLETS = [
  { id: 'caisse', label: t.onglets.caisse, icon: ShoppingBasket },
  { id: 'stock', label: t.onglets.stock, icon: Package },
  { id: 'heures', label: t.onglets.heures, icon: Clock },
  { id: 'cloture', label: t.onglets.cloture, icon: ReceiptText },
];

export function App() {
  useEffect(() => {
    appliquerTheme(lireTheme());
  }, []);
  if (window.location.pathname.startsWith('/admin')) {
    return (
      <Suspense fallback={<main className="min-h-dvh bg-ground" aria-busy />}>
        <Admin />
      </Suspense>
    );
  }
  return (
    <SessionProvider>
      <Coquille />
    </SessionProvider>
  );
}

function Coquille() {
  const { vendeurId, toast, fermerToast } = useSession();
  const token = useMeta('deviceToken');
  const revoque = useMeta('revoque');

  useEffect(() => {
    if (token) demarrerSync();
  }, [token]);

  if (token === undefined) return <main className="min-h-dvh bg-ground" aria-busy />;
  if (!token) return <Appairage />;
  if (!vendeurId) return <Acces />;
  return (
    <>
      <Principal vendeurId={vendeurId} revoque={revoque === '1'} />
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--spacing-tap-lg)+env(safe-area-inset-bottom)+72px)] z-50 flex justify-center px-4">
          <Toast
            message={toast.message}
            detail={toast.detail}
            tone={toast.tone}
            actionLabel={toast.actionLabel}
            onAction={
              toast.onAction
                ? () => {
                    toast.onAction?.();
                    fermerToast();
                  }
                : undefined
            }
            onClose={fermerToast}
          />
        </div>
      )}
    </>
  );
}

function Principal({ vendeurId, revoque }: { vendeurId: string; revoque: boolean }) {
  const [onglet, setOnglet] = useState<Onglet>('caisse');
  const [reglages, setReglages] = useState(false);
  const vendeur = useVendeur(vendeurId);
  const journee = useJourneeOuverte();
  const enAttente = useOutboxCount();
  const sync = useSync();

  const titres: Record<Onglet, string> = {
    caisse: t.onglets.caisse,
    stock: t.stock.titre,
    heures: t.heures.titre,
    cloture: t.cloture.titre,
  };
  const sousTitre = journee ? `${dateCourte(journee.dateLocale)} · ${journee.lieu}` : dateCourte(dateMetier());
  const etatSync = revoque || sync.etat === 'revoque' ? 'error' : sync.etat;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-ground lg:max-w-4xl">
      <BarreApp title={titres[onglet]} subtitle={sousTitre}>
        <StatutSync state={etatSync} pending={enAttente} compact={etatSync === 'online' && enAttente === 0} />
        <button
          type="button"
          onClick={() => setReglages(true)}
          aria-label={t.reglages.titre}
          className="grid size-tap-min place-items-center rounded-md"
        >
          {vendeur ? <Avatar name={vendeur.prenom} size={36} /> : <Settings aria-hidden className="size-6" />}
        </button>
      </BarreApp>
      {sync.etat === 'offline' && (
        <div className="px-4 pb-2">
          <Banniere tone="warning" icon={CloudOff}>
            {t.sync.bandeauHorsLigne}
          </Banniere>
        </div>
      )}
      {(revoque || sync.etat === 'revoque') && (
        <div className="px-4 pb-2">
          <Banniere tone="danger" icon={TriangleAlert} title={t.sync.revoque}>
            {t.appairage.revoque}
          </Banniere>
        </div>
      )}
      {sync.etat === 'error' && sync.erreur && (
        <div className="px-4 pb-2">
          <Banniere tone="danger" icon={TriangleAlert}>
            {t.sync.bandeauErreur(sync.erreur)}
          </Banniere>
        </div>
      )}
      <main className="flex flex-1 flex-col">
        <Suspense fallback={<p className="p-6 text-center text-body text-ink-muted">{t.commun.chargement}</p>}>
          {onglet === 'caisse' && <Caisse vendeurId={vendeurId} journee={journee ?? null} />}
          {onglet === 'stock' && <Stock vendeurId={vendeurId} />}
          {onglet === 'heures' && <Heures vendeurId={vendeurId} />}
          {onglet === 'cloture' && <Cloture vendeurId={vendeurId} journee={journee ?? null} />}
        </Suspense>
      </main>
      <BarreOnglets items={ONGLETS} active={onglet} onSelect={(id) => setOnglet(id as Onglet)} />
      <Suspense fallback={null}>
        {reglages && <Reglages open={reglages} onClose={() => setReglages(false)} vendeurId={vendeurId} />}
      </Suspense>
    </div>
  );
}
