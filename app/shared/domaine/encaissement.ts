// Encaissement: lo acreditado, la remise à l'encaissement y la monnaie, en CFP, tarjeta o divisa; pago mixto.
import { arrondir, arrondirMontant, decimalesDevise, versCfp, type Devise, type ModePaiement } from '../montants';
import type { Paiement } from './types';

export interface DemandePaiement {
  /** Lo que queda por pagar en CFP (el total, o el reste en un pago mixto). */
  resteCfp: number;
  devise: ModePaiement;
  /** Precio pedido en la divisa (suma de precios en divisa); ignorado en CFP/TPE. */
  totalDevise?: number;
  /** CFP por unidad de la divisa; obligatorio fuera de CFP/TPE. */
  taux?: number;
  /** Lo que da el cliente en la divisa del pago; vacío = compte juste. */
  montantRecu?: number | null;
}

export interface ResultatPaiement {
  devise: ModePaiement;
  montantDevise: number;
  totalDevise: number | null;
  tauxCfp: number | null;
  montantCfp: number;
  remiseEncaissementCfp: number;
  rendu: { montant: number; devise: Devise } | null;
  /** Lo que sigue pendiente en CFP tras este pago (pago mixto). */
  resteApresCfp: number;
}

export function estEspeceEtrangere(devise: ModePaiement): devise is Exclude<Devise, 'CFP'> {
  return devise !== 'CFP' && devise !== 'TPE';
}

/**
 * Regla v1.4/v1.5:
 * - CFP: se acredita min(reste, recibido); si falta, es remise à l'encaissement; si sobra, monnaie en CFP.
 * - TPE: como CFP, sin monnaie.
 * - Divisa: se acredita min(reste, min(recibido, totalDevise) × taux). La monnaie (recibido − totalDevise)
 *   se devuelve en la misma divisa y no cuenta como cobrado.
 */
export function calculerPaiement(d: DemandePaiement): ResultatPaiement {
  const reste = Math.max(0, arrondir(d.resteCfp));
  if (!estEspeceEtrangere(d.devise)) {
    const recu = d.montantRecu && d.montantRecu > 0 ? arrondir(d.montantRecu) : reste;
    const montantCfp = Math.min(reste, recu);
    const surplus = recu - reste;
    return {
      devise: d.devise,
      montantDevise: recu,
      totalDevise: null,
      tauxCfp: null,
      montantCfp,
      remiseEncaissementCfp: 0,
      rendu: d.devise === 'CFP' && surplus > 0 ? { montant: surplus, devise: 'CFP' } : null,
      resteApresCfp: 0,
    };
  }
  const taux = d.taux ?? 0;
  const totalDevise = arrondirMontant(d.totalDevise ?? 0, d.devise);
  const recu = d.montantRecu && d.montantRecu > 0 ? arrondirMontant(d.montantRecu, d.devise) : totalDevise;
  const montantCfp = Math.min(reste, versCfp(Math.min(recu, totalDevise), taux));
  const surplus = arrondirMontant(recu - totalDevise, d.devise);
  return {
    devise: d.devise,
    montantDevise: recu,
    totalDevise,
    tauxCfp: taux,
    montantCfp,
    remiseEncaissementCfp: 0,
    rendu: surplus > 0 ? { montant: surplus, devise: d.devise } : null,
    resteApresCfp: 0,
  };
}

/**
 * Cierra la cuenta de una venta: la diferencia entre el total y lo acreditado por todos los pagos es la
 * remise à l'encaissement (nunca negativa).
 */
export function remiseEncaissement(totalCfp: number, paiements: Pick<Paiement, 'montantCfp'>[]): number {
  const acredite = paiements.reduce((s, p) => s + p.montantCfp, 0);
  return Math.max(0, totalCfp - acredite);
}

/** Lo que queda por pagar tras los pagos ya registrados. */
export function resteAPayer(totalCfp: number, paiements: Pick<Paiement, 'montantCfp'>[]): number {
  return remiseEncaissement(totalCfp, paiements);
}

/**
 * Pago mixto: el reste en CFP convertido a la divisa al tipo del día, con los decimales de la divisa,
 * sin la regla de redondeo de precios (la vendedora lo usa muy poco).
 */
export function resteEnDevise(resteCfp: number, devise: Devise, taux: number): number {
  if (!(taux > 0)) return 0;
  const facteur = decimalesDevise(devise) === 2 ? 100 : 1;
  return Math.ceil((resteCfp / taux) * facteur - 1e-9) / facteur;
}

/** Billetes habituales por divisa, de menor a mayor. */
export const BILLETS: Record<Devise, number[]> = {
  CFP: [500, 1000, 5000, 10000],
  AUD: [5, 10, 20, 50, 100],
  NZD: [5, 10, 20, 50, 100],
  USD: [1, 5, 10, 20, 50, 100],
  EUR: [5, 10, 20, 50, 100, 200],
  JPY: [1000, 2000, 5000, 10000],
};

/**
 * Sugerencias de importe recibido: el billete (o múltiplo de billete grande) inmediatamente superior al importe
 * y el siguiente, sin repetir el «compte juste». Máximo dos.
 */
export function billetsSuggeres(montant: number, devise: Devise): number[] {
  if (!(montant > 0)) return [];
  const billets = BILLETS[devise];
  const plusGrand = billets[billets.length - 1] ?? 1;
  const candidats = new Set<number>();
  for (const b of billets) if (b > montant) candidats.add(b);
  // Por encima del billete más grande: múltiplos del billete grande.
  let multiple = Math.ceil(montant / plusGrand) * plusGrand;
  if (multiple <= montant) multiple += plusGrand;
  candidats.add(multiple);
  candidats.add(multiple + plusGrand);
  return [...candidats].sort((a, b) => a - b).slice(0, 2);
}
