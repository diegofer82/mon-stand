import { CircleAlert, Leaf, type LucideIcon, PackageX, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

import { etatStock } from '../../../shared/domaine/stock';
import { formatNumber } from '../../../shared/montants';
import { t } from '../../textes/fr';

export type Tone = 'neutral' | 'violet' | 'gold' | 'success' | 'warning' | 'danger';

const TONES: Record<Tone, string> = {
  neutral: 'bg-surface-sunk text-ink-muted',
  violet: 'bg-violet-soft text-violet',
  gold: 'bg-gold-soft text-gold-edge',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
};

export function Badge({
  tone = 'neutral',
  icon: Icon,
  children,
  className = '',
}: {
  tone?: Tone;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2.5 text-caption font-semibold whitespace-nowrap ${TONES[tone]} ${className}`}
    >
      {Icon && <Icon aria-hidden className="size-3.5" strokeWidth={2.5} />}
      {children}
    </span>
  );
}

/** Estado del stock siempre con palabra: verde y rojo no se distinguen solo por el color. */
export function BadgeStock({ qty, className = '' }: { qty: number; className?: string }) {
  const etat = etatStock(qty);
  if (etat === 'epuise')
    return (
      <Badge tone="danger" icon={PackageX} className={className}>
        {t.stock.epuise}
      </Badge>
    );
  if (etat === 'faible')
    return (
      <Badge tone="warning" icon={TriangleAlert} className={className}>
        {t.stock.faible} · {qty}
      </Badge>
    );
  return (
    <Badge tone="neutral" className={className}>
      {qty}
    </Badge>
  );
}

const TAILLES_MONTANT = {
  sm: 'text-caption',
  md: 'text-amount-md',
  lg: 'text-amount-lg',
  xl: 'text-amount-xl',
} as const;

const TONES_MONTANT = {
  default: 'text-ink',
  muted: 'text-ink-muted',
  success: 'text-success',
  danger: 'text-danger',
  violet: 'text-violet',
  gold: 'text-gold',
  night: 'text-on-night',
} as const;

export interface MontantProps {
  value: number;
  devise?: string;
  size?: keyof typeof TAILLES_MONTANT;
  tone?: keyof typeof TONES_MONTANT;
  /** «≈ 738 CFP» */
  approx?: boolean;
  /** Muestra «+» delante de los positivos. */
  sign?: boolean;
  className?: string;
}

/** Importe en cifras tabulares, código de divisa en pequeño (la tarjeta se expresa en CFP). */
export function Montant({
  value,
  devise = 'CFP',
  size = 'md',
  tone = 'default',
  approx = false,
  sign = false,
  className = '',
}: MontantProps) {
  const code = devise === 'TPE' ? 'CFP' : devise;
  const texte = formatNumber(value, devise);
  return (
    <span
      className={`inline-flex items-baseline gap-1 font-semibold tabular-nums ${TAILLES_MONTANT[size]} ${TONES_MONTANT[tone]} ${className}`}
    >
      {approx && <span aria-hidden>≈</span>}
      <span>
        {sign && value > 0 ? '+' : ''}
        {texte}
      </span>
      <span
        className={`font-medium ${size === 'xl' ? 'text-heading' : size === 'lg' ? 'text-body' : size === 'md' ? 'text-caption' : 'text-overline'}`}
      >
        {code}
      </span>
    </span>
  );
}

/** Etiqueta de precio (la única forma con agujero: el guiño a las etiquetas del stand). */
export function EtiquettePrix({
  value,
  devise = 'CFP',
  className = '',
}: {
  value: number;
  devise?: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-sm bg-gold-soft py-0.5 pr-2 pl-1.5 text-amount-md font-bold tabular-nums text-ink ${className}`}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-surface ring-1 ring-gold-edge" />
      {formatNumber(value, devise)}
      <span className="text-overline font-semibold text-ink-muted">{devise}</span>
    </span>
  );
}

export function Kpi({
  label,
  value,
  devise = 'CFP',
  detail,
  hero = false,
  className = '',
}: {
  label: ReactNode;
  value: number | ReactNode;
  devise?: string | null;
  detail?: ReactNode;
  hero?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col gap-1 rounded-lg border border-line bg-surface p-4 ${hero ? 'col-span-2' : ''} ${className}`}
    >
      <p className="text-overline font-semibold tracking-wide text-ink-muted uppercase">{label}</p>
      {typeof value === 'number' ? (
        devise ? (
          <Montant value={value} devise={devise} size={hero ? 'xl' : 'lg'} />
        ) : (
          <span className={`font-semibold tabular-nums ${hero ? 'text-amount-xl' : 'text-amount-lg'}`}>
            {formatNumber(value)}
          </span>
        )
      ) : (
        <span className={`font-semibold ${hero ? 'text-amount-xl' : 'text-amount-lg'}`}>{value}</span>
      )}
      {detail && <p className="text-caption text-ink-muted">{detail}</p>}
    </div>
  );
}

const BANNIERES = {
  neutral: 'bg-surface-sunk text-ink border-line',
  warning: 'bg-warning-soft text-warning border-warning/30',
  success: 'bg-success-soft text-success border-success/30',
  danger: 'bg-danger-soft text-danger border-danger/30',
} as const;

export function Banniere({
  tone = 'neutral',
  icon: Icon = CircleAlert,
  title,
  children,
  className = '',
}: {
  tone?: keyof typeof BANNIERES;
  icon?: LucideIcon;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={`flex items-start gap-3 rounded-md border px-3 py-2.5 text-body ${BANNIERES[tone]} ${className}`}
    >
      <Icon aria-hidden className="mt-0.5 size-5 shrink-0" strokeWidth={2} />
      <div className="flex min-w-0 flex-col gap-0.5">
        {title && <p className="font-semibold">{title}</p>}
        {children && <p className="text-caption">{children}</p>}
      </div>
    </div>
  );
}

function initiales(nom: string): string {
  return nom
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((m) => m.charAt(0).toUpperCase())
    .join('');
}

export function Avatar({
  name,
  size = 40,
  tone = 'default',
  selected = false,
  showName = false,
  onClick,
  className = '',
}: {
  name: string;
  size?: number;
  tone?: 'default' | 'night';
  selected?: boolean;
  showName?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const rond = (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full font-bold transition-shadow ${tone === 'night' ? 'bg-night-raised text-on-night' : 'bg-violet-soft text-violet'} ${selected ? 'ring-3 ring-gold' : ''}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
    >
      {initiales(name)}
    </span>
  );
  if (!onClick)
    return (
      <span className={`inline-flex items-center gap-2 ${className}`}>
        {rond}
        {showName && <span className="text-body font-semibold">{name}</span>}
      </span>
    );
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={name}
      className={`inline-flex min-h-tap-min flex-col items-center gap-2 rounded-lg p-2 ${className}`}
    >
      {rond}
      {showName && (
        <span className={`text-body font-semibold ${tone === 'night' ? 'text-on-night' : 'text-ink'}`}>{name}</span>
      )}
    </button>
  );
}

/** La marca sin logotipo: nombre en Playfair + hoja (heredera del 🌿 de la v1). */
export function Marque({
  tone = 'default',
  size = 'md',
  className = '',
}: {
  tone?: 'default' | 'night';
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 font-display font-semibold tracking-tight ${size === 'md' ? 'text-brand' : 'text-heading'} ${tone === 'night' ? 'text-on-night' : 'text-ink'} ${className}`}
    >
      <Leaf
        aria-hidden
        className={`${size === 'md' ? 'size-8' : 'size-5'} ${tone === 'night' ? 'text-gold' : 'text-violet'}`}
        strokeWidth={2}
      />
      {t.marque}
    </span>
  );
}
