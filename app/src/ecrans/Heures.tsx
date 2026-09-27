// Horas: Commencer/Terminer manteniendo pulsado, resumen del mes (total, a pagar, pagado), sesiones editables.
import { CheckCircle2, Clock, Pencil, Play, Plus, Square, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { dateMetier } from '../../shared/dates';
import { formatDuree, montantDuCfp, resumeHeures } from '../../shared/domaine/heures';
import type { SessionTravail } from '../../shared/domaine/types';
import { Badge, Kpi } from '../composants/ui/Affichage';
import { Bouton, BoutonMaintenu } from '../composants/ui/Bouton';
import { Champ } from '../composants/ui/Saisie';
import { EtatVide, Feuille, LigneListe } from '../composants/ui/Structure';
import { basculerPayee, commencerSession, enregistrerSession, supprimerSession, terminerSession } from '../db/actions';
import { useSessionEnCours, useSessions, useVendeur } from '../db/hooks';
import { useSession } from '../etat/session';
import { t } from '../textes/fr';
import { dateCourte, heure, instantLocal, moisDe, partiesLocales } from '../utils/format';

export function Heures({ vendeurId }: { vendeurId: string }) {
  const { notifier } = useSession();
  const vendeur = useVendeur(vendeurId);
  const sessions = useSessions(vendeurId);
  const enCours = useSessionEnCours(vendeurId);
  const [edition, setEdition] = useState<SessionTravail | 'nouvelle' | null>(null);
  const tauxH = vendeur?.tauxHoraireCfp ?? 0;

  const mois = moisDe(dateMetier());
  const duMois = useMemo(() => sessions.filter((s) => moisDe(partiesLocales(s.debut).date) === mois), [sessions, mois]);
  const resume = useMemo(() => resumeHeures(duMois, tauxH), [duMois, tauxH]);
  const resumeTotal = useMemo(() => resumeHeures(sessions, tauxH), [sessions, tauxH]);

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 pb-6">
      <section className="flex flex-col items-center gap-3 rounded-lg border border-line bg-surface p-4">
        <p className="flex items-center gap-2 text-body font-semibold">
          <span aria-hidden className={`size-2.5 rounded-full ${enCours ? 'bg-success' : 'bg-line-strong'}`} />
          {enCours ? t.heures.enServiceDepuis(heure(enCours.debut)) : t.heures.nonPointee}
        </p>
        {enCours ? (
          <BoutonMaintenu
            label={t.heures.terminer}
            icon={Square}
            tone="danger"
            hint={t.heures.maintenir}
            className="w-full"
            onComplete={() => {
              void terminerSession({ vendeurId }, enCours.id).then(() =>
                notifier({ message: t.heures.sessionEnregistree, duree: 2000 }),
              );
            }}
          />
        ) : (
          <BoutonMaintenu
            label={t.heures.commencer}
            icon={Play}
            tone="success"
            hint={t.heures.maintenir}
            className="w-full"
            onComplete={() => {
              void commencerSession({ vendeurId }).then((s) =>
                notifier({ message: `${t.heures.commencer} — ${heure(s.debut)}`, duree: 2000 }),
              );
            }}
          />
        )}
        <p className="text-caption text-ink-muted">{t.heures.arrondi}</p>
      </section>

      <section className="grid grid-cols-2 gap-2">
        <Kpi
          label={`${t.heures.ceMois} · ${t.heures.total}`}
          value={formatDuree(resume.totalMin)}
          devise={null}
          detail={`${resume.nbSessions} ${t.heures.sessions.toLowerCase()}`}
        />
        <Kpi label={t.heures.tauxHoraire} value={tauxH} detail="par heure" />
        <Kpi
          label={t.heures.aPayer}
          value={resumeTotal.duCfp}
          detail={
            resumeTotal.duCfp > 0 ? formatDuree(Math.round((resumeTotal.duCfp / Math.max(1, tauxH)) * 60)) : undefined
          }
        />
        <Kpi label={`${t.heures.ceMois} · ${t.heures.paye}`} value={resume.payeCfp} />
      </section>

      <section className="flex flex-col rounded-lg border border-line bg-surface px-3 py-2">
        <div className="flex items-center justify-between py-1">
          <h2 className="text-heading font-bold">{t.heures.sessions}</h2>
          <Bouton variant="ghost" size="sm" icon={Plus} onClick={() => setEdition('nouvelle')}>
            {t.heures.ajouter}
          </Bouton>
        </div>
        {sessions.length === 0 ? (
          <EtatVide icon={Clock} title={t.heures.aucuneSession} />
        ) : (
          <div className="flex flex-col divide-y divide-line">
            {sessions.map((s) => (
              <LigneListe
                key={s.id}
                icon={Clock}
                title={`${dateCourte(partiesLocales(s.debut).date)} · ${heure(s.debut)} → ${s.fin ? heure(s.fin) : t.heures.enCours}`}
                subtitle={
                  s.fin && s.dureeMin !== null
                    ? `${formatDuree(s.dureeMin)}${s.commentaire ? ` · ${s.commentaire}` : ''}`
                    : (s.commentaire ?? undefined)
                }
                amount={s.dureeMin !== null ? montantDuCfp(s.dureeMin, tauxH) : undefined}
                onClick={s.fin ? () => setEdition(s) : undefined}
                chevron={!!s.fin}
              >
                {s.fin &&
                  (s.payeeAt ? (
                    <Badge tone="success" icon={CheckCircle2}>
                      {t.heures.payee}
                    </Badge>
                  ) : (
                    <Badge tone="warning">{t.heures.nonPayee}</Badge>
                  ))}
              </LigneListe>
            ))}
          </div>
        )}
      </section>

      <EditionSession
        session={edition === 'nouvelle' ? null : edition}
        open={edition !== null}
        onClose={() => setEdition(null)}
        vendeurId={vendeurId}
      />
    </div>
  );
}

interface EditionSessionProps {
  session: SessionTravail | null;
  open: boolean;
  onClose: () => void;
  vendeurId: string;
}

/** El formulario se monta al abrirse (y se remonta por sesión): nace con los valores de la sesión. */
function EditionSession({ open, session, ...rest }: EditionSessionProps) {
  if (!open) return null;
  return <FormulaireSession key={session?.id ?? 'nouvelle'} session={session} {...rest} />;
}

function FormulaireSession({ session, onClose, vendeurId }: Omit<EditionSessionProps, 'open'>) {
  const { notifier } = useSession();
  const [date, setDate] = useState(() => (session ? partiesLocales(session.debut).date : dateMetier()));
  const [debut, setDebut] = useState(() => (session ? partiesLocales(session.debut).heure : '07:00'));
  const [fin, setFin] = useState(() => (session?.fin ? partiesLocales(session.fin).heure : '16:00'));
  const [commentaire, setCommentaire] = useState(session?.commentaire ?? '');
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmerSuppression, setConfirmerSuppression] = useState(false);

  const enregistrer = async () => {
    if (!date || !debut || !fin) {
      setErreur(t.commun.champRequis);
      return;
    }
    const debutIso = instantLocal(date, debut);
    const finIso = instantLocal(date, fin);
    if (finIso <= debutIso) {
      setErreur(t.heures.finAvantDebut);
      return;
    }
    await enregistrerSession(
      { vendeurId },
      {
        id: session?.id ?? `ses_${crypto.randomUUID()}`,
        vendeurId,
        debut: debutIso,
        fin: finIso,
        commentaire: commentaire.trim() || null,
        payeeAt: session?.payeeAt ?? null,
      },
    );
    notifier({ message: t.heures.sessionEnregistree, duree: 1500 });
    onClose();
  };

  return (
    <Feuille
      open
      onClose={onClose}
      title={session ? t.heures.modifierSession : t.heures.ajouter}
      footer={
        <div className="flex flex-col gap-2">
          {session && (
            <div className="flex gap-2">
              <Bouton
                variant="secondary"
                size="md"
                block
                icon={CheckCircle2}
                onClick={() => void basculerPayee({ vendeurId }, session.id).then(onClose)}
              >
                {session.payeeAt ? t.heures.marquerNonPayee : t.heures.marquerPayee}
              </Bouton>
              {confirmerSuppression ? (
                <Bouton
                  variant="danger"
                  size="md"
                  icon={Trash2}
                  onClick={() => void supprimerSession({ vendeurId }, session.id).then(onClose)}
                >
                  {t.commun.supprimer}
                </Bouton>
              ) : (
                <Bouton
                  variant="ghost"
                  size="md"
                  icon={Trash2}
                  aria-label={t.commun.supprimer}
                  iconOnly
                  onClick={() => setConfirmerSuppression(true)}
                />
              )}
            </div>
          )}
          {confirmerSuppression && <p className="text-caption text-danger">{t.heures.supprimerConfirm}</p>}
          <Bouton variant="primary" size="lg" block icon={Pencil} onClick={() => void enregistrer()}>
            {t.commun.enregistrer}
          </Bouton>
        </div>
      }
    >
      <div className="flex flex-col gap-4 pt-1">
        <Champ label={t.heures.date} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Champ
            label={t.heures.debut}
            type="time"
            step={1800}
            value={debut}
            onChange={(e) => setDebut(e.target.value)}
          />
          <Champ
            label={t.heures.fin}
            type="time"
            step={1800}
            value={fin}
            onChange={(e) => setFin(e.target.value)}
            error={erreur === t.heures.finAvantDebut ? erreur : null}
          />
        </div>
        <Champ
          label={t.heures.commentaire}
          value={commentaire}
          onChange={(e) => setCommentaire(e.target.value)}
          maxLength={200}
        />
        {erreur === t.commun.champRequis && <p className="text-caption text-danger">{erreur}</p>}
      </div>
    </Feuille>
  );
}
