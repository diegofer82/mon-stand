// Importes: enteros en CFP; precios en divisa según la regla de la v1.5.

export const DEVISES = ['CFP', 'AUD', 'NZD', 'USD', 'EUR', 'JPY'] as const;
export type Devise = (typeof DEVISES)[number];
/** Modos de pago: las divisas en efectivo más la tarjeta (TPE, importe en CFP). */
export const MODES_PAIEMENT = [...DEVISES, 'TPE'] as const;
export type ModePaiement = (typeof MODES_PAIEMENT)[number];

/** El franco CFP está anclado al euro. */
export const EUR_CFP = 119.332;

const SANS_DECIMALES = new Set<string>(['CFP', 'XPF', 'JPY', 'TPE']);

// Espacios que Intl produce entre miles (fino U+2009, insecable U+00A0) y el fino insecable que usamos (U+202F).
const ESPACE_FIN_INSECABLE = String.fromCharCode(0x202f);
const ESPACE_INSECABLE = String.fromCharCode(0x00a0);
const ESPACES_MILLIERS = new RegExp(`[${String.fromCharCode(0x00a0)}${String.fromCharCode(0x2009)}]`, 'g');
const ESPACES_SAISIE = new RegExp(`[\\s${String.fromCharCode(0x00a0)}${String.fromCharCode(0x202f)}]`, 'g');
const MOINS_TYPOGRAPHIQUE = String.fromCharCode(0x2212);

/** Decimales que admite un importe en esa divisa: 0 en CFP, JPY y tarjeta, 2 en las demás. */
export function decimalesDevise(devise: string): 0 | 2 {
  return SANS_DECIMALES.has(devise) ? 0 : 2;
}

/** Único redondeo de la aplicación: al entero más cercano, el medio se aleja de cero (Math.round lleva −0,5 a 0). */
export function arrondir(valeur: number): number {
  if (!Number.isFinite(valeur)) return 0;
  const signe = valeur < 0 ? -1 : 1;
  return signe * Math.floor(Math.abs(valeur) + 0.5);
}

/** Redondea a los decimales de la divisa: 27,499 AUD → 27,5; 1 234,6 JPY → 1 235. */
export function arrondirMontant(valeur: number, devise: string): number {
  const facteur = decimalesDevise(devise) === 2 ? 100 : 1;
  return arrondir(valeur * facteur) / facteur;
}

/**
 * «7 000», «12,5», «−500»: entero en CFP y JPY, hasta 2 decimales en las demás divisas,
 * espacio fino insecable (U+202F) entre miles para que un importe no se corte nunca, signo menos tipográfico.
 */
export function formatNumber(value: number, devise: string = 'CFP'): string {
  const n = Number.isFinite(value) ? value : 0;
  const texte = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: decimalesDevise(devise) })
    .format(Math.abs(n))
    .replace(ESPACES_MILLIERS, ESPACE_FIN_INSECABLE);
  return (n < 0 ? MOINS_TYPOGRAPHIQUE : '') + texte;
}

/** «7 000 CFP», «90 AUD» (espacio insecable antes del código). La tarjeta se expresa en CFP. */
export function formatMontant(value: number, devise: string = 'CFP'): string {
  return `${formatNumber(value, devise)}${ESPACE_INSECABLE}${devise === 'TPE' ? 'CFP' : devise}`;
}

/** Regla v1.5: al 5 más cercano; por encima de 1 000 (yenes), a la centena más cercana. Nunca por debajo del paso. */
export function arrondirDevise(valeur: number): number {
  if (!(valeur > 0)) return 0;
  const pas = valeur > 1000 ? 100 : 5;
  return Math.max(pas, arrondir(valeur / pas) * pas);
}

/** Precio de venta calculado en una divisa a partir del precio CFP y de la tasa (CFP por unidad de divisa). */
export function prixDevise(prixCfp: number, cfpParUnite: number): number {
  if (!(cfpParUnite > 0)) return 0;
  return arrondirDevise(prixCfp / cfpParUnite);
}

/** Contravalor en CFP de un importe en divisa, a la tasa dada (CFP por unidad). Entero. */
export function versCfp(montantDevise: number, cfpParUnite: number): number {
  if (!(cfpParUnite > 0)) return 0;
  return arrondir(montantDevise * cfpParUnite);
}

/**
 * Lee un importe escrito a mano: acepta coma o punto decimal, espacios de miles (incluido U+202F)
 * y rechaza (null) lo ilegible o con más decimales de los que admite la divisa. En una divisa sin
 * decimales (CFP, JPY), «6.000» o «12,500» son millares: leerlos como 6 o 12 falseaba el fondo y el conteo.
 */
export function lireMontant(saisie: string, devise: string = 'CFP'): number | null {
  const sansEspaces = saisie.replace(ESPACES_SAISIE, '');
  const milliers = decimalesDevise(devise) === 0 && /^\d{1,3}([.,]\d{3})+$/.test(sansEspaces);
  const texte = milliers ? sansEspaces.replace(/[.,]/g, '') : sansEspaces.replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(texte)) return null;
  const [, decimales = ''] = texte.split('.');
  if (decimales.replace(/0+$/, '').length > decimalesDevise(devise)) return null;
  const valeur = Number(texte);
  return Number.isSafeInteger(Math.trunc(valeur)) ? valeur : null;
}
