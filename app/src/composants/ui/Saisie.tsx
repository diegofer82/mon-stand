import { Delete, type LucideIcon, Minus, Plus, X } from 'lucide-react';
import { type InputHTMLAttributes, type ReactNode, useId } from 'react';

export interface ChampProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value'> {
  label: string;
  value?: string | number;
  suffix?: string;
  help?: string;
  error?: string | null;
  /** Cifras tabulares alineadas a la derecha. */
  amount?: boolean;
  /** Sin borde, sobre `surface-sunk` (búsqueda). */
  variant?: 'default' | 'sunk';
  icon?: LucideIcon;
}

export function Champ({
  label,
  suffix,
  help,
  error,
  amount = false,
  variant = 'default',
  icon: Icon,
  className = '',
  id,
  ...rest
}: ChampProps) {
  const auto = useId();
  const inputId = id ?? auto;
  const helpId = `${inputId}-aide`;
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={inputId} className="text-caption font-semibold text-ink-muted">
        {label}
      </label>
      <div
        className={`flex h-tap-min items-center gap-2 rounded-md px-3 ${variant === 'sunk' ? 'bg-surface-sunk' : 'border bg-surface'} ${
          error ? 'border-danger' : variant === 'sunk' ? '' : 'border-line-strong'
        } focus-within:shadow-[var(--focus-ring)]`}
      >
        {Icon && <Icon aria-hidden className="size-5 shrink-0 text-ink-muted" strokeWidth={2} />}
        <input
          id={inputId}
          aria-invalid={!!error}
          aria-describedby={help || error ? helpId : undefined}
          className={`min-w-0 flex-1 bg-transparent text-body text-ink outline-none placeholder:text-ink-muted/70 ${amount ? 'text-right font-semibold tabular-nums' : ''}`}
          {...rest}
        />
        {suffix && <span className="shrink-0 text-caption font-semibold text-ink-muted">{suffix}</span>}
      </div>
      {(error || help) && (
        <p id={helpId} className={`text-caption ${error ? 'text-danger' : 'text-ink-muted'}`}>
          {error ?? help}
        </p>
      )}
    </div>
  );
}

export interface OptionSegment {
  id: string;
  label: string;
  icon?: LucideIcon;
}

export function Segments({
  options,
  value,
  onChange,
  label,
  className = '',
}: {
  options: OptionSegment[];
  value: string;
  onChange: (id: string) => void;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`grid h-tap-min rounded-md bg-surface-sunk p-1 ${className}`}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => {
        const actif = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={actif}
            onClick={() => onChange(o.id)}
            className={`inline-flex items-center justify-center gap-1.5 rounded-sm px-2 text-body font-semibold transition-colors ${actif ? 'bg-surface text-violet shadow-xs' : 'text-ink-muted'}`}
          >
            {o.icon && <o.icon aria-hidden className="size-4" strokeWidth={2} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Puce({
  selected = false,
  emoji,
  icon: Icon,
  count,
  children,
  className = '',
  ...rest
}: {
  selected?: boolean;
  emoji?: string | null;
  icon?: LucideIcon;
  count?: number;
  children?: ReactNode;
  className?: string;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-body font-semibold whitespace-nowrap transition-colors ${
        selected ? 'border-violet bg-violet text-on-violet' : 'border-line bg-surface-sunk text-ink'
      } ${className}`}
      {...rest}
    >
      {emoji && <span aria-hidden>{emoji}</span>}
      {Icon && <Icon aria-hidden className="size-4" strokeWidth={2} />}
      {children}
      {count !== undefined && (
        <span
          className={`rounded-full px-1.5 text-caption ${selected ? 'bg-on-violet/20' : 'bg-surface text-ink-muted'}`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

/** Interruptor (role="switch"): toda la fila es la zona táctil. */
export function Interrupteur({
  label,
  help,
  checked,
  onChange,
  icon: Icon,
  className = '',
}: {
  label: string;
  help?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`flex min-h-tap-min w-full items-center gap-3 rounded-md border border-line bg-surface px-3 py-2.5 text-left outline-none focus-visible:shadow-[var(--focus-ring)] ${className}`}
    >
      {Icon && (
        <Icon aria-hidden className={`size-5 shrink-0 ${checked ? 'text-violet' : 'text-ink-muted'}`} strokeWidth={2} />
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-body font-semibold text-ink">{label}</span>
        {help && <span className="text-caption text-ink-muted">{help}</span>}
      </span>
      <span
        aria-hidden
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? 'bg-violet' : 'bg-line-strong'}`}
      >
        <span
          className={`absolute top-1 left-1 size-5 rounded-full shadow-xs transition-transform ${checked ? 'translate-x-5 bg-on-violet' : 'bg-surface'}`}
        />
      </span>
    </button>
  );
}

export function Compteur({
  value,
  onInc,
  onDec,
  max,
  min = 1,
  label,
  removable = false,
  className = '',
}: {
  value: number;
  onInc: () => void;
  onDec: () => void;
  max?: number;
  min?: number;
  label: string;
  removable?: boolean;
  className?: string;
}) {
  const auMin = value <= min;
  return (
    <div
      className={`inline-flex h-tap-min items-center rounded-md border border-line bg-surface ${className}`}
      role="group"
      aria-label={label}
    >
      <button
        type="button"
        onClick={onDec}
        aria-label={removable && auMin ? `Retirer ${label}` : `Moins ${label}`}
        className={`grid h-full w-11 place-items-center rounded-l-md ${removable && auMin ? 'text-danger' : 'text-ink'} disabled:opacity-30`}
        disabled={!removable && auMin}
      >
        {removable && auMin ? (
          <X aria-hidden className="size-5" strokeWidth={2} />
        ) : (
          <Minus aria-hidden className="size-5" strokeWidth={2} />
        )}
      </button>
      <span className="min-w-7 text-center text-body font-bold tabular-nums" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        onClick={onInc}
        aria-label={`Plus ${label}`}
        className="grid h-full w-11 place-items-center rounded-r-md text-ink disabled:opacity-30"
        disabled={max !== undefined && value >= max}
      >
        <Plus aria-hidden className="size-5" strokeWidth={2} />
      </button>
    </div>
  );
}

const TOUCHES = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

/** Teclado numérico: importes (con coma o «000») o PIN (sobre `night`). */
export function ClavierNumerique({
  mode = 'amount',
  onKey,
  extraKey = '000',
  tone = 'default',
  className = '',
}: {
  mode?: 'amount' | 'pin';
  onKey: (key: string) => void;
  extraKey?: string | null;
  tone?: 'default' | 'night';
  className?: string;
}) {
  const classe =
    tone === 'night' ? 'bg-night-raised text-on-night active:bg-white/25' : 'bg-surface-sunk text-ink active:bg-line';
  return (
    <div
      className={`grid grid-cols-3 gap-2 ${className}`}
      role="group"
      aria-label={mode === 'pin' ? 'Clavier PIN' : 'Clavier numérique'}
    >
      {TOUCHES.map((k) => (
        <Touche key={k} k={k} classe={classe} onKey={onKey} />
      ))}
      {mode === 'pin' || !extraKey ? <span aria-hidden /> : <Touche k={extraKey} classe={classe} onKey={onKey} />}
      <Touche k="0" classe={classe} onKey={onKey} />
      <Touche
        k="del"
        classe={classe}
        onKey={onKey}
        label={<Delete aria-hidden className="mx-auto size-6" strokeWidth={2} />}
        aria="Effacer"
      />
    </div>
  );
}

function Touche({
  k,
  label,
  aria,
  classe,
  onKey,
}: {
  k: string;
  label?: ReactNode;
  aria?: string;
  classe: string;
  onKey: (key: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onKey(k)}
      aria-label={aria}
      className={`h-tap-lg rounded-md text-heading font-semibold tabular-nums select-none ${classe}`}
    >
      {label ?? k}
    </button>
  );
}

export function PointsPin({
  length = 4,
  filled = 0,
  error = false,
  className = '',
}: {
  length?: number;
  filled?: number;
  error?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`flex justify-center gap-4 ${error ? 'animate-[secousse_.3s_ease]' : ''} ${className}`}
      aria-live="polite"
      aria-label={`${filled} sur ${length} chiffres`}
    >
      {Array.from({ length }, (_, i) => (
        <span
          key={i}
          aria-hidden
          className={`size-4 rounded-full border-2 transition-colors ${error ? 'border-danger bg-danger' : i < filled ? 'border-gold bg-gold' : 'border-on-night-muted'}`}
        />
      ))}
    </div>
  );
}
