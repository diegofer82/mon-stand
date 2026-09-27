// IndexedDB (Dexie): copia local de los datos y outbox de operaciones pendientes de sincronizar.
import Dexie, { type EntityTable } from 'dexie';

import type {
  Article,
  Categorie,
  ComptageCaisse,
  Journee,
  MouvementStock,
  SessionTravail,
  Taux,
  Vendeur,
  Vente,
} from '../../shared/domaine/types';
import type { Op } from '../../shared/ops';

export interface Setting {
  key: string;
  value: string;
}

export interface EntreeOutbox {
  opId: string;
  op: Op;
  createdAt: string;
  tentatives: number;
  erreur: string | null;
}

export interface Meta {
  key: string;
  value: string;
}

export class MonStandDB extends Dexie {
  categories!: EntityTable<Categorie, 'id'>;
  articles!: EntityTable<Article, 'id'>;
  vendeurs!: EntityTable<Vendeur, 'id'>;
  mouvements!: EntityTable<MouvementStock, 'id'>;
  journees!: EntityTable<Journee, 'id'>;
  ventes!: EntityTable<Vente, 'id'>;
  comptages!: EntityTable<ComptageCaisse, 'id'>;
  sessions!: EntityTable<SessionTravail, 'id'>;
  taux!: EntityTable<Taux, 'devise'>;
  settings!: EntityTable<Setting, 'key'>;
  outbox!: EntityTable<EntreeOutbox, 'opId'>;
  meta!: EntityTable<Meta, 'key'>;

  constructor(nom: string = 'mon-stand') {
    super(nom);
    this.version(1).stores({
      categories: 'id, ordre',
      articles: 'id, categorieId, updatedAt',
      vendeurs: 'id',
      mouvements: 'id, articleId, ts, venteId',
      journees: 'id, dateLocale, clotureeAt, ouverteAt',
      ventes: 'id, journeeId, ts',
      comptages: 'id, journeeId',
      sessions: 'id, vendeurId, debut',
      taux: 'devise',
      settings: 'key',
      outbox: 'opId, createdAt',
      meta: 'key',
    });
  }
}

export const db = new MonStandDB();

export const TABLES_DONNEES = [
  'categories',
  'articles',
  'vendeurs',
  'mouvements',
  'journees',
  'ventes',
  'comptages',
  'sessions',
  'taux',
  'settings',
] as const;
