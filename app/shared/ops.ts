// Operaciones de sincronización: el mismo contrato (zod) valida lo que el teléfono guarda en su outbox
// y lo que el Worker recibe. Cada operación lleva un UUID: reenviarla no la aplica dos veces.
import { z } from 'zod';

import { DEVISES, MODES_PAIEMENT } from './montants';
import { MOTIFS_STOCK } from './domaine/types';

const id = z.string().min(1).max(64);
const instant = z.string().datetime({ offset: false });
const dateLocale = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const entierCfp = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const montant = z.number().min(0).finite();
const devise = z.enum(DEVISES);
const modePaiement = z.enum(MODES_PAIEMENT);

export const prixDevisesSchema = z.partialRecord(devise, z.number().positive().finite()).default({});

export const articleSchema = z.object({
  id,
  nom: z.string().trim().min(1).max(80),
  categorieId: id,
  emoji: z.string().max(16).nullable(),
  prixCfp: entierCfp,
  promo2emePct: z.number().int().min(1).max(99).nullable(),
  prixDevises: prixDevisesSchema,
  actif: z.boolean(),
  updatedAt: instant,
});

export const categorieSchema = z.object({
  id,
  nom: z.string().trim().min(1).max(40),
  emoji: z.string().max(16).nullable(),
  ordre: z.number().int(),
});

export const ligneVenteSchema = z.object({
  id,
  articleId: id,
  nomSnapshot: z.string().max(80),
  qty: z.number().int().positive(),
  prixUnitCfp: entierCfp,
  totalCfp: entierCfp,
});

export const paiementSchema = z.object({
  id,
  devise: modePaiement,
  montantDevise: montant,
  totalDevise: montant.nullable(),
  tauxCfp: z.number().positive().finite().nullable(),
  montantCfp: entierCfp,
  renduMontant: montant.nullable(),
  renduDevise: devise.nullable(),
});

export const venteSchema = z.object({
  id,
  journeeId: id,
  vendeurId: id,
  deviceId: id,
  ts: instant,
  sousTotalCfp: entierCfp,
  remisePanierCfp: entierCfp,
  remiseEncaissementCfp: entierCfp,
  totalCfp: entierCfp,
  annuleeAt: instant.nullable(),
  lignes: z.array(ligneVenteSchema).min(1),
  paiements: z.array(paiementSchema).min(1),
});

export const mouvementStockSchema = z.object({
  id,
  articleId: id,
  delta: z.number().int(),
  motif: z.enum(MOTIFS_STOCK),
  venteId: id.nullable(),
  vendeurId: id,
  deviceId: id,
  ts: instant,
});

export const journeeSchema = z.object({
  id,
  dateLocale,
  lieu: z.string().trim().min(1).max(60),
  vendeurId: id,
  fonds: z.partialRecord(devise, montant).default({}),
  ouverteAt: instant,
  clotureeAt: instant.nullable(),
  commentaireCloture: z.string().max(500).nullable(),
  pdfKey: z.string().max(200).nullable(),
});

export const comptageSchema = z.object({
  id,
  journeeId: id,
  devise,
  attendu: z.number().finite(),
  compte: z.number().finite(),
  ecart: z.number().finite(),
});

export const sessionTravailSchema = z.object({
  id,
  vendeurId: id,
  debut: instant,
  fin: instant.nullable(),
  dureeMin: z.number().int().min(0).nullable(),
  commentaire: z.string().max(200).nullable(),
  payeeAt: instant.nullable(),
});

export const vendeurPublicSchema = z.object({
  id,
  prenom: z.string().trim().min(1).max(40),
  tauxHoraireCfp: entierCfp,
  actif: z.boolean(),
});

const enveloppe = {
  opId: z.string().uuid(),
  deviceId: id,
  vendeurId: id.nullable(),
  ts: instant,
};

export const opSchema = z.discriminatedUnion('type', [
  z.object({
    ...enveloppe,
    type: z.literal('vente.creer'),
    vente: venteSchema,
    mouvements: z.array(mouvementStockSchema),
  }),
  z.object({
    ...enveloppe,
    type: z.literal('vente.annuler'),
    venteId: id,
    annuleeAt: instant,
    mouvements: z.array(mouvementStockSchema),
  }),
  z.object({ ...enveloppe, type: z.literal('stock.mouvement'), mouvement: mouvementStockSchema }),
  z.object({ ...enveloppe, type: z.literal('article.upsert'), article: articleSchema }),
  z.object({ ...enveloppe, type: z.literal('categorie.upsert'), categorie: categorieSchema }),
  z.object({ ...enveloppe, type: z.literal('journee.ouvrir'), journee: journeeSchema }),
  z.object({
    ...enveloppe,
    type: z.literal('journee.cloturer'),
    journeeId: id,
    clotureeAt: instant,
    commentaire: z.string().max(500).nullable(),
    comptages: z.array(comptageSchema),
  }),
  z.object({ ...enveloppe, type: z.literal('session.upsert'), session: sessionTravailSchema }),
  z.object({ ...enveloppe, type: z.literal('session.supprimer'), sessionId: id }),
  z.object({
    ...enveloppe,
    type: z.literal('taux.definir'),
    devise,
    cfpParUnite: z.number().positive().finite(),
    source: z.string().max(40),
    date: dateLocale,
  }),
  z.object({ ...enveloppe, type: z.literal('vendeur.upsert'), vendeur: vendeurPublicSchema }),
  z.object({
    ...enveloppe,
    type: z.literal('settings.definir'),
    key: z.string().min(1).max(60),
    value: z.string().max(2000),
  }),
]);

export type Op = z.infer<typeof opSchema>;
export type OpType = Op['type'];
export type OpDe<T extends OpType> = Extract<Op, { type: T }>;
