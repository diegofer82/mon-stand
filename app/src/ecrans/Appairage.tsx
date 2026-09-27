// Emparejamiento del teléfono: código de 8 caracteres generado por el propietario en /admin.
import { Link2, Smartphone } from 'lucide-react';
import { useState } from 'react';

import { CODE_APPAIRAGE_LONGUEUR } from '../../shared/api';
import { Marque } from '../composants/ui/Affichage';
import { Bouton } from '../composants/ui/Bouton';
import { Champ } from '../composants/ui/Saisie';
import { appairer, ErreurApiClient, ErreurReseau } from '../sync/client';
import { t } from '../textes/fr';

export function Appairage() {
  const [code, setCode] = useState('');
  const [nom, setNom] = useState<string>(t.appairage.nomDefaut);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const valider = async () => {
    const propre = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (propre.length !== CODE_APPAIRAGE_LONGUEUR) {
      setErreur(t.appairage.codeFormat);
      return;
    }
    if (!nom.trim()) {
      setErreur(t.commun.champRequis);
      return;
    }
    setEnCours(true);
    setErreur(null);
    try {
      await appairer(propre, nom.trim());
    } catch (e) {
      if (e instanceof ErreurReseau) setErreur(t.appairage.horsLigne);
      else if (e instanceof ErreurApiClient && e.code === 'code_invalide') setErreur(t.appairage.codeInvalide);
      else setErreur(e instanceof Error ? e.message : t.erreurs.generique);
    } finally {
      setEnCours(false);
    }
  };

  return (
    <main className="flex min-h-dvh flex-col bg-night px-4 pt-[max(env(safe-area-inset-top),24px)] pb-[max(env(safe-area-inset-bottom),16px)] text-on-night">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-8">
        <Marque tone="night" className="self-center pt-6" />
        <section className="flex flex-col gap-4 rounded-lg bg-surface p-4 text-ink">
          <div className="flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-md bg-violet-soft text-violet">
              <Smartphone aria-hidden className="size-6" strokeWidth={2} />
            </span>
            <div>
              <h1 className="font-display text-heading font-semibold">{t.appairage.titre}</h1>
              <p className="text-caption text-ink-muted">{t.appairage.aide}</p>
            </div>
          </div>
          <Champ
            label={t.appairage.code}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            autoCapitalize="characters"
            autoComplete="one-time-code"
            inputMode="text"
            maxLength={CODE_APPAIRAGE_LONGUEUR + 1}
            className="font-mono tracking-[0.3em]"
            placeholder="ABCD2345"
          />
          <Champ label={t.appairage.nom} value={nom} onChange={(e) => setNom(e.target.value)} maxLength={60} />
          {erreur && (
            <p role="alert" className="text-caption text-danger">
              {erreur}
            </p>
          )}
          <Bouton variant="primary" size="xl" block icon={Link2} onClick={() => void valider()} disabled={enCours}>
            {enCours ? t.commun.chargement : t.appairage.valider}
          </Bouton>
        </section>
      </div>
    </main>
  );
}
