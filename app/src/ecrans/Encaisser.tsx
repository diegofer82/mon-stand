// Cobro: divisas con el importe ya calculado, billete sugerido, «Compte juste», «Autre montant» (teclado),
// monnaie en grande, pago mixto («Payer le reste autrement») y validación.
import { CircleAlert, X } from 'lucide-react';
import { useMemo, useState } from 'react';

import {
  billetsSuggeres,
  calculerPaiement,
  estEspeceEtrangere,
  resteEnDevise,
  type ResultatPaiement,
} from '../../shared/domaine/encaissement';
import { totalPanierDevise, totauxPanier } from '../../shared/domaine/panier';
import type { Article, LignePanier } from '../../shared/domaine/types';
import {
  decimalesDevise,
  formatNumber,
  lireMontant,
  MODES_PAIEMENT,
  versCfp,
  type Devise,
  type ModePaiement,
} from '../../shared/montants';
import { Montant } from '../composants/ui/Affichage';
import { Bouton } from '../composants/ui/Bouton';
import { BoutonBillet, BoutonDevise, MonnaieARendre } from '../composants/ui/CaisseUI';
import { ClavierNumerique } from '../composants/ui/Saisie';
import { Feuille } from '../composants/ui/Structure';
import { useTaux } from '../db/hooks';
import { t } from '../textes/fr';

export interface EncaisserProps {
  open: boolean;
  lignes: LignePanier[];
  articles: Map<string, Article>;
  remisePanierCfp: number;
  onClose: () => void;
  onValider: (paiements: ResultatPaiement[]) => Promise<void>;
}

export function Encaisser({ open, lignes, articles, remisePanierCfp, onClose, onValider }: EncaisserProps) {
  const taux = useTaux();
  const [paiements, setPaiements] = useState<ResultatPaiement[]>([]);
  const [devise, setDevise] = useState<ModePaiement>('CFP');
  const [saisie, setSaisie] = useState<string>(''); // '' = compte juste
  const [clavier, setClavier] = useState(false);
  const [enCours, setEnCours] = useState(false);

  const totaux = useMemo(() => totauxPanier(lignes, articles, remisePanierCfp), [lignes, articles, remisePanierCfp]);
  const reste = Math.max(0, totaux.totalCfp - paiements.reduce((s, p) => s + p.montantCfp, 0));
  const premier = paiements.length === 0;

  /** Precio pedido en cada divisa: el del panier si es el primer pago, el reste al tipo del día si es mixto. */
  const montantPour = (d: ModePaiement): number | null => {
    if (d === 'CFP' || d === 'TPE') return reste;
    const tx = taux[d];
    if (!tx) return null;
    return premier ? totalPanierDevise(lignes, articles, d, taux, remisePanierCfp) : resteEnDevise(reste, d, tx);
  };

  const totalDevise = montantPour(devise);
  const recu = saisie === '' ? null : lireMontant(saisie, devise);
  const resultat = calculerPaiement({
    resteCfp: reste,
    devise,
    totalDevise: totalDevise ?? 0,
    taux: estEspeceEtrangere(devise) ? taux[devise] : undefined,
    montantRecu: recu,
  });
  const manque = estEspeceEtrangere(devise)
    ? Math.max(0, (totalDevise ?? 0) - resultat.montantDevise)
    : Math.max(0, reste - resultat.montantCfp);
  const manqueCfp = estEspeceEtrangere(devise) ? Math.max(0, reste - resultat.montantCfp) : manque;
  const deviseEspece: Devise = estEspeceEtrangere(devise) ? devise : 'CFP';
  const billets = totalDevise && totalDevise > 0 ? billetsSuggeres(totalDevise, deviseEspece) : [];

  const choisirDevise = (d: ModePaiement) => {
    setDevise(d);
    setSaisie('');
    setClavier(false);
  };

  const touche = (k: string) => {
    setSaisie((s) => {
      if (k === 'del') return s.slice(0, -1);
      if (k === ',') return decimalesDevise(devise) === 0 || s.includes(',') ? s : (s || '0') + ',';
      if (k === '000') return s === '' ? '' : s + '000';
      const suivant = s + k;
      const [, dec] = suivant.split(',');
      if (dec && dec.length > decimalesDevise(devise)) return s;
      return suivant.replace(/^0+(?=\d)/, '');
    });
  };

  const ajouterPaiementPartiel = () => {
    if (resultat.montantCfp <= 0) return;
    setPaiements((p) => [...p, resultat]);
    setDevise('CFP');
    setSaisie('');
    setClavier(false);
  };

  const retirerPaiement = (i: number) => setPaiements((p) => p.filter((_, j) => j !== i));

  const valider = async () => {
    if (enCours) return;
    setEnCours(true);
    try {
      const liste = reste > 0 && resultat.montantCfp > 0 ? [...paiements, resultat] : paiements;
      if (liste.length === 0) return;
      await onValider(liste);
      setPaiements([]);
      setDevise('CFP');
      setSaisie('');
      setClavier(false);
    } finally {
      setEnCours(false);
    }
  };

  const fermer = () => {
    setPaiements([]);
    setDevise('CFP');
    setSaisie('');
    setClavier(false);
    onClose();
  };

  // En divisa, pagar el precio pedido cierra la venta aunque su contravalor en CFP quede por debajo del total:
  // esa diferencia es el redondeo de los precios (regla v1.5) y se guarda como remise à l'encaissement, sin avisar.
  const remiseFinale = manque > 0 ? Math.max(0, reste - resultat.montantCfp) : 0;
  const peutValider = reste === 0 || resultat.montantCfp > 0;

  return (
    <Feuille
      open={open}
      onClose={fermer}
      title={t.cobro.titre}
      full
      footer={
        <div className="flex flex-col gap-2">
          {reste > 0 && manque > 0 && resultat.montantCfp > 0 && (
            <Bouton variant="secondary" size="lg" block onClick={ajouterPaiementPartiel}>
              {t.cobro.payerResteAutrement}
            </Bouton>
          )}
          <Bouton variant="primary" size="xl" block onClick={() => void valider()} disabled={!peutValider || enCours}>
            {t.cobro.validerVente}
            {reste > 0 && remiseFinale > 0 && resultat.montantCfp > 0
              ? ` · ${t.cobro.remiseEncaissement} ${formatNumber(remiseFinale)} CFP`
              : ''}
          </Bouton>
        </div>
      }
    >
      <div className="flex flex-col gap-5 pt-1">
        <section className="flex items-end justify-between gap-3 rounded-lg bg-night px-4 py-3 text-on-night">
          <div className="flex flex-col">
            <span className="text-overline font-semibold tracking-wide text-on-night-muted uppercase">
              {premier ? t.cobro.aPayer : t.cobro.resteAPayer}
            </span>
            <Montant value={reste} size="xl" tone="night" />
          </div>
          {estEspeceEtrangere(devise) && totalDevise !== null && totalDevise > 0 && (
            <div className="flex flex-col items-end">
              <span className="text-overline font-semibold text-on-night-muted uppercase">{devise}</span>
              <span className="text-amount-lg font-bold text-gold tabular-nums">
                {formatNumber(totalDevise, devise)}
              </span>
              <span className="text-overline text-on-night-muted tabular-nums">
                {t.cobro.taux(devise, formatNumber(taux[devise] ?? 0, 'AUD'))}
              </span>
            </div>
          )}
        </section>

        {paiements.length > 0 && (
          <section className="flex flex-col gap-1">
            <h3 className="text-overline font-semibold tracking-wide text-ink-muted uppercase">
              {t.cobro.paiementsSaisis}
            </h3>
            {paiements.map((p, i) => (
              <div key={i} className="flex items-center gap-2 rounded-md bg-surface-sunk px-3 py-2">
                <span className="flex-1 text-body font-semibold">
                  {p.devise === 'TPE' ? t.cobro.carte : p.devise} · {formatNumber(p.montantDevise, p.devise)}{' '}
                  {p.devise === 'TPE' ? 'CFP' : p.devise}
                </span>
                <Montant value={p.montantCfp} size="md" />
                <button
                  type="button"
                  onClick={() => retirerPaiement(i)}
                  aria-label={t.cobro.retirerPaiement}
                  className="grid size-10 place-items-center rounded-md text-ink-muted"
                >
                  <X aria-hidden className="size-5" strokeWidth={2} />
                </button>
              </div>
            ))}
          </section>
        )}

        {reste > 0 && (
          <>
            <section className="flex flex-col gap-2">
              <h3 className="text-overline font-semibold tracking-wide text-ink-muted uppercase">
                {t.cobro.modePaiement}
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {MODES_PAIEMENT.map((d) => (
                  <BoutonDevise
                    key={d}
                    code={d}
                    montant={montantPour(d)}
                    selected={d === devise}
                    onClick={() => choisirDevise(d)}
                    sansTaux={estEspeceEtrangere(d) && !taux[d]}
                  />
                ))}
              </div>
            </section>

            {devise !== 'TPE' && (
              <section className="flex flex-col gap-2">
                <h3 className="text-overline font-semibold tracking-wide text-ink-muted uppercase">{t.cobro.recu}</h3>
                <div className="flex gap-2">
                  <BoutonBillet
                    devise={deviseEspece}
                    label={t.cobro.compteJuste}
                    selected={saisie === '' && !clavier}
                    onClick={() => choisirDevise(devise)}
                  />
                  {billets.map((b) => (
                    <BoutonBillet
                      key={b}
                      devise={deviseEspece}
                      montant={b}
                      selected={!clavier && recu === b}
                      onClick={() => {
                        setSaisie(String(b));
                        setClavier(false);
                      }}
                    />
                  ))}
                </div>
                <Bouton
                  variant={clavier ? 'brand' : 'secondary'}
                  size="md"
                  block
                  onClick={() => {
                    setClavier((c) => !c);
                    if (!clavier) setSaisie('');
                  }}
                >
                  {t.cobro.autreMontant}
                  {clavier && saisie ? ` · ${saisie} ${deviseEspece}` : ''}
                </Bouton>
                {clavier && (
                  <div className="flex flex-col gap-2">
                    <div
                      aria-live="polite"
                      className="h-tap-min rounded-md border border-line-strong bg-surface px-3 text-right text-amount-lg leading-[48px] font-bold tabular-nums"
                    >
                      {saisie || '0'} <span className="text-caption font-semibold text-ink-muted">{deviseEspece}</span>
                    </div>
                    <ClavierNumerique onKey={touche} extraKey={decimalesDevise(deviseEspece) ? ',' : '000'} />
                  </div>
                )}
              </section>
            )}

            <section>
              {resultat.rendu ? (
                <MonnaieARendre
                  kind="rendre"
                  montant={resultat.rendu.montant}
                  devise={resultat.rendu.devise}
                  equivalentCfp={
                    resultat.rendu.devise !== 'CFP'
                      ? versCfp(resultat.rendu.montant, taux[resultat.rendu.devise] ?? 0)
                      : null
                  }
                />
              ) : manque > 0 ? (
                <MonnaieARendre
                  kind="manque"
                  montant={manque}
                  devise={devise}
                  equivalentCfp={estEspeceEtrangere(devise) ? manqueCfp : null}
                />
              ) : (
                <MonnaieARendre kind="juste" montant={0} devise={devise} />
              )}
              {manque > 0 && resultat.montantCfp > 0 && (
                <p className="mt-2 flex items-start gap-2 text-caption text-ink-muted">
                  <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                  {t.cobro.remiseEncaissement} : {formatNumber(manqueCfp)} CFP si vous validez, ou «{' '}
                  {t.cobro.payerResteAutrement} ».
                </p>
              )}
            </section>
          </>
        )}
      </div>
    </Feuille>
  );
}
