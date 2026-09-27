// Archivo mensual: volcado completo de las tablas de negocio a R2 (JSON), el día 1 de cada mes.
// D1 Time Travel cubre 30 días; el archivo cubre el resto. Se puede lanzar a mano desde /admin.
import { schema, type Base } from './db';

const TABLES = {
  categories: schema.categories,
  articles: schema.articles,
  article_prix: schema.articlePrix,
  vendeurs: schema.vendeurs,
  devices: schema.devices,
  journees: schema.journees,
  journee_fonds: schema.journeeFonds,
  ventes: schema.ventes,
  vente_lignes: schema.venteLignes,
  vente_paiements: schema.ventePaiements,
  stock_mouvements: schema.stockMouvements,
  comptages_caisse: schema.comptagesCaisse,
  sessions_travail: schema.sessionsTravail,
  paiements_heures: schema.paiementsHeures,
  taux_historique: schema.tauxHistorique,
  settings: schema.settings,
} as const;

export function cleArchive(prefixe: string, mois: string): string {
  return `${prefixe}archives/${mois}.json`;
}

/** Mes AAAA-MM anterior al instante dado (en Nouméa). */
export function moisPrecedent(instant: Date): string {
  const p: Record<string, string> = {};
  for (const x of new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Pacific/Noumea',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(instant))
    p[x.type] = x.value;
  const annee = Number(p.year);
  const mois = Number(p.month);
  return mois === 1 ? `${annee - 1}-12` : `${annee}-${String(mois - 1).padStart(2, '0')}`;
}

export async function archiverMois(env: Env, db: Base, mois: string): Promise<{ cle: string; lignes: number }> {
  const contenu: Record<string, unknown[]> = {};
  let lignes = 0;
  for (const [nom, table] of Object.entries(TABLES)) {
    const rows = await db.select().from(table);
    // Los hashes de PIN y de token no salen de la base.
    contenu[nom] =
      nom === 'vendeurs' || nom === 'devices'
        ? rows.map((r) => ({ ...r, pinHash: undefined, pinSalt: undefined, tokenHash: undefined }))
        : rows;
    lignes += rows.length;
  }
  const cle = cleArchive(env.R2_PREFIX, mois);
  await env.FILES.put(
    cle,
    JSON.stringify({ app: 'mon-stand', mois, archiveAt: new Date().toISOString(), tables: contenu }),
    {
      httpMetadata: { contentType: 'application/json' },
    },
  );
  return { cle, lignes };
}

export async function listerArchives(env: Env): Promise<{ cle: string; taille: number; date: string }[]> {
  const liste = await env.FILES.list({ prefix: `${env.R2_PREFIX}archives/` });
  return liste.objects
    .map((o) => ({ cle: o.key, taille: o.size, date: o.uploaded.toISOString() }))
    .sort((a, b) => b.cle.localeCompare(a.cle));
}
