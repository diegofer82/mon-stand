// Importador «export completo v1 (JSON del teléfono) → SQL para D1». Puro: sin dependencias, sin E/S.
// Idempotente (ids derivados del export, INSERT OR IGNORE): se puede repetir tras una corrección.
// Reglas (plan, Fase 6):
// - ventas v1.4/v1.5: montantEncaisse en CFP; montantDevise, totalDevise y tauxCFP en divisa;
// - ventas v1.3 (sin montantDevise): montantEncaisse está en la divisa del pago y no hay tasa → se acredita el total;
// - cierres v1.3 sin id (clo_legacy_N) y con fecha UTC si se cerraron antes de las 11:00 → fecha recalculada en Nouméa;
// - artículos v1.5: prixDevises (solo precios manuales) → article_prix; el stock del export es la verdad (inventaire).

export interface ExportV1 {
  app?: string;
  type?: string;
  version?: string;
  exportedAt?: string;
  articles: ArticleV1[];
  ventes: VenteV1[];
  sessions: SessionV1[];
  sessionActive?: { debut: string; fin: string | null } | null;
  historique: ClotureV1[];
  rates?: Record<string, number>;
  settings?: { prenom?: string; tauxH?: number; lieu?: string };
}

export interface ArticleV1 {
  id: string;
  nom: string;
  categorie: string;
  prixCFP: number;
  quantite: number;
  promo2eme?: number | null;
  emoji?: string;
  prixDevises?: Record<string, number> | null;
}

export interface VenteV1 {
  id: number | string;
  ts: string;
  articles: { articleId: string; nom: string; qty: number; prixUnit: number; total: number }[];
  sousTotal: number;
  remisePanier: number;
  remiseEncaissement: number;
  total: number;
  montantEncaisse: number;
  devise: string;
  montantDevise?: number;
  totalDevise?: number;
  tauxCFP?: number;
}

export interface SessionV1 {
  id: number | string;
  debut: string;
  fin: string | null;
  dureeMin: number;
  commentaire?: string;
  payee?: boolean;
  paiements?: { id: number; montant: number; date: string }[];
}

export interface ClotureV1 {
  id?: string;
  date: string;
  clotureAt?: string;
  vendeur?: string;
  nbVentes: number;
  totalEncaisse: number;
  ventes: VenteV1[];
  sessions?: SessionV1[];
  stockFinal?: { id: string; nom: string; categorie?: string; quantite: number }[];
}

export interface Requete {
  sql: string;
  params: (string | number | null)[];
}

export interface RapportImport {
  version: string;
  articles: number;
  prixManuels: number;
  journees: {
    id: string;
    date: string;
    nbVentes: number;
    totalEncaisseCfp: number;
    totalEncaisseV1: number;
    ecart: number;
  }[];
  ventes: number;
  ventesV13Devise: number;
  sessions: number;
  taux: number;
  avertissements: string[];
}

const DEVISES = ['CFP', 'AUD', 'NZD', 'USD', 'EUR', 'JPY'];
const CATEGORIES: Record<string, { nom: string; emoji: string; ordre: number }> = {
  bijoux: { nom: 'Bijoux', emoji: '💍', ordre: 1 },
  deco: { nom: 'Déco', emoji: '🪴', ordre: 2 },
  jeux: { nom: 'Jeux', emoji: '♟️', ordre: 3 },
  papeterie: { nom: 'Papeterie', emoji: '🖊️', ordre: 4 },
};
const EMOJI_ARTICLES: Record<string, string> = {
  'collier-100': '📿',
  'collier-200': '📿',
  'collier-300': '📿',
  chaine: '⛓️',
  bracelet: '🧿',
  'bracelet-chaine': '🔗',
  'dessous-verres': '🥂',
  bague: '💍',
  boucles: '👂',
  'porte-cles': '🔑',
  magnet: '🧲',
  broche: '🎀',
  stylo: '🖊️',
  'petite-boite': '📦',
  'grande-boite': '🗃️',
  miroir: '🪞',
  plateau: '🍽️',
  echiquier: '♟️',
  domino: '🁫',
  lezard: '🦎',
  'feuilles-cana': '🌿',
  rond: '⭕',
  lotus: '🪷',
  bourgoir: '🪵',
  'boite-deco': '🎁',
};

export const VENDEUR_ID = 'vend_1';
export const DEVICE_ID = 'dev_serveur';
export const LIEU_DEFAUT = 'Gare maritime';

function arrondir(v: number): number {
  return Math.sign(v) * Math.floor(Math.abs(v) + 0.5);
}

/** Fecha AAAA-MM-DD en Nouméa de un instante ISO. */
export function dateNoumea(iso: string): string {
  const p: Record<string, string> = {};
  for (const x of new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Pacific/Noumea',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(iso)))
    p[x.type] = x.value;
  return `${p.year}-${p.month}-${p.day}`;
}

function insert(table: string, valeurs: Record<string, string | number | null | boolean>): Requete {
  const cles = Object.keys(valeurs);
  return {
    sql: `INSERT OR IGNORE INTO ${table} (${cles.join(', ')}) VALUES (${cles.map(() => '?').join(', ')})`,
    params: cles.map((k) => {
      const v = valeurs[k];
      return typeof v === 'boolean' ? (v ? 1 : 0) : (v ?? null);
    }),
  };
}

function idVente(v: VenteV1, prefixe: string): string {
  return `vte_v1_${prefixe}${String(v.id)}`;
}

export function genererImport(
  exp: ExportV1,
  options: { pinHash: string; pinSalt: string; maintenant?: string },
): { requetes: Requete[]; rapport: RapportImport } {
  const maintenant = options.maintenant ?? new Date().toISOString();
  const requetes: Requete[] = [];
  const avertissements: string[] = [];
  const version = exp.version ?? '?';
  const dateExport = exp.exportedAt ? dateNoumea(exp.exportedAt) : dateNoumea(maintenant);

  // Vendedora, dispositivo «servidor», categorías.
  requetes.push(
    insert('vendeurs', {
      id: VENDEUR_ID,
      prenom: exp.settings?.prenom?.trim() || 'Vendeuse',
      pin_hash: options.pinHash,
      pin_salt: options.pinSalt,
      taux_horaire_cfp: exp.settings?.tauxH && exp.settings.tauxH > 0 ? Math.trunc(exp.settings.tauxH) : 1500,
      actif: true,
      created_at: maintenant,
    }),
    insert('devices', { id: DEVICE_ID, nom: 'Serveur', token_hash: '', created_at: maintenant }),
  );
  const categoriesVues = new Set<string>();
  const categorie = (cle: string) => {
    const id = `cat_${cle}`;
    if (!categoriesVues.has(id)) {
      categoriesVues.add(id);
      const c = CATEGORIES[cle] ?? { nom: cle.charAt(0).toUpperCase() + cle.slice(1), emoji: '', ordre: 9 };
      requetes.push(insert('categories', { id, nom: c.nom, emoji: c.emoji || null, ordre: c.ordre }));
    }
    return id;
  };

  // Artículos, precios manuales y stock (inventaire = cantidad del export).
  let prixManuels = 0;
  const articlesConnus = new Set<string>();
  for (const a of exp.articles) {
    const id = `art_${a.id}`;
    articlesConnus.add(id);
    requetes.push(
      insert('articles', {
        id,
        nom: a.nom,
        categorie_id: categorie(a.categorie || 'deco'),
        emoji: a.emoji ?? EMOJI_ARTICLES[a.id] ?? null,
        prix_cfp: Math.max(0, Math.trunc(a.prixCFP || 0)),
        promo_2eme_pct: a.promo2eme && a.promo2eme > 0 ? Math.trunc(a.promo2eme) : null,
        photo_key: null,
        actif: true,
        updated_at: maintenant,
      }),
    );
    for (const [devise, prix] of Object.entries(a.prixDevises ?? {})) {
      if (!DEVISES.includes(devise) || !(prix > 0)) continue;
      prixManuels++;
      requetes.push(insert('article_prix', { article_id: id, devise, prix, updated_at: maintenant }));
    }
    requetes.push(
      insert('stock_mouvements', {
        id: `mvt_v1_inv_${a.id}`,
        article_id: id,
        delta: Math.trunc(a.quantite || 0),
        motif: 'inventaire',
        vente_id: null,
        vendeur_id: VENDEUR_ID,
        device_id: DEVICE_ID,
        ts: maintenant,
      }),
    );
  }

  // Ventas de un cierre (o del día en curso).
  let nbVentes = 0;
  let ventesV13Devise = 0;
  const importerVente = (v: VenteV1, journeeId: string, prefixe: string): number => {
    const id = idVente(v, prefixe);
    nbVentes++;
    const etranger = v.devise !== 'CFP' && v.devise !== 'TPE';
    let montantDevise: number;
    let montantCfp: number;
    let remiseEncaissement = Math.max(0, Math.trunc(v.remiseEncaissement || 0));
    let totalDevise: number | null = null;
    let tauxCfp: number | null = null;
    if (etranger && v.montantDevise === undefined) {
      // v1.3: lo recibido está en la divisa y no hay tasa; se acredita el total (ajustable a mano si hace falta).
      ventesV13Devise++;
      montantDevise = v.montantEncaisse;
      montantCfp = Math.trunc(v.total);
      remiseEncaissement = 0;
      avertissements.push(
        `Vente ${id} (${v.devise}, v1.3) : ${v.montantEncaisse} ${v.devise} reçus, taux inconnu → créditée au total ${v.total} CFP`,
      );
    } else if (etranger) {
      montantDevise = v.montantDevise ?? 0;
      totalDevise = v.totalDevise ?? null;
      tauxCfp = v.tauxCFP ?? null;
      montantCfp = Math.trunc(v.montantEncaisse);
    } else {
      montantDevise = Math.trunc(v.montantEncaisse);
      montantCfp = Math.trunc(v.montantEncaisse);
    }
    const total = Math.max(0, Math.trunc(v.total));
    requetes.push(
      insert('ventes', {
        id,
        journee_id: journeeId,
        vendeur_id: VENDEUR_ID,
        device_id: DEVICE_ID,
        ts: v.ts,
        sous_total_cfp: Math.trunc(v.sousTotal),
        remise_panier_cfp: Math.max(0, Math.trunc(v.remisePanier || 0)),
        remise_encaissement_cfp: remiseEncaissement,
        total_cfp: total,
        annulee_at: null,
      }),
    );
    v.articles.forEach((l, i) => {
      const articleId = `art_${l.articleId}`;
      if (!articlesConnus.has(articleId)) {
        // Artículo borrado después: se recrea inactivo para no perder la línea.
        articlesConnus.add(articleId);
        avertissements.push(`Article ${articleId} absent du stock : recréé inactif (ligne de la vente ${id})`);
        requetes.push(
          insert('articles', {
            id: articleId,
            nom: l.nom,
            categorie_id: categorie('deco'),
            emoji: null,
            prix_cfp: Math.trunc(l.prixUnit || 0),
            promo_2eme_pct: null,
            photo_key: null,
            actif: false,
            updated_at: maintenant,
          }),
        );
      }
      requetes.push(
        insert('vente_lignes', {
          id: `${id}_l${i}`,
          vente_id: id,
          article_id: articleId,
          nom_snapshot: l.nom,
          qty: Math.trunc(l.qty),
          prix_unit_cfp: Math.trunc(l.prixUnit),
          total_cfp: Math.trunc(l.total),
        }),
      );
    });
    requetes.push(
      insert('vente_paiements', {
        id: `${id}_p0`,
        vente_id: id,
        devise: DEVISES.includes(v.devise) || v.devise === 'TPE' ? v.devise : 'CFP',
        montant_devise: montantDevise,
        total_devise: totalDevise,
        taux_cfp: tauxCfp,
        montant_cfp: montantCfp,
        rendu_montant: null,
        rendu_devise: null,
      }),
    );
    return montantCfp;
  };

  const importerSession = (s: SessionV1, quand: string): void => {
    const paye = (s.paiements ?? []).reduce((t, p) => t + (p.montant || 0), 0);
    const payee = s.payee === true || (s.payee === undefined && paye > 0);
    requetes.push(
      insert('sessions_travail', {
        id: `ses_v1_${String(s.id)}`,
        vendeur_id: VENDEUR_ID,
        debut: s.debut,
        fin: s.fin,
        duree_min: s.fin ? Math.trunc(s.dureeMin || 0) : null,
        commentaire: s.commentaire?.trim() || null,
        payee_at: payee ? quand : null,
      }),
    );
  };

  // Cierres → jornadas cerradas.
  const journees: RapportImport['journees'] = [];
  exp.historique.forEach((h, i) => {
    const cloId = h.id ?? `clo_legacy_${i}`;
    const journeeId = `jour_v1_${cloId}`;
    const tsVentes = h.ventes.map((v) => v.ts).sort();
    const premiereVente = tsVentes[0];
    const derniereVente = tsVentes[tsVentes.length - 1];
    // La «date» de un cierre v1 es la del momento del cierre (en UTC, y la v1.3 no guarda `clotureAt`): un
    // cierre hecho en casa dos días después llevaba la fecha equivocada. El día de mercado es el de las ventas.
    const date = premiereVente ? dateNoumea(premiereVente) : h.clotureAt ? dateNoumea(h.clotureAt) : h.date;
    if (date !== h.date) avertissements.push(`Clôture ${cloId} : date ${h.date} (v1) → ${date} (Nouméa)`);
    // Sin `clotureAt` se supone un cierre a las 17:00 de Nouméa del día registrado, nunca antes de la última venta.
    let clotureAt = h.clotureAt ?? `${h.date}T06:00:00.000Z`;
    if (derniereVente && clotureAt < derniereVente) clotureAt = derniereVente;
    requetes.push(
      insert('journees', {
        id: journeeId,
        date_locale: date,
        lieu: exp.settings?.lieu?.trim() || LIEU_DEFAUT,
        vendeur_id: VENDEUR_ID,
        fond_caisse_cfp: null,
        ouverte_at: premiereVente ?? clotureAt,
        cloturee_at: clotureAt,
        commentaire_cloture: `Importée de la v${version} (${cloId})`,
        pdf_key: null,
      }),
    );
    let totalCfp = 0;
    for (const v of h.ventes) totalCfp += importerVente(v, journeeId, `${cloId}_`);
    for (const s of h.sessions ?? []) importerSession(s, clotureAt);
    journees.push({
      id: journeeId,
      date,
      nbVentes: h.ventes.length,
      totalEncaisseCfp: totalCfp,
      totalEncaisseV1: h.totalEncaisse,
      ecart: totalCfp - h.totalEncaisse,
    });
  });

  // Ventas del día en curso (sin cierre) → jornada abierta.
  if (exp.ventes.length > 0) {
    const premiere = [...exp.ventes].map((v) => v.ts).sort()[0] ?? maintenant;
    const journeeId = 'jour_v1_en_cours';
    requetes.push(
      insert('journees', {
        id: journeeId,
        date_locale: dateNoumea(premiere),
        lieu: exp.settings?.lieu?.trim() || LIEU_DEFAUT,
        vendeur_id: VENDEUR_ID,
        fond_caisse_cfp: null,
        ouverte_at: premiere,
        cloturee_at: null,
        commentaire_cloture: null,
        pdf_key: null,
      }),
    );
    let totalCfp = 0;
    for (const v of exp.ventes) totalCfp += importerVente(v, journeeId, 'cours_');
    journees.push({
      id: journeeId,
      date: dateNoumea(premiere),
      nbVentes: exp.ventes.length,
      totalEncaisseCfp: totalCfp,
      totalEncaisseV1: totalCfp,
      ecart: 0,
    });
    avertissements.push(
      `${exp.ventes.length} vente(s) sans clôture dans l’export : jornada « en cours » ouverte, à clôturer depuis l’app`,
    );
  }
  for (const s of exp.sessions) importerSession(s, maintenant);
  if (exp.sessionActive?.debut)
    importerSession(
      { id: `active_${exp.sessionActive.debut}`, debut: exp.sessionActive.debut, fin: null, dureeMin: 0 },
      maintenant,
    );

  // Tasas del export.
  let taux = 0;
  for (const [devise, valeur] of Object.entries(exp.rates ?? {})) {
    if (!DEVISES.includes(devise) || devise === 'CFP' || !(valeur > 0)) continue;
    taux++;
    requetes.push(
      insert('taux_historique', {
        devise,
        date: dateExport,
        cfp_par_unite: devise === 'EUR' ? 119.332 : arrondir(valeur * 10000) / 10000,
        source: `import-v${version}`,
      }),
    );
  }

  const sessionsImportees = requetes.filter((r) => r.sql.startsWith('INSERT OR IGNORE INTO sessions_travail')).length;
  return {
    requetes,
    rapport: {
      version,
      articles: exp.articles.length,
      prixManuels,
      journees,
      ventes: nbVentes,
      ventesV13Devise,
      sessions: sessionsImportees,
      taux,
      avertissements,
    },
  };
}

/** SQL con los parámetros incrustados (para `wrangler d1 execute --file`). */
export function versSql(requetes: Requete[]): string {
  const litteral = (v: string | number | null) =>
    v === null ? 'NULL' : typeof v === 'number' ? String(v) : `'${v.replace(/'/g, "''")}'`;
  return requetes
    .map((r) => {
      let i = 0;
      return r.sql.replace(/\?/g, () => litteral(r.params[i++] ?? null)) + ';';
    })
    .join('\n');
}
