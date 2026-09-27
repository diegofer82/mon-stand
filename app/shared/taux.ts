// Tasas de cambio: CFP por unidad de divisa. EUR fijo (paridad); las demás derivan de las tasas EUR del BCE.
import { arrondir, DEVISES, EUR_CFP, type Devise } from './montants';
import type { TableTaux } from './domaine/types';

/** Tasas de partida (v1.5), por si no hay red ni historial. */
export const TAUX_DEFAUT: Record<Devise, number> = {
  CFP: 1,
  EUR: EUR_CFP,
  AUD: 73.77,
  USD: 104.98,
  NZD: 59.52,
  JPY: 0.661,
};

export const DEVISES_ETRANGERES = DEVISES.filter((d): d is Exclude<Devise, 'CFP'> => d !== 'CFP');

/** De «1 EUR = x unidades de divisa» (base EUR) a «CFP por unidad», con 4 decimales (v1: fetchRates). */
export function cfpParUniteDepuisEur(uniteParEur: number): number {
  if (!(uniteParEur > 0)) return 0;
  return arrondir((EUR_CFP / uniteParEur) * 10000) / 10000;
}

/** Completa una tabla de tasas con los valores por defecto y fuerza la paridad del euro. */
export function tableTauxComplete(partielle: TableTaux): Record<Devise, number> {
  const t = { ...TAUX_DEFAUT };
  for (const d of DEVISES) {
    const v = partielle[d];
    if (v && v > 0) t[d] = v;
  }
  t.EUR = EUR_CFP;
  t.CFP = 1;
  return t;
}
