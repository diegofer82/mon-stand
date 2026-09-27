// Modelos del dominio tal como los manejan la interfaz (IndexedDB) y el Worker (D1).
// Importes CFP en enteros; importes en divisa con los decimales de la divisa; instantes ISO 8601 UTC;
// fechas de negocio AAAA-MM-DD en Pacific/Noumea.
import type { Devise, ModePaiement } from '../montants';

export type PrixDevises = Partial<Record<Devise, number>>;

export interface Categorie {
  id: string;
  nom: string;
  emoji: string | null;
  ordre: number;
}

export interface Article {
  id: string;
  nom: string;
  categorieId: string;
  emoji: string | null;
  prixCfp: number;
  promo2emePct: number | null;
  /** Precios manuales por divisa (regla v1.5); sin entrada = calculado. */
  prixDevises: PrixDevises;
  actif: boolean;
  updatedAt: string;
}

export interface Vendeur {
  id: string;
  prenom: string;
  pinHash: string;
  pinSalt: string;
  tauxHoraireCfp: number;
  actif: boolean;
}

export const MOTIFS_STOCK = ['vente', 'ajustement', 'reassort', 'annulation', 'inventaire'] as const;
export type MotifStock = (typeof MOTIFS_STOCK)[number];

export interface MouvementStock {
  id: string;
  articleId: string;
  delta: number;
  motif: MotifStock;
  venteId: string | null;
  vendeurId: string;
  deviceId: string;
  ts: string;
}

export interface LignePanier {
  articleId: string;
  qty: number;
}

export interface LigneVente {
  id: string;
  articleId: string;
  nomSnapshot: string;
  qty: number;
  prixUnitCfp: number;
  totalCfp: number;
}

export interface Paiement {
  id: string;
  devise: ModePaiement;
  /** Lo recibido en la divisa del pago (en CFP para CFP y TPE). */
  montantDevise: number;
  /** Precio pedido en la divisa (suma de los precios de venta en divisa); null en CFP/TPE. */
  totalDevise: number | null;
  /** Tasa aplicada, CFP por unidad; null en CFP/TPE. */
  tauxCfp: number | null;
  /** Lo acreditado en CFP, sin la monnaie. */
  montantCfp: number;
  renduMontant: number | null;
  renduDevise: Devise | null;
}

export interface Vente {
  id: string;
  journeeId: string;
  vendeurId: string;
  deviceId: string;
  ts: string;
  sousTotalCfp: number;
  remisePanierCfp: number;
  remiseEncaissementCfp: number;
  totalCfp: number;
  annuleeAt: string | null;
  lignes: LigneVente[];
  paiements: Paiement[];
}

export interface Journee {
  id: string;
  dateLocale: string;
  lieu: string;
  vendeurId: string;
  /** Fondo de caja por divisa al abrir (1 000 CFP y 100 AUD por defecto). */
  fonds: Partial<Record<Devise, number>>;
  ouverteAt: string;
  clotureeAt: string | null;
  commentaireCloture: string | null;
  pdfKey: string | null;
}

export interface ComptageCaisse {
  id: string;
  journeeId: string;
  devise: Devise;
  attendu: number;
  compte: number;
  ecart: number;
}

export interface SessionTravail {
  id: string;
  vendeurId: string;
  debut: string;
  fin: string | null;
  dureeMin: number | null;
  commentaire: string | null;
  payeeAt: string | null;
}

export interface Taux {
  devise: Devise;
  cfpParUnite: number;
  source: string;
  date: string;
}

export type TableTaux = Partial<Record<Devise, number>>;
