import type { LucideIcon } from 'lucide-react';
import { type ButtonHTMLAttributes, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';

export type VarianteBouton = 'primary' | 'brand' | 'secondary' | 'ghost' | 'danger' | 'success';
export type TailleBouton = 'sm' | 'md' | 'lg' | 'xl';

export interface BoutonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: VarianteBouton;
  size?: TailleBouton;
  icon?: LucideIcon;
  iconEnd?: LucideIcon;
  iconOnly?: boolean;
  block?: boolean;
}

const VARIANTES: Record<VarianteBouton, string> = {
  primary: 'bg-gold text-on-gold border border-gold-edge hover:brightness-95 active:brightness-90',
  brand: 'bg-violet text-on-violet border border-violet hover:brightness-110 active:brightness-95',
  secondary: 'bg-surface text-ink border border-line-strong hover:bg-surface-sunk active:bg-surface-sunk',
  ghost: 'bg-transparent text-violet border border-transparent hover:bg-violet-soft active:bg-violet-soft',
  danger: 'bg-danger text-on-danger border border-danger hover:brightness-110',
  success: 'bg-success text-on-success border border-success hover:brightness-110',
};

const TAILLES: Record<TailleBouton, string> = {
  sm: 'h-9 px-3 text-caption gap-1.5 rounded-sm',
  md: 'h-tap-min px-4 text-body gap-2 rounded-md',
  lg: 'h-tap-lg px-5 text-body gap-2 rounded-md',
  xl: 'h-tap-xl px-6 text-heading gap-2.5 rounded-lg',
};

const ICONES: Record<TailleBouton, string> = { sm: 'size-4', md: 'size-5', lg: 'size-5', xl: 'size-6' };

export function Bouton({
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  iconEnd: IconEnd,
  iconOnly = false,
  block = false,
  className = '',
  children,
  type = 'button',
  ...rest
}: BoutonProps) {
  return (
    <button
      type={type}
      className={`inline-flex shrink-0 items-center justify-center font-semibold whitespace-nowrap transition-[filter,background-color] duration-150 select-none disabled:cursor-not-allowed disabled:opacity-40 ${VARIANTES[variant]} ${TAILLES[size]} ${iconOnly ? 'aspect-square px-0' : ''} ${block ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {Icon && <Icon aria-hidden className={ICONES[size]} strokeWidth={2} />}
      {!iconOnly && children}
      {IconEnd && <IconEnd aria-hidden className={ICONES[size]} strokeWidth={2} />}
    </button>
  );
}

export interface BoutonMaintenuProps {
  label: ReactNode;
  icon?: LucideIcon;
  tone?: 'success' | 'danger' | 'primary';
  hint?: string;
  /** ms que hay que mantener pulsado. */
  duration?: number;
  onComplete: () => void;
  disabled?: boolean;
  className?: string;
}

/** Botón que se activa manteniéndolo pulsado (Commencer/Terminer, Clôturer): evita el toque accidental. */
export function BoutonMaintenu({
  label,
  icon: Icon,
  tone = 'success',
  hint,
  duration = 900,
  onComplete,
  disabled,
  className = '',
}: BoutonMaintenuProps) {
  // La barra de progreso es una transición CSS; la validación, un temporizador (independiente del repintado).
  const [enfonce, setEnfonce] = useState(false);
  const minuteur = useRef<number>(0);

  const arreter = useCallback(() => {
    window.clearTimeout(minuteur.current);
    setEnfonce(false);
  }, []);

  const commencer = () => {
    if (disabled) return;
    window.clearTimeout(minuteur.current);
    setEnfonce(true);
    minuteur.current = window.setTimeout(() => {
      setEnfonce(false);
      onComplete();
    }, duration);
  };

  useEffect(() => () => window.clearTimeout(minuteur.current), []);

  const couleur =
    tone === 'danger'
      ? 'bg-danger text-on-danger'
      : tone === 'primary'
        ? 'bg-gold text-on-gold border border-gold-edge'
        : 'bg-success text-on-success';
  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <button
        type="button"
        disabled={disabled}
        aria-label={typeof label === 'string' ? label : undefined}
        className={`relative h-tap-xl w-full overflow-hidden rounded-lg text-heading font-bold select-none disabled:opacity-40 ${couleur}`}
        style={{ touchAction: 'none' }}
        onPointerDown={commencer}
        onPointerUp={arreter}
        onPointerLeave={arreter}
        onPointerCancel={arreter}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            commencer();
          }
        }}
        onKeyUp={arreter}
        onContextMenu={(e) => e.preventDefault()}
      >
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 bg-black/20 ease-linear motion-reduce:transition-none"
          style={{
            width: enfonce ? '100%' : '0%',
            transitionProperty: 'width',
            transitionDuration: enfonce ? `${duration}ms` : '0ms',
          }}
        />
        <span className="relative inline-flex items-center gap-2.5">
          {Icon && <Icon aria-hidden className="size-6" strokeWidth={2} />}
          {label}
        </span>
      </button>
      {hint && <p className="text-caption text-ink-muted">{hint}</p>}
    </div>
  );
}
