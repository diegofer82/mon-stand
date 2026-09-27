// Panel del propietario (/admin, escritorio): ventas del mes, jornadas y PDF de clôture, horas a pagar,
// exportes CSV, tasas de cambio, archivos, emparejamiento y dispositivos. Cada pestaña carga al abrirse.
// Protegido por Cloudflare Access; si no está configurado, por el jeton ADMIN_TOKEN pegado aquí (sessionStorage).
import {
  Archive,
  ArrowLeftRight,
  Banknote,
  CalendarCheck,
  Clock,
  Download,
  FileText,
  KeyRound,
  Link2,
  RefreshCw,
  Smartphone,
  Trash2,
} from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';

import type { RepartitionPaiement, TopArticle } from '../../shared/domaine/cloture';
import type { Appareil, ErreurApi } from '../../shared/api';
import { formatNumber } from '../../shared/montants';
import { Badge, Banniere, Marque, Montant } from '../composants/ui/Affichage';
import { Bouton } from '../composants/ui/Bouton';
import { Champ } from '../composants/ui/Saisie';
import { Carte, LigneListe } from '../composants/ui/Structure';
import { t } from '../textes/fr';
import { dateCourte, dateMoyenne, heure } from '../utils/format';

const CLE_JETON = 'mon-stand.admin.jeton';

function lireJeton(): string {
  try {
    return sessionStorage.getItem(CLE_JETON) ?? '';
  } catch {
    return '';
  }
}

class ErreurAdmin extends Error {
  constructor(
    public statut: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

let jetonCourant = lireJeton();

async function appelAdmin<T>(chemin: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set('Content-Type', 'application/json');
  if (jetonCourant) headers.set('Authorization', `Bearer ${jetonCourant}`);
  const r = await fetch(chemin, { ...init, headers, credentials: 'same-origin' });
  if (!r.ok) {
    let corps: Partial<ErreurApi> = {};
    try {
      corps = (await r.json()) as Partial<ErreurApi>;
    } catch {
      /* sin JSON */
    }
    throw new ErreurAdmin(r.status, corps.erreur?.code ?? 'inconnu', corps.erreur?.message ?? `Erreur ${r.status}`);
  }
  return (await r.json()) as T;
}

/** Descarga un fichero protegido (CSV, PDF) pasando el jeton en la cabecera. */
async function telecharger(chemin: string, nom: string) {
  const headers = new Headers();
  if (jetonCourant) headers.set('Authorization', `Bearer ${jetonCourant}`);
  const r = await fetch(chemin, { headers, credentials: 'same-origin' });
  if (!r.ok) throw new ErreurAdmin(r.status, 'inconnu', `Erreur ${r.status}`);
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  if (blob.type.includes('pdf') || blob.type.includes('html')) a.target = '_blank';
  else a.download = nom;
  a.rel = 'noopener';
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

interface EtatChargement<T> {
  donnees: T | null;
  erreur: ErreurAdmin | null;
  enCours: boolean;
}

/** Carga de una pestaña: la promesa actualiza el estado (nada de setState síncrono en el efecto). */
function useChargement<T>(charger: () => Promise<T>, cle: string): EtatChargement<T> & { rafraichir: () => void } {
  const [etat, setEtat] = useState<EtatChargement<T>>({ donnees: null, erreur: null, enCours: true });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let actif = true;
    charger().then(
      (d) => {
        if (actif) setEtat({ donnees: d, erreur: null, enCours: false });
      },
      (e: unknown) => {
        if (!actif) return;
        const erreur =
          e instanceof ErreurAdmin
            ? e
            : new ErreurAdmin(0, 'inconnu', e instanceof Error ? e.message : t.erreurs.generique);
        setEtat({ donnees: null, erreur, enCours: false });
      },
    );
    return () => {
      actif = false;
    };
    // `cle` resume las dependencias de `charger` (mes, jeton); `charger` cambia de identidad a cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle, version]);
  return { ...etat, rafraichir: () => setVersion((v) => v + 1) };
}

function moisCourant(): string {
  const p: Record<string, string> = {};
  for (const x of new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Pacific/Noumea',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date()))
    p[x.type] = x.value;
  return `${p.year}-${p.month}`;
}

type Onglet = 'kpis' | 'journees' | 'heures' | 'exports' | 'taux' | 'appareils';
const ONGLETS: { id: Onglet; icon: typeof Banknote }[] = [
  { id: 'kpis', icon: Banknote },
  { id: 'journees', icon: CalendarCheck },
  { id: 'heures', icon: Clock },
  { id: 'exports', icon: Download },
  { id: 'taux', icon: ArrowLeftRight },
  { id: 'appareils', icon: Smartphone },
];

export function Admin() {
  const [jeton, setJeton] = useState(jetonCourant);
  const [saisieJeton, setSaisieJeton] = useState('');
  const [onglet, setOnglet] = useState<Onglet>('kpis');
  const [mois, setMois] = useState(moisCourant);
  const moi = useChargement(() => appelAdmin<{ admin: { via: string } }>('/api/admin/moi'), `moi:${jeton}`);

  const enregistrerJeton = () => {
    const v = saisieJeton.trim();
    try {
      sessionStorage.setItem(CLE_JETON, v);
    } catch {
      /* sin almacenamiento */
    }
    jetonCourant = v;
    setJeton(v);
    setSaisieJeton('');
  };

  const besoinJeton = moi.erreur && (moi.erreur.statut === 401 || moi.erreur.statut === 503);
  const avecMois = onglet === 'kpis' || onglet === 'journees' || onglet === 'heures' || onglet === 'exports';

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-5 px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <Marque />
        <h1 className="font-display text-title font-semibold">{t.admin.titre}</h1>
      </header>

      {besoinJeton && (
        <Carte title={t.admin.jeton} icon={KeyRound}>
          {moi.erreur?.statut === 503 && (
            <Banniere tone="warning" className="mb-3">
              {t.admin.nonConfigure}
            </Banniere>
          )}
          <p className="mb-3 text-caption text-ink-muted">{t.admin.jetonAide}</p>
          <div className="flex items-end gap-2">
            <Champ
              label={t.admin.jeton}
              type="password"
              value={saisieJeton}
              onChange={(e) => setSaisieJeton(e.target.value)}
              className="flex-1"
              autoComplete="off"
            />
            <Bouton variant="primary" size="md" onClick={enregistrerJeton} disabled={!saisieJeton.trim()}>
              {t.commun.valider}
            </Bouton>
          </div>
        </Carte>
      )}
      {moi.erreur && !besoinJeton && <Banniere tone="danger">{moi.erreur.message}</Banniere>}

      {moi.donnees && (
        <>
          <nav aria-label={t.admin.titre} className="flex flex-wrap items-center gap-2">
            {ONGLETS.map((o) => (
              <Bouton
                key={o.id}
                variant={onglet === o.id ? 'brand' : 'secondary'}
                size="md"
                icon={o.icon}
                onClick={() => setOnglet(o.id)}
                aria-current={onglet === o.id ? 'page' : undefined}
              >
                {t.panneau.onglets[o.id]}
              </Bouton>
            ))}
            {avecMois && (
              <label className="ml-auto flex items-center gap-2 text-caption font-semibold text-ink-muted">
                {t.panneau.mois}
                <input
                  type="month"
                  value={mois}
                  onChange={(e) => e.target.value && setMois(e.target.value)}
                  className="h-10 rounded-md border border-line-strong bg-surface px-2 text-body text-ink"
                />
              </label>
            )}
          </nav>
          {onglet === 'kpis' && <OngletKpis mois={mois} />}
          {onglet === 'journees' && <OngletJournees mois={mois} />}
          {onglet === 'heures' && <OngletHeures mois={mois} />}
          {onglet === 'exports' && <OngletExports mois={mois} />}
          {onglet === 'taux' && <OngletTaux />}
          {onglet === 'appareils' && <OngletAppareils />}
        </>
      )}
    </main>
  );
}

interface Kpis {
  mois: string;
  total: {
    nbJournees: number;
    nbVentes: number;
    nbArticles: number;
    totalEncaisseCfp: number;
    panierMoyenCfp: number;
    parPaiement: RepartitionPaiement[];
    topArticles: TopArticle[];
  };
  parJournee: {
    id: string;
    dateLocale: string;
    lieu: string;
    vendeur: string;
    ouverteAt: string;
    clotureeAt: string | null;
    pdfKey: string | null;
    nbVentes: number;
    totalEncaisseCfp: number;
    panierMoyenCfp: number;
  }[];
  parLieu: { lieu: string; nbJournees: number; nbVentes: number; totalEncaisseCfp: number }[];
  heures: {
    vendeurId: string;
    prenom: string;
    tauxHoraireCfp: number;
    nbSessions: number;
    totalMin: number;
    totalTexte: string;
    aPayerCfp: number;
    aPayerTexte: string;
    payeCfp: number;
  }[];
}

function Chargement({
  etat,
  children,
}: {
  etat: { erreur: ErreurAdmin | null; enCours: boolean };
  children: ReactNode;
}) {
  if (etat.enCours) return <p className="py-6 text-center text-body text-ink-muted">{t.panneau.chargement}</p>;
  if (etat.erreur) return <Banniere tone="danger">{etat.erreur.message}</Banniere>;
  return <>{children}</>;
}

function Kpi({
  label,
  value,
  devise = 'CFP',
  detail,
}: {
  label: string;
  value: number;
  devise?: string | null;
  detail?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-line bg-surface p-4">
      <p className="text-overline font-semibold tracking-wide text-ink-muted uppercase">{label}</p>
      {devise ? (
        <Montant value={value} devise={devise} size="lg" />
      ) : (
        <span className="text-amount-lg font-semibold tabular-nums">{formatNumber(value)}</span>
      )}
      {detail && <p className="text-caption text-ink-muted">{detail}</p>}
    </div>
  );
}

function Tableau({ entetes, lignes, vide }: { entetes: string[]; lignes: ReactNode[][]; vide: string }) {
  if (lignes.length === 0) return <p className="text-body text-ink-muted">{vide}</p>;
  return (
    <table className="w-full text-body">
      <thead>
        <tr>
          {entetes.map((e, i) => (
            <th
              key={i}
              className={`pb-1 text-overline font-semibold tracking-wide text-ink-muted uppercase ${i > 0 ? 'text-right' : 'text-left'}`}
            >
              {e}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {lignes.map((l, i) => (
          <tr key={i} className="border-t border-line">
            {l.map((c, j) => (
              <td key={j} className={`py-1.5 ${j > 0 ? 'text-right tabular-nums' : ''}`} data-label={entetes[j]}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function OngletKpis({ mois }: { mois: string }) {
  const etat = useChargement(() => appelAdmin<Kpis>(`/api/admin/kpis?mois=${mois}`), `kpis:${mois}`);
  const k = etat.donnees;
  return (
    <Chargement etat={etat}>
      {k && (
        <div className="flex flex-col gap-4">
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi label={t.panneau.chiffreAffaires} value={k.total.totalEncaisseCfp} />
            <Kpi label={t.panneau.journees} value={k.total.nbJournees} devise={null} />
            <Kpi
              label={t.panneau.ventes}
              value={k.total.nbVentes}
              devise={null}
              detail={`${k.total.nbArticles} ${t.panneau.articlesVendus.toLowerCase()}`}
            />
            <Kpi label={t.panneau.panierMoyen} value={k.total.panierMoyenCfp} />
          </section>
          <div className="grid gap-4 md:grid-cols-3">
            <Carte title={t.panneau.parLieu}>
              <Tableau
                entetes={[t.panneau.lieu, t.panneau.journees, t.panneau.ventes, t.panneau.encaisse]}
                lignes={k.parLieu.map((l) => [
                  l.lieu,
                  String(l.nbJournees),
                  String(l.nbVentes),
                  <Montant key="m" value={l.totalEncaisseCfp} size="md" />,
                ])}
                vide={t.panneau.aucuneJournee}
              />
            </Carte>
            <Carte title={t.panneau.parPaiement}>
              <Tableau
                entetes={['', '×', t.panneau.encaisse]}
                lignes={k.total.parPaiement.map((p) => [
                  p.devise === 'TPE' ? t.cobro.carte : p.devise,
                  String(p.nb),
                  <span key="m" className="tabular-nums">
                    {formatNumber(p.montantDevise, p.devise)} {p.devise === 'TPE' ? 'CFP' : p.devise}
                    <br />
                    <span className="text-caption text-ink-muted">≈ {formatNumber(p.montantCfp)} CFP</span>
                  </span>,
                ])}
                vide="—"
              />
            </Carte>
            <Carte title={t.panneau.topArticles}>
              <Tableau
                entetes={['', '×', t.panneau.encaisse]}
                lignes={k.total.topArticles.map((a) => [
                  a.nom,
                  String(a.qty),
                  <Montant key="m" value={a.totalCfp} size="md" />,
                ])}
                vide="—"
              />
            </Carte>
          </div>
        </div>
      )}
    </Chargement>
  );
}

function OngletJournees({ mois }: { mois: string }) {
  const etat = useChargement(() => appelAdmin<Kpis>(`/api/admin/kpis?mois=${mois}`), `journees:${mois}`);
  const [message, setMessage] = useState<string | null>(null);
  const regenerer = async (id: string) => {
    try {
      const r = await appelAdmin<{ cle: string; format: string }>(`/api/admin/journees/${id}/pdf`, { method: 'POST' });
      setMessage(`${t.panneau.cloture} ${r.format.toUpperCase()} · ${r.cle}`);
      etat.rafraichir();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t.erreurs.generique);
    }
  };
  return (
    <Chargement etat={etat}>
      {message && <Banniere tone="neutral">{message}</Banniere>}
      <Carte title={t.panneau.journees} icon={CalendarCheck} flush>
        {etat.donnees?.parJournee.length === 0 ? (
          <p className="px-4 pb-4 text-body text-ink-muted">{t.panneau.aucuneJournee}</p>
        ) : (
          <div className="flex flex-col divide-y divide-line px-3 pb-2">
            {etat.donnees?.parJournee.map((j) => (
              <LigneListe
                key={j.id}
                icon={CalendarCheck}
                title={dateMoyenne(j.dateLocale)}
                subtitle={`${j.lieu} · ${j.vendeur} · ${j.nbVentes} ${t.panneau.nbVentes.toLowerCase()}${j.clotureeAt ? ` · ${t.cloture.cloturee(heure(j.clotureeAt))}` : ''}`}
                amount={j.totalEncaisseCfp}
              >
                {!j.clotureeAt && <Badge tone="warning">{t.panneau.ouverte}</Badge>}
                {j.pdfKey ? (
                  <Bouton
                    variant="secondary"
                    size="sm"
                    icon={FileText}
                    onClick={() =>
                      void telecharger(`/api/admin/journees/${j.id}/pdf`, j.pdfKey?.split('/').pop() ?? 'cloture')
                    }
                  >
                    {j.pdfKey.endsWith('.pdf') ? t.panneau.voirPdf : t.panneau.voirHtml}
                  </Bouton>
                ) : (
                  j.clotureeAt && <Badge tone="neutral">{t.panneau.pasDeCloture}</Badge>
                )}
                {j.clotureeAt && (
                  <Bouton variant="ghost" size="sm" icon={RefreshCw} onClick={() => void regenerer(j.id)}>
                    {t.panneau.regenerer}
                  </Bouton>
                )}
              </LigneListe>
            ))}
          </div>
        )}
      </Carte>
    </Chargement>
  );
}

function OngletHeures({ mois }: { mois: string }) {
  const etat = useChargement(() => appelAdmin<Kpis>(`/api/admin/kpis?mois=${mois}`), `heures:${mois}`);
  return (
    <Chargement etat={etat}>
      <Carte title={t.panneau.heuresTitre} icon={Clock}>
        <Tableau
          entetes={[t.panneau.vendeuse, t.panneau.tauxHoraire, t.panneau.total, t.panneau.aPayer, t.panneau.paye]}
          lignes={(etat.donnees?.heures ?? []).map((h) => [
            h.prenom,
            <Montant key="t" value={h.tauxHoraireCfp} size="md" />,
            `${h.totalTexte} (${h.nbSessions})`,
            <span key="a">
              <Montant value={h.aPayerCfp} size="md" tone={h.aPayerCfp > 0 ? 'danger' : 'default'} />
              <br />
              <span className="text-caption text-ink-muted">{h.aPayerTexte}</span>
            </span>,
            <Montant key="p" value={h.payeCfp} size="md" tone="success" />,
          ])}
          vide="—"
        />
      </Carte>
    </Chargement>
  );
}

function OngletExports({ mois }: { mois: string }) {
  const archives = useChargement(
    () => appelAdmin<{ archives: { cle: string; taille: number; date: string }[] }>('/api/admin/archives'),
    'archives',
  );
  const [message, setMessage] = useState<string | null>(null);
  const archiver = async () => {
    try {
      const r = await appelAdmin<{ mois: string; cle: string; lignes: number }>('/api/admin/archives', {
        method: 'POST',
      });
      setMessage(`${r.cle} · ${r.lignes} lignes`);
      archives.rafraichir();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t.erreurs.generique);
    }
  };
  return (
    <div className="flex flex-col gap-4">
      <Carte title={t.panneau.onglets.exports} icon={Download}>
        <p className="mb-3 text-caption text-ink-muted">{t.panneau.exportAide}</p>
        <div className="flex flex-wrap gap-2">
          <Bouton
            variant="primary"
            size="md"
            icon={Download}
            onClick={() => void telecharger(`/api/admin/export/ventes.csv?mois=${mois}`, `ventes_${mois}.csv`)}
          >
            {t.panneau.exportVentes}
          </Bouton>
          <Bouton
            variant="secondary"
            size="md"
            icon={Download}
            onClick={() => void telecharger(`/api/admin/export/heures.csv?mois=${mois}`, `heures_${mois}.csv`)}
          >
            {t.panneau.exportHeures}
          </Bouton>
        </div>
      </Carte>
      <Carte
        title={t.panneau.archives}
        icon={Archive}
        action={
          <Bouton variant="ghost" size="sm" icon={Archive} onClick={() => void archiver()}>
            {t.panneau.archiverMaintenant}
          </Bouton>
        }
      >
        <p className="mb-3 text-caption text-ink-muted">{t.panneau.archivesAide}</p>
        {message && (
          <Banniere tone="neutral" className="mb-3">
            {message}
          </Banniere>
        )}
        <Chargement etat={archives}>
          {archives.donnees?.archives.length === 0 ? (
            <p className="text-body text-ink-muted">{t.panneau.aucuneArchive}</p>
          ) : (
            <div className="flex flex-col divide-y divide-line">
              {archives.donnees?.archives.map((a) => {
                const moisA = a.cle.split('/').pop()?.replace('.json', '') ?? '';
                return (
                  <LigneListe
                    key={a.cle}
                    icon={Archive}
                    title={moisA}
                    subtitle={`${Math.round(a.taille / 1024)} Ko · ${dateCourte(a.date.slice(0, 10))}`}
                  >
                    <Bouton
                      variant="secondary"
                      size="sm"
                      icon={Download}
                      onClick={() => void telecharger(`/api/admin/archives/${moisA}`, `mon-stand_${moisA}.json`)}
                    >
                      JSON
                    </Bouton>
                  </LigneListe>
                );
              })}
            </div>
          )}
        </Chargement>
      </Carte>
    </div>
  );
}

interface Taux {
  kv: { date: string; source: string; majAt: string } | null;
  historique: { devise: string; cfpParUnite: number; source: string; date: string }[];
}

function OngletTaux() {
  const etat = useChargement(() => appelAdmin<Taux>('/api/admin/taux'), 'taux');
  const [message, setMessage] = useState<string | null>(null);
  const actualiser = async () => {
    try {
      await appelAdmin('/api/admin/taux/actualiser', { method: 'POST' });
      setMessage(t.panneau.tauxActualises);
      etat.rafraichir();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t.erreurs.generique);
    }
  };
  return (
    <Carte
      title={t.panneau.tauxTitre}
      icon={ArrowLeftRight}
      action={
        <Bouton variant="ghost" size="sm" icon={RefreshCw} onClick={() => void actualiser()}>
          {t.panneau.actualiserTaux}
        </Bouton>
      }
    >
      <p className="mb-3 text-caption text-ink-muted">{t.panneau.tauxAide}</p>
      {message && (
        <Banniere tone="neutral" className="mb-3">
          {message}
        </Banniere>
      )}
      <Chargement etat={etat}>
        <Tableau
          entetes={['', '1 unité =', 'Source']}
          lignes={(etat.donnees?.historique ?? []).map((x) => [
            x.devise,
            `${formatNumber(x.cfpParUnite, 'AUD')} CFP`,
            t.panneau.tauxSource(x.source, x.date),
          ])}
          vide="—"
        />
      </Chargement>
    </Carte>
  );
}

function OngletAppareils() {
  const etat = useChargement(() => appelAdmin<{ appareils: Appareil[] }>('/api/admin/devices'), 'appareils');
  const [code, setCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const genererCode = async () => {
    try {
      setCode(await appelAdmin<{ code: string; expiresAt: string }>('/api/admin/pairing', { method: 'POST' }));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t.erreurs.generique);
    }
  };
  const revoquer = async (a: Appareil) => {
    if (!window.confirm(t.admin.revoquerConfirm(a.nom))) return;
    try {
      await appelAdmin('/api/admin/devices/' + encodeURIComponent(a.id), { method: 'DELETE' });
      etat.rafraichir();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t.erreurs.generique);
    }
  };
  return (
    <div className="flex flex-col gap-4">
      {message && <Banniere tone="danger">{message}</Banniere>}
      <Carte title={t.admin.appairage} icon={Link2}>
        <p className="mb-3 text-caption text-ink-muted">{t.admin.appairageAide}</p>
        <div className="flex flex-wrap items-center gap-4">
          <Bouton variant="primary" size="lg" icon={Link2} onClick={() => void genererCode()}>
            {t.admin.genererCode}
          </Bouton>
          {code && (
            <div className="flex flex-col">
              <span className="font-mono text-amount-xl font-bold tracking-[0.2em] text-violet">{code.code}</span>
              <span className="text-caption text-ink-muted">{t.admin.codeValable(heure(code.expiresAt))}</span>
            </div>
          )}
        </div>
      </Carte>
      <Carte
        title={t.admin.appareils}
        icon={Smartphone}
        action={
          <Bouton variant="ghost" size="sm" icon={RefreshCw} onClick={etat.rafraichir}>
            {t.admin.actualiser}
          </Bouton>
        }
      >
        <Chargement etat={etat}>
          {etat.donnees?.appareils.length === 0 ? (
            <p className="text-body text-ink-muted">{t.admin.aucunAppareil}</p>
          ) : (
            <div className="flex flex-col divide-y divide-line">
              {etat.donnees?.appareils.map((a) => (
                <LigneListe
                  key={a.id}
                  icon={Smartphone}
                  title={a.nom}
                  subtitle={`${t.admin.appaire} ${dateCourte(a.createdAt.slice(0, 10))}${a.lastSeenAt ? ` · ${t.admin.vu} ${dateCourte(a.lastSeenAt.slice(0, 10))} ${heure(a.lastSeenAt)}` : ''}`}
                >
                  {a.actif ? (
                    <Badge tone="success">{t.admin.actif}</Badge>
                  ) : (
                    <Badge tone="neutral">{t.admin.revoque}</Badge>
                  )}
                  {a.actif && (
                    <Bouton variant="ghost" size="sm" icon={Trash2} onClick={() => void revoquer(a)}>
                      {t.admin.revoquer}
                    </Bouton>
                  )}
                </LigneListe>
              ))}
            </div>
          )}
        </Chargement>
      </Carte>
    </div>
  );
}
