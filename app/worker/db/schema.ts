// Esquema D1 (plan §2 + lo que añadió la validación del diseño).
// Convenciones: importes en enteros CFP; ids UUID generados en el dispositivo; instantes en ISO 8601 UTC;
// fechas de negocio (date_locale) en Pacific/Noumea, formato AAAA-MM-DD.
import { sql } from 'drizzle-orm';
import { index, integer, primaryKey, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const DEVISES = ['CFP', 'AUD', 'NZD', 'USD', 'EUR', 'JPY'] as const;
export const MODES_PAIEMENT = [...DEVISES, 'TPE'] as const;
export const MOTIFS_STOCK = ['vente', 'ajustement', 'reassort', 'annulation', 'inventaire'] as const;

const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

export const vendeurs = sqliteTable('vendeurs', {
  id: text('id').primaryKey(),
  prenom: text('prenom').notNull(),
  pinHash: text('pin_hash').notNull(),
  pinSalt: text('pin_salt').notNull(),
  tauxHoraireCfp: integer('taux_horaire_cfp').notNull().default(0),
  actif: integer('actif', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default(now),
});

export const devices = sqliteTable('devices', {
  id: text('id').primaryKey(),
  nom: text('nom').notNull(),
  tokenHash: text('token_hash').notNull(),
  vendeurId: text('vendeur_id').references(() => vendeurs.id),
  createdAt: text('created_at').notNull().default(now),
  lastSeenAt: text('last_seen_at'),
});

export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  nom: text('nom').notNull(),
  emoji: text('emoji'),
  ordre: integer('ordre').notNull().default(0),
});

export const articles = sqliteTable(
  'articles',
  {
    id: text('id').primaryKey(),
    nom: text('nom').notNull(),
    categorieId: text('categorie_id')
      .notNull()
      .references(() => categories.id),
    // Validación del diseño: un emoji por artículo para reconocerlo en la caja hasta que haya fotos.
    emoji: text('emoji'),
    prixCfp: integer('prix_cfp').notNull(),
    promo2emePct: integer('promo_2eme_pct'),
    photoKey: text('photo_key'),
    actif: integer('actif', { mode: 'boolean' }).notNull().default(true),
    updatedAt: text('updated_at').notNull().default(now),
  },
  (t) => [index('articles_categorie_idx').on(t.categorieId)],
);

// Precio manual por divisa; sin fila = precio calculado (regla v1.5).
export const articlePrix = sqliteTable(
  'article_prix',
  {
    articleId: text('article_id')
      .notNull()
      .references(() => articles.id),
    devise: text('devise', { enum: DEVISES }).notNull(),
    prix: real('prix').notNull(),
    updatedAt: text('updated_at').notNull().default(now),
  },
  (t) => [primaryKey({ columns: [t.articleId, t.devise] })],
);

export const journees = sqliteTable(
  'journees',
  {
    id: text('id').primaryKey(),
    dateLocale: text('date_locale').notNull(),
    lieu: text('lieu').notNull(),
    vendeurId: text('vendeur_id')
      .notNull()
      .references(() => vendeurs.id),
    // Validación del diseño: el conteo de caja compara con fondo de caja + efectivo neto.
    fondCaisseCfp: integer('fond_caisse_cfp'),
    ouverteAt: text('ouverte_at').notNull(),
    clotureeAt: text('cloturee_at'),
    commentaireCloture: text('commentaire_cloture'),
    pdfKey: text('pdf_key'),
  },
  (t) => [index('journees_date_idx').on(t.dateLocale)],
);

export const ventes = sqliteTable(
  'ventes',
  {
    id: text('id').primaryKey(),
    journeeId: text('journee_id')
      .notNull()
      .references(() => journees.id),
    vendeurId: text('vendeur_id')
      .notNull()
      .references(() => vendeurs.id),
    deviceId: text('device_id')
      .notNull()
      .references(() => devices.id),
    ts: text('ts').notNull(),
    sousTotalCfp: integer('sous_total_cfp').notNull(),
    remisePanierCfp: integer('remise_panier_cfp').notNull().default(0),
    remiseEncaissementCfp: integer('remise_encaissement_cfp').notNull().default(0),
    totalCfp: integer('total_cfp').notNull(),
    annuleeAt: text('annulee_at'),
  },
  (t) => [index('ventes_journee_idx').on(t.journeeId)],
);

export const venteLignes = sqliteTable(
  'vente_lignes',
  {
    id: text('id').primaryKey(),
    venteId: text('vente_id')
      .notNull()
      .references(() => ventes.id),
    articleId: text('article_id')
      .notNull()
      .references(() => articles.id),
    nomSnapshot: text('nom_snapshot').notNull(),
    qty: integer('qty').notNull(),
    prixUnitCfp: integer('prix_unit_cfp').notNull(),
    totalCfp: integer('total_cfp').notNull(),
  },
  (t) => [index('vente_lignes_vente_idx').on(t.venteId), index('vente_lignes_article_idx').on(t.articleId)],
);

// Una fila por pago: permite el pago mixto. montant_cfp = lo acreditado en CFP (sin la monnaie).
export const ventePaiements = sqliteTable(
  'vente_paiements',
  {
    id: text('id').primaryKey(),
    venteId: text('vente_id')
      .notNull()
      .references(() => ventes.id),
    devise: text('devise', { enum: MODES_PAIEMENT }).notNull(),
    montantDevise: real('montant_devise').notNull(),
    totalDevise: real('total_devise'),
    tauxCfp: real('taux_cfp'),
    montantCfp: integer('montant_cfp').notNull(),
    // Monnaie devuelta y en qué divisa (pendiente de confirmar con la vendedora: AUD o CFP).
    renduMontant: real('rendu_montant'),
    renduDevise: text('rendu_devise', { enum: DEVISES }),
  },
  (t) => [index('vente_paiements_vente_idx').on(t.venteId)],
);

// Stock = suma de movimientos: dos teléfonos sin red nunca se pisan.
export const stockMouvements = sqliteTable(
  'stock_mouvements',
  {
    id: text('id').primaryKey(),
    articleId: text('article_id')
      .notNull()
      .references(() => articles.id),
    delta: integer('delta').notNull(),
    motif: text('motif', { enum: MOTIFS_STOCK }).notNull(),
    venteId: text('vente_id').references(() => ventes.id),
    vendeurId: text('vendeur_id')
      .notNull()
      .references(() => vendeurs.id),
    deviceId: text('device_id')
      .notNull()
      .references(() => devices.id),
    ts: text('ts').notNull(),
  },
  (t) => [index('stock_mouvements_article_idx').on(t.articleId)],
);

export const comptagesCaisse = sqliteTable(
  'comptages_caisse',
  {
    id: text('id').primaryKey(),
    journeeId: text('journee_id')
      .notNull()
      .references(() => journees.id),
    devise: text('devise', { enum: MODES_PAIEMENT }).notNull(),
    attendu: real('attendu').notNull(),
    compte: real('compte').notNull(),
    ecart: real('ecart').notNull(),
  },
  (t) => [index('comptages_journee_idx').on(t.journeeId)],
);

export const sessionsTravail = sqliteTable(
  'sessions_travail',
  {
    id: text('id').primaryKey(),
    vendeurId: text('vendeur_id')
      .notNull()
      .references(() => vendeurs.id),
    debut: text('debut').notNull(),
    fin: text('fin'),
    dureeMin: integer('duree_min'),
    commentaire: text('commentaire'),
    payeeAt: text('payee_at'),
  },
  (t) => [index('sessions_vendeur_idx').on(t.vendeurId)],
);

export const paiementsHeures = sqliteTable('paiements_heures', {
  id: text('id').primaryKey(),
  vendeurId: text('vendeur_id')
    .notNull()
    .references(() => vendeurs.id),
  montantCfp: integer('montant_cfp').notNull(),
  date: text('date').notNull(),
  note: text('note'),
});

export const tauxHistorique = sqliteTable(
  'taux_historique',
  {
    devise: text('devise', { enum: DEVISES }).notNull(),
    date: text('date').notNull(),
    cfpParUnite: real('cfp_par_unite').notNull(),
    source: text('source').notNull(),
  },
  (t) => [primaryKey({ columns: [t.devise, t.date] })],
);

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

// Idempotencia de la sincronización: una operación reenviada no se aplica dos veces.
export const syncOps = sqliteTable('sync_ops', {
  opId: text('op_id').primaryKey(),
  deviceId: text('device_id').notNull(),
  receivedAt: text('received_at').notNull().default(now),
});
