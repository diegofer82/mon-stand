// Stock: nivel visual por artículo, modo consulta / ajuste separado de la venta, ficha de artículo con precios en divisa.
import { Eye, Package, PackagePlus, Plus, SlidersHorizontal } from 'lucide-react';
import { useMemo, useState } from 'react';

import { prixVenteDevise } from '../../shared/domaine/panier';
import type { Article } from '../../shared/domaine/types';
import { formatNumber, lireMontant, type Devise } from '../../shared/montants';
import { DEVISES_ETRANGERES } from '../../shared/taux';
import { Badge, BadgeStock } from '../composants/ui/Affichage';
import { Bouton } from '../composants/ui/Bouton';
import { Champ, Compteur, Segments } from '../composants/ui/Saisie';
import { EtatVide, Feuille, LigneListe } from '../composants/ui/Structure';
import { enregistrerArticle, mouvementStock } from '../db/actions';
import { useArticles, useCategories, useQuantites, useTaux } from '../db/hooks';
import { useSession } from '../etat/session';
import { t } from '../textes/fr';

export function Stock({ vendeurId }: { vendeurId: string }) {
  const { notifier } = useSession();
  const categories = useCategories();
  const articles = useArticles();
  const quantite = useQuantites();
  const [mode, setMode] = useState<'vente' | 'edition'>('vente');
  const [fiche, setFiche] = useState<Article | 'nouveau' | null>(null);

  const parCategorie = useMemo(() => {
    const collator = new Intl.Collator('fr');
    return categories.map((c) => ({
      categorie: c,
      articles: articles
        .filter((a) => a.categorieId === c.id)
        .sort((a, b) => Number(!a.actif) - Number(!b.actif) || collator.compare(a.nom, b.nom)),
    }));
  }, [categories, articles]);

  const ajuster = async (a: Article, delta: number) => {
    await mouvementStock({ vendeurId }, a.id, delta, delta > 0 ? 'reassort' : 'ajustement');
    notifier({ message: `${a.nom} : ${t.stock.mouvementEnregistre(delta)}`, duree: 1200 });
  };

  const epuises = articles.filter((a) => a.actif && (quantite.get(a.id) ?? 0) <= 0).length;
  const faibles = articles.filter(
    (a) => a.actif && (quantite.get(a.id) ?? 0) > 0 && (quantite.get(a.id) ?? 0) <= 2,
  ).length;

  return (
    <div className="flex flex-1 flex-col gap-3 px-4 pb-24">
      <div className="flex items-center gap-2">
        <Segments
          label={t.stock.titre}
          className="flex-1"
          value={mode}
          onChange={(m) => setMode(m as 'vente' | 'edition')}
          options={[
            { id: 'vente', label: t.stock.modeVente, icon: Eye },
            { id: 'edition', label: t.stock.modeEdition, icon: SlidersHorizontal },
          ]}
        />
      </div>
      {(epuises > 0 || faibles > 0) && (
        <div className="flex gap-2">
          {epuises > 0 && <Badge tone="danger">{t.stock.epuises(epuises)}</Badge>}
          {faibles > 0 && <Badge tone="warning">{t.stock.faibles(faibles)}</Badge>}
        </div>
      )}
      {parCategorie.map(({ categorie, articles: liste }) =>
        liste.length === 0 ? null : (
          <section key={categorie.id} className="flex flex-col rounded-lg border border-line bg-surface px-3 py-2">
            <h2 className="flex items-center gap-2 py-1 text-overline font-semibold tracking-wide text-ink-muted uppercase">
              <span aria-hidden>{categorie.emoji}</span>
              {categorie.nom}
            </h2>
            <div className="flex flex-col divide-y divide-line">
              {liste.map((a) => {
                const q = quantite.get(a.id) ?? 0;
                return (
                  <LigneListe
                    key={a.id}
                    emoji={a.emoji}
                    title={
                      <span className={a.actif ? '' : 'text-ink-muted line-through'}>
                        {a.nom}
                        {!a.actif && <span className="ml-2 text-caption no-underline">({t.stock.inactif})</span>}
                      </span>
                    }
                    subtitle={
                      a.prixCfp > 0
                        ? `${formatNumber(a.prixCfp)} CFP${a.promo2emePct ? ` · ${t.caisse.promoTag(a.promo2emePct)}` : ''}`
                        : t.stock.prixAFixer
                    }
                    onClick={mode === 'vente' ? () => setFiche(a) : undefined}
                    chevron={mode === 'vente'}
                  >
                    {mode === 'edition' ? (
                      <Compteur
                        value={q}
                        min={0}
                        onInc={() => void ajuster(a, 1)}
                        onDec={() => void ajuster(a, -1)}
                        label={a.nom}
                      />
                    ) : (
                      <BadgeStock qty={q} />
                    )}
                  </LigneListe>
                );
              })}
            </div>
          </section>
        ),
      )}
      {articles.length === 0 && <EtatVide icon={Package} title={t.stock.titre} />}

      <Bouton
        variant="primary"
        size="lg"
        icon={Plus}
        className="fixed right-4 bottom-[calc(var(--spacing-tap-lg)+env(safe-area-inset-bottom)+12px)] z-10 shadow-float"
        onClick={() => setFiche('nouveau')}
      >
        {t.stock.nouvelArticle}
      </Bouton>

      <FicheArticle
        article={fiche === 'nouveau' ? null : fiche}
        open={fiche !== null}
        onClose={() => setFiche(null)}
        vendeurId={vendeurId}
        quantite={fiche && fiche !== 'nouveau' ? (quantite.get(fiche.id) ?? 0) : 0}
      />
    </div>
  );
}

interface FicheProps {
  article: Article | null;
  open: boolean;
  onClose: () => void;
  vendeurId: string;
  quantite: number;
}

/** La ficha se monta al abrirse (y se remonta por artículo): el formulario nace con los valores del artículo. */
export function FicheArticle({ open, article, ...rest }: FicheProps) {
  if (!open) return null;
  return <FormulaireArticle key={article?.id ?? 'nouveau'} article={article} {...rest} />;
}

function FormulaireArticle({ article, onClose, vendeurId, quantite }: Omit<FicheProps, 'open'>) {
  const { notifier } = useSession();
  const categories = useCategories();
  const taux = useTaux();
  const [nom, setNom] = useState(article?.nom ?? '');
  const [categorieChoisie, setCategorieId] = useState(article?.categorieId ?? '');
  const categorieId = categorieChoisie || (categories[0]?.id ?? '');
  const [emoji, setEmoji] = useState(article?.emoji ?? '');
  const [prix, setPrix] = useState(article?.prixCfp ? String(article.prixCfp) : '');
  const [promo, setPromo] = useState(article?.promo2emePct ? String(article.promo2emePct) : '');
  const [prixDevises, setPrixDevises] = useState<Partial<Record<Devise, string>>>(() =>
    article
      ? Object.fromEntries(Object.entries(article.prixDevises).map(([d, v]) => [d, String(v).replace('.', ',')]))
      : {},
  );
  const [stockInitial, setStockInitial] = useState('');
  const [ajustement, setAjustement] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);

  const prixCfp = lireMontant(prix || '0') ?? -1;

  const enregistrer = async (actif: boolean = article?.actif ?? true) => {
    if (!nom.trim() || !categorieId) {
      setErreur(t.commun.champRequis);
      return;
    }
    if (prixCfp < 0) {
      setErreur(t.commun.montantInvalide);
      return;
    }
    const devises: Partial<Record<Devise, number>> = {};
    for (const d of DEVISES_ETRANGERES) {
      const s = prixDevises[d]?.trim();
      if (!s) continue;
      const v = lireMontant(s, d);
      if (v === null) {
        setErreur(`${t.stock.prixDevises} ${d} : ${t.commun.montantInvalide}`);
        return;
      }
      if (v > 0) devises[d] = v;
    }
    const promoPct = promo.trim() ? Number(promo) : null;
    await enregistrerArticle(
      { vendeurId },
      {
        id: article?.id,
        nom,
        categorieId,
        emoji: emoji || null,
        prixCfp,
        promo2emePct: promoPct && promoPct > 0 && promoPct < 100 ? promoPct : null,
        prixDevises: devises,
        actif,
      },
      article ? null : (lireMontant(stockInitial || '0') ?? 0),
    );
    const delta = article && ajustement.trim() ? Number(ajustement) : 0;
    if (article && Number.isInteger(delta) && delta !== 0)
      await mouvementStock({ vendeurId }, article.id, delta, delta > 0 ? 'reassort' : 'ajustement');
    notifier({ message: t.stock.enregistre, duree: 1500 });
    onClose();
  };

  return (
    <Feuille
      open
      onClose={onClose}
      title={article ? t.stock.ficheArticle : t.stock.nouvelArticle}
      footer={
        <div className="flex gap-2">
          {article && (
            <Bouton
              variant={article.actif ? 'ghost' : 'secondary'}
              size="lg"
              onClick={() => void enregistrer(!article.actif)}
            >
              {article.actif ? t.stock.desactiver : t.stock.reactiver}
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
          label={t.stock.nom}
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          autoComplete="off"
          error={erreur === t.commun.champRequis && !nom.trim() ? erreur : null}
        />
        <div className="grid grid-cols-[1fr_5rem] gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="fiche-categorie" className="text-caption font-semibold text-ink-muted">
              {t.stock.categorie}
            </label>
            <select
              id="fiche-categorie"
              value={categorieId}
              onChange={(e) => setCategorieId(e.target.value)}
              className="h-tap-min rounded-md border border-line-strong bg-surface px-3 text-body text-ink"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji ? `${c.emoji} ` : ''}
                  {c.nom}
                </option>
              ))}
            </select>
          </div>
          <Champ
            label={t.stock.emoji}
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            maxLength={4}
            className="text-center"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Champ
            label={t.stock.prixCfp}
            inputMode="numeric"
            amount
            suffix="CFP"
            value={prix}
            onChange={(e) => setPrix(e.target.value.replace(/[^\d]/g, ''))}
            error={erreur === t.commun.montantInvalide ? erreur : null}
          />
          <Champ
            label={t.stock.promo2eme}
            inputMode="numeric"
            amount
            suffix="%"
            value={promo}
            onChange={(e) => setPromo(e.target.value.replace(/[^\d]/g, ''))}
            help={t.stock.promoAide}
          />
        </div>
        <section className="flex flex-col gap-2">
          <p className="text-caption font-semibold text-ink-muted">{t.stock.prixDevises}</p>
          <div className="grid grid-cols-2 gap-3">
            {DEVISES_ETRANGERES.map((d) => {
              const calcule = prixCfp > 0 ? prixVenteDevise({ prixCfp, prixDevises: {} }, d, taux) : 0;
              const manuel = !!prixDevises[d]?.trim();
              return (
                <Champ
                  key={d}
                  label={d}
                  inputMode="decimal"
                  amount
                  suffix={manuel ? t.stock.manuel : t.stock.calcule}
                  placeholder={calcule ? formatNumber(calcule, d) : '—'}
                  value={prixDevises[d] ?? ''}
                  onChange={(e) => setPrixDevises((p) => ({ ...p, [d]: e.target.value }))}
                />
              );
            })}
          </div>
          <p className="text-caption text-ink-muted">{t.stock.prixDevisesAide}</p>
          {erreur?.startsWith(t.stock.prixDevises) && <p className="text-caption text-danger">{erreur}</p>}
        </section>
        {article ? (
          <Champ
            label={`${t.stock.quantite} : ${quantite}`}
            inputMode="numeric"
            amount
            value={ajustement}
            onChange={(e) => setAjustement(e.target.value.replace(/[^-\d]/g, ''))}
            placeholder="+5 ou −2"
            help={`${t.stock.reassort} (+) ou ${t.stock.ajustement.toLowerCase()} (−), tracé comme un mouvement.`}
            icon={PackagePlus}
          />
        ) : (
          <Champ
            label={t.stock.quantite}
            inputMode="numeric"
            amount
            value={stockInitial}
            onChange={(e) => setStockInitial(e.target.value.replace(/[^\d]/g, ''))}
            icon={PackagePlus}
          />
        )}
      </div>
    </Feuille>
  );
}
