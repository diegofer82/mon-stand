// Coquille: acceso → 4 pestañas (Caisse · Stock · Heures · Clôture), réglages en el menú del avatar,
// estado de red y toasts. Los datos viven en IndexedDB y se leen de forma reactiva.
import { Clock, CloudOff, Package, ReceiptText, Settings, ShoppingBasket } from 'lucide-react';
import { lazy, Suspense, useEffect, useState } from 'react';

import { dateMetier } from '../shared/dates';
import { Avatar, Banniere } from './composants/ui/Affichage';
import { BarreApp, BarreOnglets, StatutSync, Toast } from './composants/ui/Structure';
import { useJourneeOuverte, useOutboxCount, useVendeur } from './db/hooks';
import { semerSiVide } from './db/semence';
import { SessionProvider, useSession } from './etat/session';
import { appliquerTheme, lireTheme } from './etat/theme';
import { Acces } from './ecrans/Acces';
import { Caisse } from './ecrans/Caisse';
import { t } from './textes/fr';
import { dateCourte } from './utils/format';

const Stock = lazy(() => import('./ecrans/Stock').then((m) => ({ default: m.Stock })));
const Heures = lazy(() => import('./ecrans/Heures').then((m) => ({ default: m.Heures })));
const Cloture = lazy(() => import('./ecrans/Cloture').then((m) => ({ default: m.Cloture })));
const Reglages = lazy(() => import('./ecrans/Reglages').then((m) => ({ default: m.Reglages })));

type Onglet = 'caisse' | 'stock' | 'heures' | 'cloture';

const ONGLETS = [
  { id: 'caisse', label: t.onglets.caisse, icon: ShoppingBasket },
  { id: 'stock', label: t.onglets.stock, icon: Package },
  { id: 'heures', label: t.onglets.heures, icon: Clock },
  { id: 'cloture', label: t.onglets.cloture, icon: ReceiptText },
];

function useEnLigne(): boolean {
  const [enLigne, setEnLigne] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setEnLigne(true);
    const off = () => setEnLigne(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return enLigne;
}

export function App() {
  const [pret, setPret] = useState(false);
  useEffect(() => {
    appliquerTheme(lireTheme());
    semerSiVide()
      .catch((e: unknown) => console.error('semence', e))
      .finally(() => setPret(true));
  }, []);
  if (!pret) return <main className="min-h-dvh bg-ground" aria-busy />;
  return (
    <SessionProvider>
      <Coquille />
    </SessionProvider>
  );
}

function Coquille() {
  const { vendeurId, toast, fermerToast } = useSession();
  if (!vendeurId) return <Acces />;
  return (
    <>
      <Principal vendeurId={vendeurId} />
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

function Principal({ vendeurId }: { vendeurId: string }) {
  const [onglet, setOnglet] = useState<Onglet>('caisse');
  const [reglages, setReglages] = useState(false);
  const vendeur = useVendeur(vendeurId);
  const journee = useJourneeOuverte();
  const enAttente = useOutboxCount();
  const enLigne = useEnLigne();

  const titres: Record<Onglet, string> = {
    caisse: t.onglets.caisse,
    stock: t.stock.titre,
    heures: t.heures.titre,
    cloture: t.cloture.titre,
  };
  const sousTitre = journee ? `${dateCourte(journee.dateLocale)} · ${journee.lieu}` : dateCourte(dateMetier());

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-ground lg:max-w-4xl">
      <BarreApp title={titres[onglet]} subtitle={sousTitre}>
        <StatutSync state={enLigne ? 'online' : 'offline'} pending={enAttente} compact={enLigne && enAttente === 0} />
        <button
          type="button"
          onClick={() => setReglages(true)}
          aria-label={t.reglages.titre}
          className="grid size-tap-min place-items-center rounded-md"
        >
          {vendeur ? <Avatar name={vendeur.prenom} size={36} /> : <Settings aria-hidden className="size-6" />}
        </button>
      </BarreApp>
      {!enLigne && (
        <div className="px-4 pb-2">
          <Banniere tone="warning" icon={CloudOff}>
            {t.sync.bandeauHorsLigne}
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
