import { Banknote, CreditCard, HandCoins, ShoppingBasket } from 'lucide-react';
import type { ReactNode } from 'react';

import { etatStock } from '../../../shared/domaine/stock';
import { decimalesDevise, formatNumber, type Devise, type ModePaiement } from '../../../shared/montants';
import { t } from '../../textes/fr';
import { Montant } from './Affichage';
import { Compteur } from './Saisie';

export interface TuileArticleProps {
  emoji?: string | null;
  nom: string;
  prixCfp: number;
  qty: number;
  dansPanier?: number;
  promo?: string | null;
  onClick: () => void;
}

/** Ficha de la cuadrícula de la caja: un toque = una unidad. */
export function TuileArticle({ emoji, nom, prixCfp, qty, dansPanier = 0, promo, onClick }: TuileArticleProps) {
  const etat = etatStock(qty);
  const epuise = etat === 'epuise';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={epuise}
      aria-label={`${nom}, ${formatNumber(prixCfp)} CFP${epuise ? `, ${t.stock.epuise}` : ''}${dansPanier ? `, ${dansPanier} au panier` : ''}`}
      className={`relative flex min-h-28 flex-col justify-between rounded-lg border p-2.5 text-left transition-colors active:bg-violet-soft disabled:opacity-50 ${
        dansPanier ? 'border-violet bg-violet-soft' : 'border-line bg-surface'
      }`}
    >
      <div className="flex items-start justify-between gap-1">
        <span aria-hidden className="text-[28px] leading-8">
          {emoji ?? '•'}
        </span>
        {dansPanier > 0 && (
          <span className="grid h-6 min-w-6 place-items-center rounded-full bg-violet px-1.5 text-caption font-bold text-on-violet">
            {dansPanier}
          </span>
        )}
        {!dansPanier && etat === 'faible' && (
          <span className="rounded-full bg-warning-soft px-1.5 text-overline font-semibold text-warning">{qty}</span>
        )}
        {!dansPanier && epuise && (
          <span className="rounded-full bg-danger-soft px-1.5 text-overline font-semibold text-danger">
            {t.stock.epuise}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="line-clamp-2 text-caption leading-4 font-semibold">{nom}</span>
        <span className="text-amount-md font-bold tabular-nums">
          {formatNumber(prixCfp)}
          <span className="ml-1 text-overline font-semibold text-ink-muted">CFP</span>
        </span>
        {promo && (
          <span className="w-fit rounded-xs bg-gold-soft px-1 text-overline font-semibold text-gold-edge">{promo}</span>
        )}
      </div>
    </button>
  );
}

export function LignePanier({
  emoji,
  nom,
  prixUnitCfp,
  qty,
  totalCfp,
  promoNote,
  max,
  onInc,
  onDec,
}: {
  emoji?: string | null;
  nom: string;
  prixUnitCfp: number;
  qty: number;
  totalCfp: number;
  promoNote?: string | null;
  max?: number;
  onInc: () => void;
  onDec: () => void;
}) {
  return (
    <div className="flex items-center gap-3 py-2">
      <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-md bg-surface-sunk text-xl">
        {emoji ?? '•'}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="truncate text-body font-semibold">{nom}</p>
        <p className="text-caption text-ink-muted tabular-nums">
          {formatNumber(prixUnitCfp)} CFP{promoNote ? ` · ${promoNote}` : ''}
        </p>
      </div>
      <Compteur value={qty} onInc={onInc} onDec={onDec} max={max} label={nom} removable />
      <Montant value={totalCfp} size="md" className="w-24 justify-end" />
    </div>
  );
}

/** Barra de caja siempre visible (sobre `night`): total y acción principal. */
export function BarreCaisse({
  count,
  totalCfp,
  onOpen,
  onCharge,
}: {
  count: number;
  totalCfp: number;
  onOpen: () => void;
  onCharge: () => void;
}) {
  return (
    <div className="sticky bottom-0 z-10 flex h-16 items-center gap-2 bg-night px-3 text-on-night shadow-sheet">
      <button
        type="button"
        onClick={onOpen}
        disabled={count === 0}
        className="flex h-12 min-w-0 flex-1 items-center gap-3 rounded-md px-2 text-left active:bg-night-raised disabled:opacity-70"
        aria-label={count ? `${t.caisse.voirPanier} · ${t.caisse.articles(count)}` : t.caisse.panierVide}
      >
        <span className="relative grid size-10 place-items-center rounded-md bg-night-raised">
          <ShoppingBasket aria-hidden className="size-5" strokeWidth={2} />
          {count > 0 && (
            <span className="absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-gold px-1 text-overline font-bold text-on-gold">
              {count}
            </span>
          )}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-overline font-semibold text-on-night-muted uppercase">
            {count ? t.caisse.articles(count) : t.caisse.panierVide}
          </span>
          <Montant value={totalCfp} size="lg" tone="night" />
        </span>
      </button>
      <button
        type="button"
        onClick={onCharge}
        disabled={count === 0 || totalCfp <= 0}
        className="h-12 rounded-md bg-gold px-5 text-body font-bold text-on-gold disabled:opacity-40"
      >
        {t.caisse.encaisser}
      </button>
    </div>
  );
}

export function BoutonDevise({
  code,
  montant,
  selected = false,
  onClick,
  sansTaux = false,
}: {
  code: ModePaiement;
  montant: number | null;
  selected?: boolean;
  onClick: () => void;
  sansTaux?: boolean;
}) {
  const carte = code === 'TPE';
  const Icon = carte ? CreditCard : Banknote;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={`${carte ? t.cobro.carte : code}${montant !== null ? ` · ${formatNumber(montant, code)} ${carte ? 'CFP' : code}` : ''}${sansTaux ? ` · ${t.cobro.sansTaux}` : ''}`}
      disabled={sansTaux}
      className={`flex h-tap-lg items-center gap-2 rounded-md border px-3 text-left transition-colors disabled:opacity-40 ${selected ? 'border-violet bg-violet-soft text-violet' : 'border-line bg-surface text-ink'}`}
    >
      <Icon aria-hidden className="size-5 shrink-0" strokeWidth={2} />
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="text-caption font-semibold">{carte ? t.cobro.carte : code}</span>
        {montant !== null && (
          <span className="truncate text-body font-bold tabular-nums">
            {formatNumber(montant, code)}{' '}
            <span className="text-overline font-semibold opacity-70">{carte ? 'CFP' : code}</span>
          </span>
        )}
      </span>
    </button>
  );
}

export function BoutonBillet({
  montant,
  devise,
  label,
  selected = false,
  onClick,
}: {
  montant?: number;
  devise: Devise;
  label?: string;
  selected?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`h-tap-lg flex-1 rounded-md border text-body font-bold tabular-nums transition-colors ${selected ? 'border-violet bg-violet-soft text-violet' : 'border-line-strong bg-surface text-ink'}`}
    >
      {label ?? (montant !== undefined ? `${formatNumber(montant, devise)} ${devise}` : '')}
    </button>
  );
}

export function MonnaieARendre({
  kind,
  montant,
  devise,
  equivalentCfp,
  label,
}: {
  kind: 'rendre' | 'manque' | 'juste';
  montant: number;
  devise: Devise | ModePaiement;
  equivalentCfp?: number | null;
  label?: ReactNode;
}) {
  const couleur =
    kind === 'rendre'
      ? 'bg-success-soft text-success'
      : kind === 'manque'
        ? 'bg-warning-soft text-warning'
        : 'bg-surface-sunk text-ink-muted';
  const titre =
    label ?? (kind === 'rendre' ? t.cobro.aRendre : kind === 'manque' ? t.cobro.manque : t.cobro.rienARendre);
  return (
    <div className={`flex items-center gap-3 rounded-lg px-4 py-3 ${couleur}`} role="status">
      <HandCoins aria-hidden className="size-7 shrink-0" strokeWidth={2} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-overline font-semibold tracking-wide uppercase">{titre}</span>
        {kind !== 'juste' && (
          <span className="text-amount-xl font-bold tabular-nums">
            {formatNumber(montant, devise)}{' '}
            <span className="text-heading font-semibold">{devise === 'TPE' ? 'CFP' : devise}</span>
          </span>
        )}
        {kind !== 'juste' && equivalentCfp !== undefined && equivalentCfp !== null && devise !== 'CFP' && (
          <span className="text-caption tabular-nums opacity-80">≈ {formatNumber(equivalentCfp)} CFP</span>
        )}
      </div>
    </div>
  );
}

export function LigneComptage({
  devise,
  attendu,
  compte,
  onChange,
}: {
  devise: Devise;
  attendu: number;
  compte: string;
  onChange: (v: string) => void;
}) {
  const valeur = compte.trim() === '' ? null : Number(compte.replace(',', '.'));
  const ecart = valeur === null || Number.isNaN(valeur) ? null : Math.round((valeur - attendu) * 100) / 100;
  const id = `compte-${devise}`;
  return (
    <div className="grid grid-cols-[3.5rem_minmax(0,1fr)_minmax(0,1fr)_5rem] items-center gap-2 py-2">
      <span className="text-body font-bold">{devise}</span>
      <Montant value={attendu} devise={devise} size="md" tone="muted" />
      <label htmlFor={id} className="sr-only">
        {t.cloture.compte} {devise}
      </label>
      <input
        id={id}
        inputMode={decimalesDevise(devise) ? 'decimal' : 'numeric'}
        value={compte}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t.cloture.compte}
        className="h-tap-min w-full min-w-0 rounded-md border border-line-strong bg-surface px-3 text-right text-body font-semibold tabular-nums outline-none focus-visible:shadow-[var(--focus-ring)]"
      />
      <span
        className={`text-right text-caption font-semibold tabular-nums ${ecart === null ? 'text-ink-muted' : ecart === 0 ? 'text-success' : ecart < 0 ? 'text-danger' : 'text-warning'}`}
      >
        {ecart === null ? '—' : ecart === 0 ? t.cloture.juste : `${ecart > 0 ? '+' : ''}${formatNumber(ecart, devise)}`}
      </span>
    </div>
  );
}
