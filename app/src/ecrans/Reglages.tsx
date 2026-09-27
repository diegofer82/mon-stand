// Réglages: vendedoras y PIN, tasas de cambio, categorías, lugar por defecto, apariencia, instalación, export, versión.
import {
  ArrowLeftRight,
  Copy,
  Download,
  KeyRound,
  Link2,
  LogOut,
  Moon,
  Palette,
  Plus,
  RefreshCw,
  Smartphone,
  Sun,
  Tag,
  Unlink,
  UserPlus,
  Users,
} from 'lucide-react';
import { useState } from 'react';

import { LIEU_DEFAUT, TAUX_HORAIRE_DEFAUT } from '../../shared/domaine/catalogue';
import type { Vendeur } from '../../shared/domaine/types';
import { formatNumber, lireMontant, type Devise } from '../../shared/montants';
import { genererSel, hacherPin, pinValide } from '../../shared/pin';
import { DEVISES_ETRANGERES } from '../../shared/taux';
import { Avatar, Badge } from '../composants/ui/Affichage';
import { Bouton } from '../composants/ui/Bouton';
import { Champ, Segments } from '../composants/ui/Saisie';
import { Carte, Feuille, LigneListe } from '../composants/ui/Structure';
import { definirSetting, definirTaux, enregistrerCategorie, enregistrerVendeur } from '../db/actions';
import { db, TABLES_DONNEES } from '../db/db';
import { useCategories, useMeta, useOutboxCount, useSetting, useTauxDetail, useVendeurs } from '../db/hooks';
import { useSession } from '../etat/session';
import { appliquerTheme, lireTheme, type Theme } from '../etat/theme';
import { useInstallation } from '../pwa/installation';
import { desappairer, synchroniser } from '../sync/client';
import { useSync } from '../sync/useSync';
import { t } from '../textes/fr';
import { heure } from '../utils/format';

export function Reglages({ open, onClose, vendeurId }: { open: boolean; onClose: () => void; vendeurId: string }) {
  const { notifier, deconnecter } = useSession();
  const vendeurs = useVendeurs();
  const categories = useCategories();
  const taux = useTauxDetail();
  const lieuDefaut = useSetting('lieuDefaut');
  const [theme, setTheme] = useState<Theme>(lireTheme);
  const [editionVendeur, setEditionVendeur] = useState<Vendeur | 'nouveau' | null>(null);
  const [editionTaux, setEditionTaux] = useState(false);
  const [nouvelleCategorie, setNouvelleCategorie] = useState('');
  // null = no editado: se muestra el valor guardado.
  const [lieuSaisi, setLieu] = useState<string | null>(null);
  const lieu = lieuSaisi ?? lieuDefaut ?? LIEU_DEFAUT;
  const { situation, installer, reporter, reportee } = useInstallation();
  const deviceNom = useMeta('deviceNom');
  const enAttente = useOutboxCount();
  const sync = useSync();
  const [confirmerDesappairage, setConfirmerDesappairage] = useState(false);

  const changerTheme = (th: string) => {
    const v = th as Theme;
    setTheme(v);
    appliquerTheme(v);
  };

  const ajouterCategorie = async () => {
    const nom = nouvelleCategorie.trim();
    if (!nom) return;
    await enregistrerCategorie(
      { vendeurId },
      { id: `cat_${crypto.randomUUID()}`, nom, emoji: null, ordre: categories.length + 1 },
    );
    setNouvelleCategorie('');
  };

  const enregistrerLieu = async () => {
    await definirSetting({ vendeurId }, 'lieuDefaut', lieu.trim() || LIEU_DEFAUT);
    notifier({ message: t.reglages.enregistre, duree: 1500 });
  };

  const exporter = async () => {
    const donnees: Record<string, unknown> = {
      app: 'mon-stand',
      version: __APP_VERSION__,
      exportedAt: new Date().toISOString(),
    };
    for (const table of TABLES_DONNEES) donnees[table] = await db.table(table).toArray();
    // Los hashes de PIN no salen del teléfono.
    donnees.vendeurs = (donnees.vendeurs as Vendeur[]).map((v) => ({
      id: v.id,
      prenom: v.prenom,
      tauxHoraireCfp: v.tauxHoraireCfp,
      actif: v.actif,
    }));
    const blob = new Blob([JSON.stringify(donnees, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `mon-stand_export_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    notifier({ message: t.reglages.exporte, duree: 1500 });
  };

  const copierLien = async () => {
    await navigator.clipboard.writeText(location.origin);
    notifier({ message: t.reglages.lienCopie, duree: 1500 });
  };

  return (
    <Feuille open={open} onClose={onClose} title={t.reglages.titre} full>
      <div className="flex flex-col gap-4 pt-1 pb-6">
        {situation !== 'installee' && !reportee && (
          <Carte title={t.reglages.installerTitre} icon={Smartphone}>
            <p className="mb-3 text-caption text-ink-muted">{t.reglages.installerAide}</p>
            {situation === 'native' && (
              <Bouton variant="primary" size="lg" block icon={Download} onClick={() => void installer()}>
                {t.reglages.installer}
              </Bouton>
            )}
            {situation === 'ios' && <p className="text-body">{t.reglages.installerIos}</p>}
            {situation === 'manuel' && (
              <p className="text-body">
                {t.reglages.installerIos.replace('Sur iPhone : Partager', 'Menu du navigateur')}
              </p>
            )}
            {situation === 'integre' && (
              <div className="flex flex-col gap-2">
                <p className="text-body">{t.reglages.installerAutre}</p>
                <Bouton variant="secondary" size="md" icon={Copy} onClick={() => void copierLien()}>
                  {t.reglages.copierLien}
                </Bouton>
              </div>
            )}
            <Bouton variant="ghost" size="sm" className="mt-2 self-end" onClick={reporter}>
              {t.commun.plusTard}
            </Bouton>
          </Carte>
        )}

        <Carte
          title={t.reglages.vendeuses}
          icon={Users}
          action={
            <Bouton variant="ghost" size="sm" icon={UserPlus} onClick={() => setEditionVendeur('nouveau')}>
              {t.reglages.ajouterVendeuse}
            </Bouton>
          }
        >
          <div className="flex flex-col divide-y divide-line">
            {vendeurs.map((v) => (
              <LigneListe
                key={v.id}
                title={v.prenom}
                subtitle={`${t.heures.tauxHoraire} ${formatNumber(v.tauxHoraireCfp)} CFP`}
                onClick={() => setEditionVendeur(v)}
                chevron
              >
                <Avatar name={v.prenom} size={32} />
                {!v.actif && <Badge tone="neutral">{t.stock.inactif}</Badge>}
              </LigneListe>
            ))}
          </div>
        </Carte>

        <Carte
          title={t.reglages.taux}
          icon={ArrowLeftRight}
          action={
            <Bouton variant="ghost" size="sm" onClick={() => setEditionTaux(true)}>
              {t.commun.modifier}
            </Bouton>
          }
        >
          <div className="flex flex-col divide-y divide-line">
            {DEVISES_ETRANGERES.map((d) => {
              const ligne = taux.find((x) => x.devise === d);
              return (
                <div key={d} className="flex items-center justify-between py-2 text-body">
                  <span className="font-semibold">{d}</span>
                  <span className="flex flex-col items-end tabular-nums">
                    <span>
                      1 {d} = {ligne ? formatNumber(ligne.cfpParUnite, 'AUD') : '—'} CFP
                    </span>
                    {ligne && (
                      <span className="text-caption text-ink-muted">
                        {t.reglages.tauxSource(ligne.source, ligne.date)}
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-caption text-ink-muted">{t.reglages.tauxAide}</p>
        </Carte>

        <Carte title={t.reglages.categories} icon={Tag}>
          <div className="flex flex-col divide-y divide-line">
            {categories.map((c) => (
              <LigneListe key={c.id} emoji={c.emoji} title={c.nom} />
            ))}
          </div>
          <div className="mt-2 flex items-end gap-2">
            <Champ
              label={t.reglages.ajouterCategorie}
              value={nouvelleCategorie}
              onChange={(e) => setNouvelleCategorie(e.target.value)}
              className="flex-1"
              maxLength={40}
            />
            <Bouton
              variant="secondary"
              size="md"
              icon={Plus}
              iconOnly
              aria-label={t.reglages.ajouterCategorie}
              onClick={() => void ajouterCategorie()}
              disabled={!nouvelleCategorie.trim()}
            />
          </div>
        </Carte>

        <Carte title={t.reglages.lieuDefaut}>
          <div className="flex items-end gap-2">
            <Champ
              label={t.journee.lieu}
              value={lieu}
              onChange={(e) => setLieu(e.target.value)}
              className="flex-1"
              maxLength={60}
            />
            <Bouton variant="secondary" size="md" onClick={() => void enregistrerLieu()}>
              {t.commun.enregistrer}
            </Bouton>
          </div>
        </Carte>

        <Carte title={t.reglages.theme} icon={Palette}>
          <Segments
            label={t.reglages.theme}
            value={theme}
            onChange={changerTheme}
            options={[
              { id: 'auto', label: t.reglages.themeAuto },
              { id: 'light', label: t.reglages.themeClair, icon: Sun },
              { id: 'dark', label: t.reglages.themeSombre, icon: Moon },
            ]}
          />
        </Carte>

        <Carte title={t.reglages.appareil} icon={Smartphone}>
          <div className="flex flex-col gap-2">
            <p className="text-body font-semibold">{t.appairage.appareilNom(deviceNom ?? '—')}</p>
            <p className="text-caption text-ink-muted">
              {sync.derniereSync ? t.appairage.derniereSync(heure(sync.derniereSync)) : t.appairage.jamaisSync}
              {enAttente > 0 ? ` · ${t.sync.enAttente(enAttente)}` : ''}
            </p>
            <Bouton variant="secondary" size="md" block icon={RefreshCw} onClick={() => void synchroniser()}>
              {t.appairage.resynchroniser}
            </Bouton>
            <Bouton variant="secondary" size="md" block icon={Download} onClick={() => void exporter()}>
              {t.reglages.exporter}
            </Bouton>
            <Bouton variant="secondary" size="md" block icon={Link2} onClick={() => void copierLien()}>
              {t.reglages.copierLien}
            </Bouton>
            <Bouton
              variant="ghost"
              size="md"
              block
              icon={LogOut}
              onClick={() => {
                onClose();
                deconnecter();
              }}
            >
              {t.acces.changerVendeuse}
            </Bouton>
            {confirmerDesappairage ? (
              <Bouton
                variant="danger"
                size="md"
                block
                icon={Unlink}
                disabled={enAttente > 0}
                onClick={() => {
                  onClose();
                  void desappairer();
                }}
              >
                {t.appairage.desappairer}
              </Bouton>
            ) : (
              <Bouton variant="ghost" size="md" block icon={Unlink} onClick={() => setConfirmerDesappairage(true)}>
                {t.appairage.desappairer}
              </Bouton>
            )}
            {confirmerDesappairage && <p className="text-caption text-danger">{t.appairage.desappairerAide}</p>}
            <p className="text-center text-caption text-ink-muted">
              {t.reglages.version} {__APP_VERSION__}
            </p>
          </div>
        </Carte>
      </div>

      <EditionVendeur
        vendeur={editionVendeur === 'nouveau' ? null : editionVendeur}
        open={editionVendeur !== null}
        onClose={() => setEditionVendeur(null)}
        vendeurId={vendeurId}
      />
      <EditionTaux open={editionTaux} onClose={() => setEditionTaux(false)} vendeurId={vendeurId} />
    </Feuille>
  );
}

interface EditionVendeurProps {
  vendeur: Vendeur | null;
  open: boolean;
  onClose: () => void;
  vendeurId: string;
}

function EditionVendeur({ open, vendeur, ...rest }: EditionVendeurProps) {
  if (!open) return null;
  return <FormulaireVendeur key={vendeur?.id ?? 'nouveau'} vendeur={vendeur} {...rest} />;
}

function FormulaireVendeur({ vendeur, onClose, vendeurId }: Omit<EditionVendeurProps, 'open'>) {
  const { notifier } = useSession();
  const [prenom, setPrenom] = useState(vendeur?.prenom ?? '');
  const [tauxH, setTauxH] = useState(String(vendeur?.tauxHoraireCfp ?? TAUX_HORAIRE_DEFAUT));
  const [pin, setPin] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);

  const enregistrer = async (actif: boolean = vendeur?.actif ?? true) => {
    if (!prenom.trim()) {
      setErreur(t.commun.champRequis);
      return;
    }
    const taux = lireMontant(tauxH || '0');
    if (taux === null) {
      setErreur(t.commun.montantInvalide);
      return;
    }
    if (pin || !vendeur) {
      if (!pinValide(pin)) {
        setErreur(t.reglages.pinFormat);
        return;
      }
      if (pin !== confirmation) {
        setErreur(t.reglages.pinDifferent);
        return;
      }
    }
    const id = vendeur?.id ?? `vend_${crypto.randomUUID()}`;
    // El hash del PIN viaja en la operación (nunca el PIN); sin PIN nuevo, el servidor conserva el actual.
    const pinSalt = pin ? genererSel() : undefined;
    const pinHash = pin && pinSalt ? await hacherPin(pin, pinSalt) : undefined;
    await enregistrerVendeur(
      { vendeurId },
      { id, prenom: prenom.trim(), tauxHoraireCfp: taux, actif, pinHash, pinSalt },
    );
    notifier({ message: pin && vendeur ? t.reglages.pinModifie : t.reglages.enregistre, duree: 1500 });
    onClose();
  };

  return (
    <Feuille
      open
      onClose={onClose}
      title={vendeur ? vendeur.prenom : t.reglages.ajouterVendeuse}
      footer={
        <div className="flex gap-2">
          {vendeur && vendeur.id !== vendeurId && (
            <Bouton variant="ghost" size="lg" onClick={() => void enregistrer(!vendeur.actif)}>
              {vendeur.actif ? t.stock.desactiver : t.stock.reactiver}
            </Bouton>
          )}
          <Bouton variant="primary" size="lg" block onClick={() => void enregistrer()}>
            {t.commun.enregistrer}
          </Bouton>
        </div>
      }
    >
      <div className="flex flex-col gap-4 pt-1">
        <Champ
          label={t.reglages.prenom}
          value={prenom}
          onChange={(e) => setPrenom(e.target.value)}
          maxLength={40}
          autoComplete="off"
        />
        <Champ
          label={t.heures.tauxHoraire}
          inputMode="numeric"
          amount
          suffix="CFP"
          value={tauxH}
          onChange={(e) => setTauxH(e.target.value.replace(/[^\d]/g, ''))}
        />
        <div className="grid grid-cols-2 gap-3">
          <Champ
            label={vendeur ? t.reglages.nouveauPin : t.reglages.pin}
            type="password"
            inputMode="numeric"
            maxLength={4}
            autoComplete="off"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/[^\d]/g, ''))}
            icon={KeyRound}
          />
          <Champ
            label={t.reglages.confirmerPin}
            type="password"
            inputMode="numeric"
            maxLength={4}
            autoComplete="off"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value.replace(/[^\d]/g, ''))}
          />
        </div>
        {erreur && <p className="text-caption text-danger">{erreur}</p>}
      </div>
    </Feuille>
  );
}

function EditionTaux({ open, onClose, vendeurId }: { open: boolean; onClose: () => void; vendeurId: string }) {
  if (!open) return null;
  return <FormulaireTaux onClose={onClose} vendeurId={vendeurId} />;
}

function FormulaireTaux({ onClose, vendeurId }: { onClose: () => void; vendeurId: string }) {
  const { notifier } = useSession();
  const taux = useTauxDetail();
  // null = no editado: se muestra la tasa guardada.
  const [saisies, setValeurs] = useState<Partial<Record<Devise, string>>>({});
  const [erreur, setErreur] = useState<string | null>(null);
  const valeurs: Partial<Record<Devise, string>> = Object.fromEntries(
    DEVISES_ETRANGERES.map((d) => {
      const s = saisies[d];
      const actuel = taux.find((x) => x.devise === d);
      return [d, s ?? (actuel ? String(actuel.cfpParUnite).replace('.', ',') : '')];
    }),
  );

  const enregistrer = async () => {
    for (const d of DEVISES_ETRANGERES) {
      if (d === 'EUR') continue;
      const s = valeurs[d]?.trim();
      if (!s) continue;
      const v = Number(s.replace(/\s/g, '').replace(',', '.'));
      if (!(v > 0)) {
        setErreur(`${d} : ${t.commun.montantInvalide}`);
        return;
      }
      const actuel = taux.find((x) => x.devise === d);
      if (!actuel || actuel.cfpParUnite !== v)
        await definirTaux({ vendeurId }, d, Math.round(v * 10000) / 10000, 'manuel');
    }
    notifier({ message: t.reglages.enregistre, duree: 1500 });
    onClose();
  };

  return (
    <Feuille
      open
      onClose={onClose}
      title={t.reglages.taux}
      footer={
        <Bouton variant="primary" size="lg" block onClick={() => void enregistrer()}>
          {t.commun.enregistrer}
        </Bouton>
      }
    >
      <div className="flex flex-col gap-3 pt-1">
        {DEVISES_ETRANGERES.map((d) => (
          <Champ
            key={d}
            label={`1 ${d} =`}
            suffix="CFP"
            inputMode="decimal"
            amount
            value={valeurs[d] ?? ''}
            onChange={(e) => setValeurs((v) => ({ ...v, [d]: e.target.value }))}
            disabled={d === 'EUR'}
            help={d === 'EUR' ? t.reglages.tauxAide : undefined}
          />
        ))}
        {erreur && <p className="text-caption text-danger">{erreur}</p>}
      </div>
    </Feuille>
  );
}
