// Contrato de la API (zod): el Worker valida lo que entra, la interfaz tipa lo que recibe.
// Error uniforme: { erreur: { code, message } }.
import { z } from 'zod';

import { DEVISES } from './montants';
import {
  articleSchema,
  categorieSchema,
  comptageSchema,
  journeeSchema,
  mouvementStockSchema,
  opSchema,
  sessionTravailSchema,
  venteSchema,
} from './ops';

export const CODES_ERREUR = [
  'requete_invalide',
  'non_authentifie',
  'appareil_inconnu',
  'code_invalide',
  'pin_incorrect',
  'trop_d_essais',
  'acces_non_configure',
  'introuvable',
  'interne',
] as const;
export type CodeErreur = (typeof CODES_ERREUR)[number];

export interface ErreurApi {
  erreur: { code: CodeErreur; message: string; details?: unknown };
}

// ---- Emparejamiento ----

export const CODE_APPAIRAGE_LONGUEUR = 8;

export const appairageRequeteSchema = z.object({
  code: z
    .string()
    .trim()
    .transform((s) => s.toUpperCase().replace(/[^A-Z0-9]/g, ''))
    .pipe(z.string().length(CODE_APPAIRAGE_LONGUEUR)),
  nom: z.string().trim().min(1).max(60),
});

export const appairageReponseSchema = z.object({
  deviceId: z.string(),
  token: z.string(),
  nom: z.string(),
});
export type AppairageReponse = z.infer<typeof appairageReponseSchema>;

export const codeAppairageSchema = z.object({
  code: z.string(),
  expiresAt: z.string(),
});

export const appareilSchema = z.object({
  id: z.string(),
  nom: z.string(),
  vendeurId: z.string().nullable(),
  createdAt: z.string(),
  lastSeenAt: z.string().nullable(),
  actif: z.boolean(),
});
export type Appareil = z.infer<typeof appareilSchema>;

// ---- PIN ----

export const pinRequeteSchema = z.object({
  vendeurId: z.string().min(1).max(64),
  pin: z.string().regex(/^\d{4}$/),
});

export const pinReponseSchema = z.object({
  ok: z.literal(true),
  vendeurId: z.string(),
  prenom: z.string(),
});

// ---- Bootstrap ----

export const vendeurBootstrapSchema = z.object({
  id: z.string(),
  prenom: z.string(),
  tauxHoraireCfp: z.number().int(),
  actif: z.boolean(),
  // Hash y sal para verificar el PIN sin red (el PIN nunca viaja ni se guarda en claro).
  pinHash: z.string(),
  pinSalt: z.string(),
});

export const tauxSchema = z.object({
  devise: z.enum(DEVISES),
  cfpParUnite: z.number().positive(),
  source: z.string(),
  date: z.string(),
});

export const bootstrapSchema = z.object({
  cursor: z.number().int().min(0),
  serveurAt: z.string(),
  device: z.object({ id: z.string(), nom: z.string() }),
  categories: z.array(categorieSchema),
  articles: z.array(articleSchema),
  vendeurs: z.array(vendeurBootstrapSchema),
  taux: z.array(tauxSchema),
  settings: z.array(z.object({ key: z.string(), value: z.string() })),
  /** Stock actual por artículo como un movimiento «inventaire» sintético por artículo (id `snap_<articleId>`). */
  mouvements: z.array(mouvementStockSchema),
  journees: z.array(journeeSchema),
  ventes: z.array(venteSchema),
  comptages: z.array(comptageSchema),
  sessions: z.array(sessionTravailSchema),
});
export type Bootstrap = z.infer<typeof bootstrapSchema>;

// ---- Sync ----

export const SYNC_MAX_OPS = 200;

export const syncRequeteSchema = z.object({
  cursor: z.number().int().min(0),
  ops: z.array(opSchema).max(SYNC_MAX_OPS),
});
export type SyncRequete = z.infer<typeof syncRequeteSchema>;

export const syncReponseSchema = z.object({
  acceptes: z.array(z.string()),
  refuses: z.array(z.object({ opId: z.string(), erreur: z.string() })),
  ops: z.array(opSchema),
  cursor: z.number().int().min(0),
  /** Quedan más operaciones por leer: volver a llamar con el nuevo cursor. */
  encore: z.boolean(),
});
export type SyncReponse = z.infer<typeof syncReponseSchema>;
