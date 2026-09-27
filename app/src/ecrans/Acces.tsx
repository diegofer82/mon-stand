// Acceso: selector de vendedora (avatares) + teclado PIN, sobre `night`. Verificación local del hash (sin red).
import { useEffect, useState } from 'react';

import { verifierPin } from '../../shared/pin';
import { Avatar, Marque } from '../composants/ui/Affichage';
import { ClavierNumerique, PointsPin } from '../composants/ui/Saisie';
import { useVendeurs } from '../db/hooks';
import { useSession } from '../etat/session';
import { t } from '../textes/fr';

const MAX_ESSAIS = 5;
const BLOCAGE_MS = 60_000;

export function Acces() {
  const vendeurs = useVendeurs().filter((v) => v.actif);
  const { connecter } = useSession();
  const [vendeurChoisi, setVendeurChoisi] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [essais, setEssais] = useState(0);
  const [bloque, setBloque] = useState(false);
  const [verification, setVerification] = useState(false);

  // Una sola vendedora: se selecciona sola.
  const vendeurId = vendeurChoisi ?? (vendeurs.length === 1 ? (vendeurs[0]?.id ?? null) : null);
  const vendeur = vendeurs.find((v) => v.id === vendeurId) ?? null;

  useEffect(() => {
    if (!bloque) return;
    const id = window.setTimeout(() => {
      setBloque(false);
      setEssais(0);
      setErreur(null);
    }, BLOCAGE_MS);
    return () => window.clearTimeout(id);
  }, [bloque]);

  const touche = (k: string) => {
    if (!vendeur || bloque || verification) return;
    setErreur(null);
    if (k === 'del') {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (pin.length >= 4) return;
    const suivant = pin + k;
    setPin(suivant);
    if (suivant.length === 4) void verifier(suivant);
  };

  const verifier = async (saisie: string) => {
    if (!vendeur) return;
    setVerification(true);
    const ok = await verifierPin(saisie, vendeur.pinSalt, vendeur.pinHash);
    setVerification(false);
    if (ok) {
      connecter(vendeur.id);
      return;
    }
    const n = essais + 1;
    setEssais(n);
    setPin('');
    if (n >= MAX_ESSAIS) {
      setBloque(true);
      setErreur(t.acces.bloque);
    } else {
      setErreur(`${t.acces.pinIncorrect} ${t.acces.essaisRestants(MAX_ESSAIS - n)}`);
    }
  };

  return (
    <main className="flex min-h-dvh flex-col bg-night px-4 pt-[max(env(safe-area-inset-top),24px)] pb-[max(env(safe-area-inset-bottom),16px)] text-on-night">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-8">
        <Marque tone="night" className="self-center pt-6" />
        <section className="flex flex-col gap-3">
          <h1 className="text-center font-display text-title font-semibold">
            {vendeur ? t.acces.saisirPin(vendeur.prenom) : t.acces.titre}
          </h1>
          {vendeurs.length === 0 && (
            <p className="text-center text-body text-on-night-muted">{t.acces.aucuneVendeuse}</p>
          )}
          {vendeurs.length > 1 && (
            <div className="flex flex-wrap justify-center gap-2">
              {vendeurs.map((v) => (
                <Avatar
                  key={v.id}
                  name={v.prenom}
                  size={56}
                  tone="night"
                  showName
                  selected={v.id === vendeurId}
                  onClick={() => {
                    setVendeurChoisi(v.id);
                    setPin('');
                    setErreur(null);
                  }}
                />
              ))}
            </div>
          )}
        </section>
        {vendeur && (
          <section className="flex flex-col gap-6" aria-busy={verification}>
            <PointsPin filled={pin.length} error={!!erreur && !bloque} />
            <p className={`min-h-6 text-center text-body ${erreur ? 'text-gold' : 'text-on-night-muted'}`} role="alert">
              {erreur ?? ' '}
            </p>
            <ClavierNumerique mode="pin" tone="night" onKey={touche} />
          </section>
        )}
      </div>
    </main>
  );
}
