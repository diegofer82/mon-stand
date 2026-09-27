// Caja: chips de categoría, cuadrícula de artículos (un toque = una unidad), carrito en bottom sheet,
// barra de caja con el total y paso al cobro. Sin jornada abierta, propone abrirla.
import { CalendarPlus, Search, ShoppingBasket, Tag, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { FONDS_DEFAUT, LIEU_DEFAUT } from '../../shared/domaine/catalogue';
import type { ResultatPaiement } from '../../shared/domaine/encaissement';
import { totalLigneCfp, totauxPanier, unitesEnPromo } from '../../shared/domaine/panier';
import { ordreCaisse } from '../../shared/domaine/stock';
import type { Journee, LignePanier } from '../../shared/domaine/types';
import { formatNumber, lireMontant } from '../../shared/montants';
import { Montant } from '../composants/ui/Affichage';
import { Bouton } from '../composants/ui/Bouton';
import { BarreCaisse, LignePanier as LignePanierUI, TuileArticle } from '../composants/ui/CaisseUI';
import { Champ, Puce } from '../composants/ui/Saisie';
import { EtatVide, Feuille } from '../composants/ui/Structure';
import { annulerVente, enregistrerVente, ouvrirJournee } from '../db/actions';
import { useArticles, useCategories, useQuantites, useSetting, useVendues30j } from '../db/hooks';
import { useSession } from '../etat/session';
import { t } from '../textes/fr';
import { Encaisser } from './Encaisser';

const DUREE_ANNULATION_MS = 10_000;

export function Caisse({ vendeurId, journee }: { vendeurId: string; journee: Journee | null }) {
  const { notifier } = useSession();
  const categories = useCategories();
  const articles = useArticles();
  const quantite = useQuantites();
  const vendues = useVendues30j(journee?.id ?? null);
  const articlesMap = useMemo(() => new Map(articles.map((a) => [a.id, a])), [articles]);

  const [categorie, setCategorie] = useState<string>('tout');
  const [recherche, setRecherche] = useState('');
  const [rechercheOuverte, setRechercheOuverte] = useState(false);
  const [lignes, setLignes] = useState<LignePanier[]>([]);
  const [remise, setRemise] = useState('');
  const [panierOuvert, setPanierOuvert] = useState(false);
  const [cobro, setCobro] = useState(false);
  const [ouvrir, setOuvrir] = useState(false);

  const remiseCfp = lireMontant(remise || '0') ?? 0;
  const totaux = useMemo(() => totauxPanier(lignes, articlesMap, remiseCfp), [lignes, articlesMap, remiseCfp]);
  const dansPanier = useMemo(() => new Map(lignes.map((l) => [l.articleId, l.qty])), [lignes]);

  const visibles = useMemo(() => {
    const ordonnes = ordreCaisse(articles, quantite, vendues);
    const q = recherche.trim().toLocaleLowerCase('fr');
    if (q) return ordonnes.filter((a) => a.nom.toLocaleLowerCase('fr').includes(q));
    if (categorie === 'tout') return ordonnes;
    // Las categorías conservan el orden del stock (nombre).
    return articles
      .filter((a) => a.actif && a.prixCfp > 0 && a.categorieId === categorie)
      .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  }, [articles, quantite, vendues, recherche, categorie]);

  const ajouter = (articleId: string) => {
    const dispo = quantite.get(articleId) ?? 0;
    const actuel = dansPanier.get(articleId) ?? 0;
    if (dispo <= 0) {
      notifier({ message: t.caisse.stockEpuise, tone: 'danger', duree: 1500 });
      return;
    }
    if (actuel >= dispo) {
      notifier({ message: t.caisse.stockInsuffisant, tone: 'danger', duree: 1500 });
      return;
    }
    setLignes((ls) =>
      actuel
        ? ls.map((l) => (l.articleId === articleId ? { ...l, qty: l.qty + 1 } : l))
        : [...ls, { articleId, qty: 1 }],
    );
  };

  const changer = (articleId: string, delta: number) => {
    setLignes((ls) =>
      ls
        .map((l) =>
          l.articleId === articleId ? { ...l, qty: Math.min(l.qty + delta, quantite.get(articleId) ?? 999) } : l,
        )
        .filter((l) => l.qty > 0),
    );
  };

  const vider = () => {
    setLignes([]);
    setRemise('');
  };

  const valider = async (paiements: ResultatPaiement[]) => {
    if (!journee) return;
    const vente = await enregistrerVente(
      { vendeurId },
      journee.id,
      lignes,
      remiseCfp,
      paiements.map((r) => ({ devise: r.devise, resultat: r })),
    );
    vider();
    setCobro(false);
    const encaisse = vente.paiements.reduce((s, p) => s + p.montantCfp, 0);
    notifier({
      message: `${t.cobro.venteEnregistree} — ${formatNumber(encaisse)} CFP`,
      detail: vente.paiements
        .map((p) => `${formatNumber(p.montantDevise, p.devise)} ${p.devise === 'TPE' ? 'CFP (carte)' : p.devise}`)
        .join(' + '),
      tone: 'success',
      duree: DUREE_ANNULATION_MS,
      actionLabel: t.cobro.annulerVente,
      onAction: () => {
        void annulerVente({ vendeurId }, vente.id).then(() => notifier({ message: t.cobro.venteAnnulee, duree: 2000 }));
      },
    });
  };

  if (!journee) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4">
        <EtatVide icon={CalendarPlus} title={t.journee.aucuneOuverte}>
          {t.journee.aucuneOuverteAide}
        </EtatVide>
        <Bouton variant="primary" size="xl" icon={CalendarPlus} onClick={() => setOuvrir(true)}>
          {t.journee.ouvrir}
        </Bouton>
        <OuvrirJournee open={ouvrir} onClose={() => setOuvrir(false)} vendeurId={vendeurId} />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex gap-2 overflow-x-auto px-4 py-2 [scrollbar-width:none]">
        <Puce
          icon={Search}
          selected={rechercheOuverte}
          aria-label={t.caisse.rechercherArticle}
          onClick={() => {
            setRechercheOuverte((o) => !o);
            setRecherche('');
          }}
        />
        <Puce
          selected={categorie === 'tout' && !recherche}
          onClick={() => {
            setCategorie('tout');
            setRecherche('');
          }}
        >
          {t.caisse.tout}
        </Puce>
        {categories.map((c) => (
          <Puce
            key={c.id}
            emoji={c.emoji}
            selected={categorie === c.id && !recherche}
            onClick={() => {
              setCategorie(c.id);
              setRecherche('');
            }}
          >
            {c.nom}
          </Puce>
        ))}
      </div>
      {rechercheOuverte && (
        <div className="px-4 pb-2">
          <Champ
            label={t.caisse.rechercherArticle}
            variant="sunk"
            icon={Search}
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            autoFocus
            placeholder={t.commun.rechercher}
            enterKeyHint="search"
          />
        </div>
      )}
      <div className="grid flex-1 grid-cols-3 gap-2 px-4 pb-4 content-start sm:grid-cols-4 lg:grid-cols-6">
        {visibles.map((a) => (
          <TuileArticle
            key={a.id}
            emoji={a.emoji}
            nom={a.nom}
            prixCfp={a.prixCfp}
            qty={quantite.get(a.id) ?? 0}
            dansPanier={dansPanier.get(a.id) ?? 0}
            promo={a.promo2emePct ? t.caisse.promoTag(a.promo2emePct) : null}
            onClick={() => ajouter(a.id)}
          />
        ))}
        {visibles.length === 0 && (
          <p className="col-span-full py-8 text-center text-body text-ink-muted">{t.commun.aucunResultat}</p>
        )}
      </div>

      <BarreCaisse
        count={totaux.nbArticles}
        totalCfp={totaux.totalCfp}
        onOpen={() => setPanierOuvert(true)}
        onCharge={() => setCobro(true)}
      />

      <Feuille
        open={panierOuvert && lignes.length > 0}
        onClose={() => setPanierOuvert(false)}
        title={t.caisse.panier}
        headerAction={
          <Bouton variant="ghost" size="sm" icon={Trash2} onClick={vider}>
            {t.caisse.viderPanier}
          </Bouton>
        }
        footer={
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1 text-body">
              <div className="flex justify-between text-ink-muted">
                <span>{t.commun.sousTotal}</span>
                <Montant value={totaux.sousTotalCfp} size="md" tone="muted" />
              </div>
              {totaux.remisePanierCfp > 0 && (
                <div className="flex justify-between text-success">
                  <span>{t.commun.remise}</span>
                  <Montant value={-totaux.remisePanierCfp} size="md" tone="success" />
                </div>
              )}
              <div className="flex items-baseline justify-between font-bold">
                <span>{t.commun.total}</span>
                <Montant value={totaux.totalCfp} size="lg" />
              </div>
            </div>
            <Bouton
              variant="primary"
              size="xl"
              block
              disabled={totaux.totalCfp <= 0}
              onClick={() => {
                setPanierOuvert(false);
                setCobro(true);
              }}
            >
              {t.caisse.encaisser}
            </Bouton>
          </div>
        }
      >
        {lignes.length === 0 ? (
          <EtatVide icon={ShoppingBasket} title={t.caisse.panierVide}>
            {t.caisse.panierVideAide}
          </EtatVide>
        ) : (
          <div className="flex flex-col divide-y divide-line">
            {lignes.map((l) => {
              const a = articlesMap.get(l.articleId);
              if (!a) return null;
              const promoN = unitesEnPromo(a.promo2emePct, l.qty);
              return (
                <LignePanierUI
                  key={l.articleId}
                  emoji={a.emoji}
                  nom={a.nom}
                  prixUnitCfp={a.prixCfp}
                  qty={l.qty}
                  totalCfp={totalLigneCfp(a.prixCfp, a.promo2emePct, l.qty)}
                  promoNote={promoN > 0 && a.promo2emePct ? t.caisse.promo(a.promo2emePct, promoN) : null}
                  max={quantite.get(a.id) ?? 0}
                  onInc={() => changer(a.id, 1)}
                  onDec={() => changer(a.id, -1)}
                />
              );
            })}
            <div className="pt-3">
              <Champ
                label={t.caisse.remisePanier}
                icon={Tag}
                inputMode="numeric"
                amount
                suffix="CFP"
                value={remise}
                onChange={(e) => setRemise(e.target.value.replace(/[^\d]/g, ''))}
                help={t.caisse.remiseAide}
                placeholder="0"
              />
            </div>
          </div>
        )}
      </Feuille>

      <Encaisser
        open={cobro}
        lignes={lignes}
        articles={articlesMap}
        remisePanierCfp={remiseCfp}
        onClose={() => setCobro(false)}
        onValider={valider}
      />
    </div>
  );
}

export function OuvrirJournee({ open, onClose, vendeurId }: { open: boolean; onClose: () => void; vendeurId: string }) {
  const lieuDefaut = useSetting('lieuDefaut');
  const [lieuSaisi, setLieuSaisi] = useState<string | null>(null);
  const lieu = lieuSaisi ?? lieuDefaut ?? LIEU_DEFAUT;
  const [fondCfp, setFondCfp] = useState(String(FONDS_DEFAUT.CFP));
  const [fondAud, setFondAud] = useState(String(FONDS_DEFAUT.AUD));
  const [erreur, setErreur] = useState<string | null>(null);

  const valider = async () => {
    if (!lieu.trim()) {
      setErreur(t.commun.champRequis);
      return;
    }
    const cfp = lireMontant(fondCfp || '0', 'CFP');
    const aud = lireMontant(fondAud || '0', 'AUD');
    if (cfp === null || aud === null) {
      setErreur(t.commun.montantInvalide);
      return;
    }
    const fonds: Record<string, number> = {};
    if (cfp > 0) fonds.CFP = cfp;
    if (aud > 0) fonds.AUD = aud;
    await ouvrirJournee({ vendeurId }, lieu, fonds);
    onClose();
  };

  return (
    <Feuille
      open={open}
      onClose={onClose}
      title={t.journee.titreOuvrir}
      footer={
        <Bouton variant="primary" size="xl" block onClick={() => void valider()}>
          {t.journee.ouvrir}
        </Bouton>
      }
    >
      <div className="flex flex-col gap-4 pt-1">
        <Champ
          label={t.journee.lieu}
          value={lieu}
          onChange={(e) => {
            setLieuSaisi(e.target.value);
            setErreur(null);
          }}
          error={erreur && !lieu.trim() ? erreur : null}
          autoComplete="off"
        />
        <div className="flex flex-col gap-2">
          <p className="text-caption font-semibold text-ink-muted">{t.journee.fonds}</p>
          <div className="grid grid-cols-2 gap-3">
            <Champ
              label="CFP"
              inputMode="numeric"
              amount
              suffix="CFP"
              value={fondCfp}
              onChange={(e) => setFondCfp(e.target.value)}
            />
            <Champ
              label="AUD"
              inputMode="decimal"
              amount
              suffix="AUD"
              value={fondAud}
              onChange={(e) => setFondAud(e.target.value)}
            />
          </div>
          <p className="text-caption text-ink-muted">{t.journee.fondsAide}</p>
          {erreur && erreur === t.commun.montantInvalide && <p className="text-caption text-danger">{erreur}</p>}
        </div>
      </div>
    </Feuille>
  );
}
