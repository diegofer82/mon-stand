// Cierre: KPIs, reparto por modo de pago, top de artículos, alertas de stock, ventas del día,
// conteo de caja (esperado vs contado → écart) y clôture; historial de jornadas.
import { Banknote, CalendarCheck, Clock, History, Lock, ReceiptText, Trophy, Undo2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { attenduParDevise, resumeJournee, type ResumeJournee } from '../../shared/domaine/cloture';
import { etatStock } from '../../shared/domaine/stock';
import type { Journee, Vente } from '../../shared/domaine/types';
import { formatNumber, lireMontant } from '../../shared/montants';
import { Badge, Banniere, Kpi, Montant } from '../composants/ui/Affichage';
import { Bouton, BoutonMaintenu } from '../composants/ui/Bouton';
import { LigneComptage } from '../composants/ui/CaisseUI';
import { Champ } from '../composants/ui/Saisie';
import { Carte, EtatVide, Feuille, LigneListe } from '../composants/ui/Structure';
import { annulerVente, cloturerJournee, type ComptageSaisi } from '../db/actions';
import {
  useArticles,
  useComptages,
  useJourneesCloturees,
  useQuantites,
  useSessionEnCours,
  useVentesJournee,
} from '../db/hooks';
import { useSession } from '../etat/session';
import { t } from '../textes/fr';
import { dateMoyenne, heure } from '../utils/format';

export function Cloture({ vendeurId, journee }: { vendeurId: string; journee: Journee | null }) {
  const { notifier } = useSession();
  const ventes = useVentesJournee(journee?.id ?? null);
  const articles = useArticles();
  const quantite = useQuantites();
  const historique = useJourneesCloturees();
  const [comptage, setComptage] = useState(false);
  const [detail, setDetail] = useState<Journee | null>(null);
  const [aAnnuler, setAAnnuler] = useState<Vente | null>(null);

  const resume = useMemo(() => resumeJournee(ventes), [ventes]);
  const epuises = articles.filter((a) => a.actif && etatStock(quantite.get(a.id) ?? 0) === 'epuise');
  const faibles = articles.filter((a) => a.actif && etatStock(quantite.get(a.id) ?? 0) === 'faible');

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 pb-6">
      {journee ? (
        <>
          <p className="text-caption text-ink-muted">
            {dateMoyenne(journee.dateLocale)} · {journee.lieu} · {t.journee.ouverteDepuis(heure(journee.ouverteAt))}
          </p>
          <Resume resume={resume} />
          <Carte title={t.cloture.stock}>
            {epuises.length === 0 && faibles.length === 0 ? (
              <p className="text-body text-success">{t.stock.stockOk}</p>
            ) : (
              <div className="flex flex-col gap-2 text-caption text-ink-muted">
                {epuises.length > 0 && (
                  <p>
                    <Badge tone="danger" className="mr-2">
                      {t.stock.epuises(epuises.length)}
                    </Badge>
                    {epuises.map((a) => a.nom).join(', ')}
                  </p>
                )}
                {faibles.length > 0 && (
                  <p>
                    <Badge tone="warning" className="mr-2">
                      {t.stock.faibles(faibles.length)}
                    </Badge>
                    {faibles.map((a) => `${a.nom} (${quantite.get(a.id) ?? 0})`).join(', ')}
                  </p>
                )}
              </div>
            )}
          </Carte>
          {/* Solo la jornada abierta permite anular: el historial (DetailJournee) lista las ventas sin acción. */}
          <ListeVentes ventes={ventes} onAnnuler={setAAnnuler} />
          <AnnulerVente vente={aAnnuler} vendeurId={vendeurId} onClose={() => setAAnnuler(null)} />
          <Bouton variant="primary" size="xl" block icon={Banknote} onClick={() => setComptage(true)}>
            {t.cloture.compterCaisse}
          </Bouton>
          <Comptage
            open={comptage}
            onClose={() => setComptage(false)}
            journee={journee}
            ventes={ventes}
            vendeurId={vendeurId}
            onCloturee={(heuresEnCours) =>
              notifier({
                message: t.cloture.journeeCloturee,
                detail: heuresEnCours ? t.cloture.rappelHeures : undefined,
                tone: 'success',
                duree: heuresEnCours ? 5000 : 2500,
              })
            }
          />
        </>
      ) : (
        <Banniere tone="neutral" icon={CalendarCheck} title={t.journee.aucuneOuverte}>
          {t.journee.aucuneOuverteAide}
        </Banniere>
      )}

      <Carte title={t.cloture.historique} icon={History} flush>
        {historique.length === 0 ? (
          <EtatVide icon={History} title={t.cloture.aucunHistorique} />
        ) : (
          <div className="flex flex-col divide-y divide-line px-3 pb-2">
            {historique.map((j) => (
              <LigneHistorique key={j.id} journee={j} onClick={() => setDetail(j)} />
            ))}
          </div>
        )}
      </Carte>
      <DetailJournee journee={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

function Resume({ resume }: { resume: ResumeJournee }) {
  return (
    <>
      <section className="grid grid-cols-2 gap-2">
        <Kpi
          hero
          label={t.cloture.chiffreAffaires}
          value={resume.totalEncaisseCfp}
          detail={
            resume.remisesEncaissementCfp > 0
              ? `${t.cloture.remisesEncaissement} : ${formatNumber(resume.remisesEncaissementCfp)} CFP`
              : undefined
          }
        />
        <Kpi
          label={t.cloture.ventes}
          value={resume.nbVentes}
          devise={null}
          detail={`${resume.nbArticles} ${t.cloture.articlesVendus.toLowerCase()}`}
        />
        <Kpi
          label={t.cloture.panierMoyen}
          value={resume.panierMoyenCfp}
          detail={
            resume.remisesPanierCfp > 0
              ? `${t.cloture.remisesPanier} : ${formatNumber(resume.remisesPanierCfp)} CFP`
              : undefined
          }
        />
      </section>
      {resume.parPaiement.length > 0 && (
        <Carte title={t.cloture.parPaiement} icon={Banknote}>
          <div className="flex flex-col divide-y divide-line">
            {resume.parPaiement.map((p) => (
              <div key={p.devise} className="flex items-center justify-between py-2">
                <span className="text-body font-semibold">
                  {p.devise === 'TPE' ? t.cobro.carte : p.devise}{' '}
                  <span className="text-caption font-normal text-ink-muted">× {p.nb}</span>
                </span>
                <span className="flex flex-col items-end">
                  <Montant value={p.montantDevise} devise={p.devise} size="md" />
                  {p.devise !== 'CFP' && p.devise !== 'TPE' && (
                    <span className="text-caption text-ink-muted tabular-nums">
                      ≈ {formatNumber(p.montantCfp)} CFP
                      {p.rendu > 0 ? ` · ${t.cloture.monnaie} ${formatNumber(p.rendu, p.devise)} ${p.devise}` : ''}
                    </span>
                  )}
                  {p.devise === 'CFP' && p.rendu > 0 && (
                    <span className="text-caption text-ink-muted tabular-nums">
                      {t.cloture.monnaie} {formatNumber(p.rendu)} CFP
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </Carte>
      )}
      {resume.topArticles.length > 0 && (
        <Carte title={t.cloture.topArticles} icon={Trophy}>
          <ol className="flex flex-col divide-y divide-line">
            {resume.topArticles.map((a, i) => (
              <li key={a.articleId} className="flex items-center gap-3 py-2">
                <span className="grid size-6 place-items-center rounded-full bg-surface-sunk text-caption font-bold text-ink-muted">
                  {i + 1}
                </span>
                <span className="flex-1 text-body font-semibold">{a.nom}</span>
                <span className="text-caption text-ink-muted">× {a.qty}</span>
                <Montant value={a.totalCfp} size="md" />
              </li>
            ))}
          </ol>
        </Carte>
      )}
    </>
  );
}

const paiementsTexte = (v: Vente) =>
  v.paiements
    .map((p) => `${formatNumber(p.montantDevise, p.devise)} ${p.devise === 'TPE' ? 'CFP (carte)' : p.devise}`)
    .join(' + ');

function ListeVentes({ ventes, onAnnuler }: { ventes: Vente[]; onAnnuler?: (vente: Vente) => void }) {
  return (
    <Carte title={t.cloture.ventesDuJour} icon={ReceiptText} flush>
      {ventes.length === 0 ? (
        <EtatVide icon={ReceiptText} title={t.cloture.aucuneVente} />
      ) : (
        <div className="flex flex-col divide-y divide-line px-3 pb-2">
          {ventes.map((v) => (
            <LigneListe
              key={v.id}
              title={
                <span className={v.annuleeAt ? 'text-ink-muted line-through' : ''}>
                  {heure(v.ts)} · {v.lignes.map((l) => `${l.nomSnapshot} ×${l.qty}`).join(', ')}
                </span>
              }
              subtitle={`${paiementsTexte(v)}${v.remisePanierCfp ? ` · ${t.commun.remise} ${formatNumber(v.remisePanierCfp)}` : ''}${v.remiseEncaissementCfp ? ` · ${t.cobro.remiseEncaissement} ${formatNumber(v.remiseEncaissementCfp)}` : ''}`}
              amount={v.annuleeAt ? undefined : v.paiements.reduce((s, p) => s + p.montantCfp, 0)}
              onClick={onAnnuler && !v.annuleeAt ? () => onAnnuler(v) : undefined}
              chevron={!!onAnnuler && !v.annuleeAt}
            >
              {v.annuleeAt && <Badge tone="danger">{t.cloture.annulee}</Badge>}
            </LigneListe>
          ))}
        </div>
      )}
    </Carte>
  );
}

/** Confirmación de la anulación de una venta de la jornada abierta (botón mantenido: sin toque accidental). */
function AnnulerVente({ vente, vendeurId, onClose }: { vente: Vente | null; vendeurId: string; onClose: () => void }) {
  const { notifier } = useSession();
  const annuler = async () => {
    if (!vente) return;
    const ok = await annulerVente({ vendeurId }, vente.id);
    onClose();
    notifier(
      ok
        ? { message: t.cobro.venteAnnulee, tone: 'success', duree: 2000 }
        : { message: t.cloture.annulationImpossible, tone: 'danger', duree: 2500 },
    );
  };
  return (
    <Feuille
      open={vente !== null}
      onClose={onClose}
      title={t.cloture.annulerTitre}
      footer={
        <BoutonMaintenu
          label={t.cloture.annulerVente}
          icon={Undo2}
          tone="danger"
          hint={t.heures.maintenir}
          onComplete={() => void annuler()}
        />
      }
    >
      {vente && (
        <div className="flex flex-col gap-3 pt-1">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <p className="text-body font-semibold">
                {heure(vente.ts)} · {vente.lignes.map((l) => `${l.nomSnapshot} ×${l.qty}`).join(', ')}
              </p>
              <p className="text-caption text-ink-muted">{paiementsTexte(vente)}</p>
            </div>
            <Montant value={vente.paiements.reduce((s, p) => s + p.montantCfp, 0)} size="md" />
          </div>
          <p className="text-caption text-ink-muted">{t.cloture.annulerAide}</p>
        </div>
      )}
    </Feuille>
  );
}

function Comptage({
  open,
  onClose,
  journee,
  ventes,
  vendeurId,
  onCloturee,
}: {
  open: boolean;
  onClose: () => void;
  journee: Journee;
  ventes: Vente[];
  vendeurId: string;
  onCloturee: (heuresEnCours: boolean) => void;
}) {
  // Solo un recordatorio: la clôture puede hacerse en casa, después del mercado; la hora de fin se corrige en Heures.
  const enService = useSessionEnCours(vendeurId);
  const attendus = useMemo(() => attenduParDevise(journee, ventes), [journee, ventes]);
  const [comptes, setComptes] = useState<Record<string, string>>({});
  const [commentaire, setCommentaire] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);

  const cloturer = async () => {
    const saisis: ComptageSaisi[] = [];
    for (const a of attendus) {
      const s = comptes[a.devise]?.trim() ?? '';
      if (s === '') continue;
      const v = lireMontant(s, a.devise);
      if (v === null) {
        setErreur(`${a.devise} : ${t.commun.montantInvalide}`);
        return;
      }
      saisis.push({ devise: a.devise, attendu: a.attendu, compte: v });
    }
    await cloturerJournee({ vendeurId }, journee.id, commentaire, saisis);
    setComptes({});
    setCommentaire('');
    onClose();
    onCloturee(enService !== null);
  };

  return (
    <Feuille
      open={open}
      onClose={onClose}
      title={t.cloture.comptage}
      footer={
        <div className="flex flex-col gap-2">
          <p className="text-caption text-ink-muted">{t.cloture.cloturerAide}</p>
          <BoutonMaintenu
            label={t.cloture.cloturer}
            icon={Lock}
            tone="primary"
            hint={t.heures.maintenir}
            onComplete={() => void cloturer()}
          />
        </div>
      }
    >
      <div className="flex flex-col gap-4 pt-1">
        {enService && (
          <Banniere tone="warning" icon={Clock} title={t.cloture.heuresEnCours(heure(enService.debut))}>
            {t.cloture.heuresEnCoursAide}
          </Banniere>
        )}
        <div className="grid grid-cols-[3.5rem_minmax(0,1fr)_minmax(0,1fr)_5rem] gap-2 text-overline font-semibold tracking-wide text-ink-muted uppercase">
          <span />
          <span>{t.cloture.attendu}</span>
          <span className="text-right">{t.cloture.compte}</span>
          <span className="text-right">{t.cloture.ecart}</span>
        </div>
        <div className="flex flex-col divide-y divide-line">
          {attendus.map((a) => (
            <div key={a.devise}>
              <LigneComptage
                devise={a.devise}
                attendu={a.attendu}
                compte={comptes[a.devise] ?? ''}
                onChange={(v) => setComptes((c) => ({ ...c, [a.devise]: v }))}
              />
              <p className="pb-2 text-caption text-ink-muted tabular-nums">
                {t.cloture.fond} {formatNumber(a.fond, a.devise)} + {t.cloture.recu.toLowerCase()}{' '}
                {formatNumber(a.recu, a.devise)}
                {a.rendu > 0 ? ` − ${t.cloture.rendu.toLowerCase()} ${formatNumber(a.rendu, a.devise)}` : ''}
              </p>
            </div>
          ))}
        </div>
        {erreur && <p className="text-caption text-danger">{erreur}</p>}
        <Champ
          label={t.cloture.commentaire}
          value={commentaire}
          onChange={(e) => setCommentaire(e.target.value)}
          maxLength={500}
        />
      </div>
    </Feuille>
  );
}

function LigneHistorique({ journee, onClick }: { journee: Journee; onClick: () => void }) {
  const ventes = useVentesJournee(journee.id);
  const resume = useMemo(() => resumeJournee(ventes), [ventes]);
  return (
    <LigneListe
      icon={CalendarCheck}
      title={dateMoyenne(journee.dateLocale)}
      subtitle={`${journee.lieu} · ${resume.nbVentes} ${t.cloture.ventes.toLowerCase()}${journee.clotureeAt ? ` · ${t.cloture.cloturee(heure(journee.clotureeAt))}` : ''}`}
      amount={resume.totalEncaisseCfp}
      onClick={onClick}
      chevron
    />
  );
}

function DetailJournee({ journee, onClose }: { journee: Journee | null; onClose: () => void }) {
  const ventes = useVentesJournee(journee?.id ?? null);
  const comptages = useComptages(journee?.id ?? null);
  const resume = useMemo(() => resumeJournee(ventes), [ventes]);
  return (
    <Feuille open={journee !== null} onClose={onClose} title={journee ? dateMoyenne(journee.dateLocale) : ''}>
      {journee && (
        <div className="flex flex-col gap-4 pt-1">
          <p className="text-caption text-ink-muted">
            {journee.lieu} · {t.journee.ouverteDepuis(heure(journee.ouverteAt))}
            {journee.clotureeAt ? ` · ${t.cloture.cloturee(heure(journee.clotureeAt))}` : ''}
          </p>
          <Resume resume={resume} />
          {comptages.length > 0 && (
            <Carte title={t.cloture.comptage} icon={Banknote}>
              <div className="flex flex-col divide-y divide-line">
                {comptages.map((c) => (
                  <div key={c.id} className="flex items-center justify-between py-2 text-body">
                    <span className="font-semibold">{c.devise}</span>
                    <span className="flex gap-3 tabular-nums">
                      <span className="text-ink-muted">
                        {t.cloture.attendu} {formatNumber(c.attendu, c.devise)}
                      </span>
                      <span>
                        {t.cloture.compte} {formatNumber(c.compte, c.devise)}
                      </span>
                      <span className={c.ecart === 0 ? 'text-success' : c.ecart < 0 ? 'text-danger' : 'text-warning'}>
                        {c.ecart === 0
                          ? t.cloture.juste
                          : `${c.ecart > 0 ? '+' : ''}${formatNumber(c.ecart, c.devise)}`}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </Carte>
          )}
          {journee.commentaireCloture && <p className="text-body text-ink-muted">« {journee.commentaireCloture} »</p>}
          <ListeVentes ventes={ventes} />
        </div>
      )}
    </Feuille>
  );
}
