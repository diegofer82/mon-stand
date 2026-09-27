// Importes: enteros en CFP; precios en divisa según la regla de la v1.5.

export const DEVISES = ['CFP', 'AUD', 'NZD', 'USD', 'EUR', 'JPY'] as const;
export type Devise = (typeof DEVISES)[number];

/** El franco CFP está anclado al euro. */
export const EUR_CFP = 119.332;

const SANS_DECIMALES = new Set(['CFP', 'XPF', 'JPY']);

/**
 * «7 000», «12,5», «−500»: entero en CFP y JPY, hasta 2 decimales en las demás divisas,
 * espacio fino insecable (U+202F) entre miles para que un importe no se corte nunca, signo menos tipográfico.
 */
export function formatNumber(value: number, devise: string = 'CFP'): string {
  const n = Number.isFinite(value) ? value : 0;
  const texte = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: SANS_DECIMALES.has(devise) ? 0 : 2 })
    .format(Math.abs(n))
    .replace(/[\u00a0\u2009]/g, '\u202f');
  return (n < 0 ? '\u2212' : '') + texte;
}

/** «7 000 CFP», «90 AUD». */
export function formatMontant(value: number, devise: string = 'CFP'): string {
  return `${formatNumber(value, devise)}\u00a0${devise}`;
}

/** Regla v1.5: al 5 más cercano; por encima de 1 000 (yenes), a la centena más cercana. Nunca por debajo del paso. */
export function arrondirDevise(valeur: number): number {
  if (!(valeur > 0)) return 0;
  const pas = valeur > 1000 ? 100 : 5;
  return Math.max(pas, Math.round(valeur / pas) * pas);
}

/** Precio de venta calculado en una divisa a partir del precio CFP y de la tasa (CFP por unidad de divisa). */
export function prixDevise(prixCfp: number, cfpParUnite: number): number {
  if (!(cfpParUnite > 0)) return 0;
  return arrondirDevise(prixCfp / cfpParUnite);
}
