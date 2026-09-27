import { ChevronLeft, ChevronRight, Cloud, CloudOff, type LucideIcon, RefreshCw, TriangleAlert, X } from 'lucide-react';
import { type ReactNode, useEffect, useRef } from 'react';

import { t } from '../../textes/fr';
import { Montant } from './Affichage';

export function BarreApp({
  title,
  subtitle,
  back = false,
  onBack,
  children,
  tone = 'default',
  className = '',
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  back?: boolean;
  onBack?: () => void;
  children?: ReactNode;
  tone?: 'default' | 'night';
  className?: string;
}) {
  return (
    <header
      className={`sticky top-0 z-20 flex min-h-14 items-center gap-2 px-2 pt-[env(safe-area-inset-top)] ${tone === 'night' ? 'bg-night text-on-night' : 'bg-ground/95 text-ink backdrop-blur'} ${className}`}
    >
      {back && (
        <button
          type="button"
          onClick={onBack}
          aria-label={t.commun.retour}
          className="grid size-tap-min place-items-center rounded-md"
        >
          <ChevronLeft aria-hidden className="size-6" strokeWidth={2} />
        </button>
      )}
      <div className={`flex min-w-0 flex-1 flex-col ${back ? '' : 'pl-2'}`}>
        <h1 className="truncate font-display text-title font-semibold tracking-tight">{title}</h1>
        {subtitle && (
          <p className={`truncate text-caption ${tone === 'night' ? 'text-on-night-muted' : 'text-ink-muted'}`}>
            {subtitle}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1 pr-1">{children}</div>
    </header>
  );
}

export interface Onglet {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

export function BarreOnglets({
  items,
  active,
  onSelect,
}: {
  items: Onglet[];
  active: string;
  onSelect: (id: string) => void;
}) {
  return (
    <nav
      aria-label="Navigation"
      className="sticky bottom-0 z-20 grid border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]"
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((it) => {
        const actif = it.id === active;
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => onSelect(it.id)}
            aria-current={actif ? 'page' : undefined}
            className={`relative flex h-tap-lg flex-col items-center justify-center gap-0.5 text-overline font-semibold ${actif ? 'text-violet' : 'text-ink-muted'}`}
          >
            <span className={`relative grid h-7 w-14 place-items-center rounded-full ${actif ? 'bg-violet-soft' : ''}`}>
              <it.icon aria-hidden className="size-5" strokeWidth={actif ? 2.5 : 2} />
              {it.badge ? (
                <span className="absolute -top-1 right-1 grid h-4 min-w-4 place-items-center rounded-full bg-gold px-1 text-[10px] font-bold text-on-gold">
                  {it.badge}
                </span>
              ) : null}
            </span>
            {it.label}
          </button>
        );
      })}
    </nav>
  );
}

export interface FeuilleProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  headerAction?: ReactNode;
  /** Ocupa toda la altura (pantallas como el cobro). */
  full?: boolean;
  className?: string;
}

/** Bottom sheet accesible sobre <dialog>: foco atrapado, Escape cierra, scrim toca-para-cerrar. */
export function Feuille({
  open,
  onClose,
  title,
  children,
  footer,
  headerAction,
  full = false,
  className = '',
}: FeuilleProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={`m-0 mt-auto w-full max-w-none bg-transparent p-0 backdrop:bg-scrim sm:mx-auto sm:max-w-md ${full ? 'h-dvh max-h-dvh' : 'max-h-[92dvh]'}`}
    >
      {open && (
        <div
          className={`flex ${full ? 'h-dvh' : 'max-h-[92dvh]'} flex-col rounded-t-xl bg-surface text-ink shadow-sheet motion-safe:animate-[monter_.2s_ease-out] ${className}`}
        >
          <div className="flex items-center gap-2 px-4 pt-3 pb-2">
            <span aria-hidden className="absolute top-1.5 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-line" />
            {title && <h2 className="min-w-0 flex-1 truncate pt-1 font-display text-heading font-semibold">{title}</h2>}
            {headerAction}
            <button
              type="button"
              onClick={onClose}
              aria-label={t.commun.fermer}
              className="grid size-tap-min place-items-center rounded-md text-ink-muted"
            >
              <X aria-hidden className="size-6" strokeWidth={2} />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>
          {footer && (
            <div className="border-t border-line bg-surface px-4 pt-3 pb-[max(env(safe-area-inset-bottom),12px)]">
              {footer}
            </div>
          )}
        </div>
      )}
    </dialog>
  );
}

export function Toast({
  message,
  detail,
  actionLabel,
  onAction,
  onClose,
  tone = 'neutral',
}: {
  message: ReactNode;
  detail?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  onClose: () => void;
  tone?: 'neutral' | 'success' | 'danger';
}) {
  const fond =
    tone === 'success'
      ? 'bg-night text-on-night'
      : tone === 'danger'
        ? 'bg-danger text-on-danger'
        : 'bg-night text-on-night';
  return (
    <div
      role="status"
      className={`pointer-events-auto flex items-center gap-3 rounded-lg px-4 py-3 shadow-float motion-safe:animate-[apparaitre_.15s_ease-out] ${fond}`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-body font-semibold">{message}</p>
        {detail && <p className="text-caption opacity-80">{detail}</p>}
      </div>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="h-10 shrink-0 rounded-md bg-gold px-3 text-body font-bold text-on-gold"
        >
          {actionLabel}
        </button>
      )}
      <button
        type="button"
        onClick={onClose}
        aria-label={t.commun.fermer}
        className="grid size-10 shrink-0 place-items-center rounded-md opacity-80"
      >
        <X aria-hidden className="size-5" strokeWidth={2} />
      </button>
    </div>
  );
}

export type EtatSync = 'online' | 'syncing' | 'offline' | 'error';

export function StatutSync({
  state,
  pending = 0,
  compact = false,
}: {
  state: EtatSync;
  pending?: number;
  compact?: boolean;
}) {
  const Icon =
    state === 'offline' ? CloudOff : state === 'syncing' ? RefreshCw : state === 'error' ? TriangleAlert : Cloud;
  const couleur = state === 'offline' || state === 'error' ? 'text-warning' : 'text-ink-muted';
  const libelle =
    state === 'offline'
      ? t.sync.horsLigne
      : state === 'syncing'
        ? t.sync.synchro
        : state === 'error'
          ? t.sync.erreur
          : t.sync.enLigne;
  return (
    <span
      className={`inline-flex h-8 items-center gap-1.5 rounded-full px-2 text-caption font-semibold ${couleur}`}
      title={libelle}
      aria-label={pending ? `${libelle} · ${t.sync.enAttente(pending)}` : libelle}
    >
      <Icon
        aria-hidden
        className={`size-4 ${state === 'syncing' ? 'animate-spin motion-reduce:animate-none' : ''}`}
        strokeWidth={2}
      />
      {!compact && (pending > 0 ? t.sync.enAttente(pending) : state !== 'online' ? libelle : null)}
    </span>
  );
}

export interface LigneListeProps {
  title: ReactNode;
  subtitle?: ReactNode;
  emoji?: string | null;
  icon?: LucideIcon;
  value?: ReactNode;
  amount?: number;
  amountDevise?: string;
  chevron?: boolean;
  onClick?: () => void;
  children?: ReactNode;
  className?: string;
}

export function LigneListe({
  title,
  subtitle,
  emoji,
  icon: Icon,
  value,
  amount,
  amountDevise = 'CFP',
  chevron = false,
  onClick,
  children,
  className = '',
}: LigneListeProps) {
  const contenu = (
    <>
      {emoji && (
        <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-md bg-surface-sunk text-xl">
          {emoji}
        </span>
      )}
      {Icon && (
        <span className="grid size-10 shrink-0 place-items-center rounded-md bg-surface-sunk text-violet">
          <Icon aria-hidden className="size-5" strokeWidth={2} />
        </span>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
        <p className="truncate text-body font-semibold">{title}</p>
        {subtitle && <p className="truncate text-caption text-ink-muted">{subtitle}</p>}
      </div>
      {amount !== undefined && <Montant value={amount} devise={amountDevise} size="md" />}
      {value}
      {children}
      {chevron && <ChevronRight aria-hidden className="size-5 shrink-0 text-ink-muted" strokeWidth={2} />}
    </>
  );
  const classes = `flex min-h-tap-lg w-full items-center gap-3 px-1 py-2 ${className}`;
  return onClick ? (
    <button type="button" onClick={onClick} className={`${classes} rounded-md active:bg-surface-sunk`}>
      {contenu}
    </button>
  ) : (
    <div className={classes}>{contenu}</div>
  );
}

export function Carte({
  title,
  icon: Icon,
  action,
  flush = false,
  children,
  className = '',
}: {
  title?: ReactNode;
  icon?: LucideIcon;
  action?: ReactNode;
  flush?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`flex flex-col rounded-lg border border-line bg-surface ${flush ? '' : 'p-4'} ${className}`}>
      {(title || action) && (
        <div className={`flex items-center gap-2 ${flush ? 'px-4 pt-4' : ''} ${children ? 'mb-3' : ''}`}>
          {Icon && <Icon aria-hidden className="size-5 text-violet" strokeWidth={2} />}
          {title && <h2 className="min-w-0 flex-1 truncate text-heading font-bold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function EtatVide({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-surface-sunk text-ink-muted">
        <Icon aria-hidden className="size-7" strokeWidth={1.75} />
      </span>
      <p className="text-body font-semibold">{title}</p>
      {children && <p className="text-caption text-ink-muted">{children}</p>}
    </div>
  );
}
