// Cliente de sincronización: emparejamiento, bootstrap, push del outbox y pull de las operaciones de los demás.
// Reglas (skill «gestes hors ligne»): solo un 2xx o un 4xx explícito retiran una entrada del outbox; una sola
// sincronización en vuelo; se dispara al arrancar, al volver la red, al volver a primer plano y tras cada acción.
import {
  bootstrapSchema,
  syncReponseSchema,
  type AppairageReponse,
  type Bootstrap,
  type ErreurApi,
  type SyncReponse,
} from '../../shared/api';
import { SYNC_MAX_OPS } from '../../shared/api';
import { appliquerOp } from '../db/appliquer';
import { db, TABLES_DONNEES } from '../db/db';
import { ecrireMeta, lireMeta, oublierDeviceId } from '../db/meta';
import { t } from '../textes/fr';

export type EtatSync = 'online' | 'syncing' | 'offline' | 'error' | 'revoque';

export interface StatutSync {
  etat: EtatSync;
  derniereSync: string | null;
  erreur: string | null;
}

export const EVENEMENT_OUTBOX = 'mon-stand:outbox';
const INTERVALLE_MS = 60_000;
const MAX_TENTATIVES = 3;
const DELAI_APRES_ACTION_MS = 800;

let statut: StatutSync = { etat: navigator.onLine ? 'online' : 'offline', derniereSync: null, erreur: null };
const abonnes = new Set<() => void>();
let enVol: Promise<void> | null = null;
let relancer = false;
let minuteur = 0;
let demarre = false;

function publier(partiel: Partial<StatutSync>) {
  statut = { ...statut, ...partiel };
  abonnes.forEach((f) => f());
}

export function lireStatut(): StatutSync {
  return statut;
}

export function abonner(f: () => void): () => void {
  abonnes.add(f);
  return () => {
    abonnes.delete(f);
  };
}

export class ErreurReseau extends Error {}
export class ErreurApiClient extends Error {
  constructor(
    public statutHttp: number,
    public code: ErreurApi['erreur']['code'] | 'inconnu',
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

async function appel<T>(chemin: string, init: RequestInit & { token?: string | null } = {}): Promise<T> {
  const { token, ...reste } = init;
  const headers = new Headers(reste.headers);
  if (reste.body) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  let reponse: Response;
  try {
    reponse = await fetch(chemin, { ...reste, headers });
  } catch {
    throw new ErreurReseau('Serveur injoignable');
  }
  if (!reponse.ok) {
    let corps: Partial<ErreurApi> = {};
    try {
      corps = (await reponse.json()) as Partial<ErreurApi>;
    } catch {
      /* sin cuerpo JSON */
    }
    throw new ErreurApiClient(
      reponse.status,
      corps.erreur?.code ?? 'inconnu',
      corps.erreur?.message ?? `Erreur ${reponse.status}`,
      corps.erreur?.details,
    );
  }
  return (await reponse.json()) as T;
}

export async function tokenAppareil(): Promise<string | null> {
  return lireMeta('deviceToken');
}

// ---- Emparejamiento y bootstrap ----

export async function appairer(code: string, nom: string): Promise<void> {
  const r = await appel<AppairageReponse>('/api/devices/pair', { method: 'POST', body: JSON.stringify({ code, nom }) });
  // La instantánea se pide con el token recibido antes de guardarlo. Mientras el token no está en la base,
  // la sincronización no arranca y no puede aplicar el diario encima del bootstrap (stock contado dos
  // veces); y si la instantánea falla, el teléfono sigue sin emparejar en vez de quedar a medias.
  let instantane: Bootstrap;
  try {
    instantane = await chargerInstantane(r.token);
  } catch (e) {
    if (e instanceof ErreurReseau || e instanceof ErreurApiClient) throw e;
    throw new Error(t.appairage.bootstrapEchoue, { cause: e });
  }
  await db.transaction('rw', db.tables, async () => {
    // Lo que hubiera en el outbox pertenece a una identidad anterior del teléfono: el servidor lo rechazaría.
    await db.outbox.clear();
    await ecrireInstantane(instantane);
    await ecrireMeta('deviceId', r.deviceId);
    await ecrireMeta('deviceNom', r.nom);
    await ecrireMeta('revoque', '');
    await ecrireMeta('deviceToken', r.token);
  });
  oublierDeviceId();
  publier({ etat: 'online', erreur: null });
}

async function chargerInstantane(token: string): Promise<Bootstrap> {
  const brut = await appel<unknown>('/api/bootstrap', { token });
  return bootstrapSchema.parse(brut);
}

/** Reemplaza todos los datos locales por la instantánea. Se llama dentro de una transacción `rw`. */
async function ecrireInstantane(b: Bootstrap): Promise<void> {
  for (const table of TABLES_DONNEES) await db.table(table).clear();
  await db.categories.bulkPut(b.categories);
  await db.articles.bulkPut(b.articles);
  await db.vendeurs.bulkPut(b.vendeurs);
  await db.mouvements.bulkPut(b.mouvements);
  await db.journees.bulkPut(b.journees);
  await db.ventes.bulkPut(b.ventes);
  await db.comptages.bulkPut(b.comptages);
  await db.sessions.bulkPut(b.sessions);
  await db.taux.bulkPut(b.taux);
  await db.settings.bulkPut(b.settings);
  await ecrireMeta('cursor', String(b.cursor));
  await ecrireMeta('deviceNom', b.device.nom);
  await ecrireMeta('bootstrapAt', b.serveurAt);
}

/** Carga la instantánea del servidor: reemplaza todos los datos locales (el outbox debe estar vacío). */
export async function bootstrap(): Promise<void> {
  const token = await tokenAppareil();
  if (!token) return;
  const b = await chargerInstantane(token);
  await db.transaction('rw', db.tables, () => ecrireInstantane(b));
}

/** Olvida el emparejamiento y borra los datos locales (solo con el outbox vacío). Vuelve a la pantalla de código. */
export async function desappairer(): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) await table.clear();
  });
  oublierDeviceId();
  publier({ etat: navigator.onLine ? 'online' : 'offline', derniereSync: null, erreur: null });
}

// ---- Push / pull ----

async function unTour(token: string): Promise<boolean> {
  const cursor = Number((await lireMeta('cursor')) ?? '0');
  // Una operación rechazada varias veces se deja de reenviar (queda visible como error, no se pierde).
  const entrees = (await db.outbox.orderBy('createdAt').toArray())
    .filter((e) => e.tentatives < MAX_TENTATIVES)
    .slice(0, SYNC_MAX_OPS);
  const r: SyncReponse = syncReponseSchema.parse(
    await appel<unknown>('/api/sync', {
      method: 'POST',
      token,
      body: JSON.stringify({ cursor, ops: entrees.map((e) => e.op) }),
    }),
  );
  await db.transaction('rw', db.tables, async () => {
    if (r.acceptes.length) await db.outbox.bulkDelete(r.acceptes);
    for (const ref of r.refuses) {
      const e = await db.outbox.get(ref.opId);
      if (e) await db.outbox.put({ ...e, tentatives: e.tentatives + 1, erreur: ref.erreur });
    }
    for (const op of r.ops) await appliquerOp(op);
    await ecrireMeta('cursor', String(r.cursor));
  });
  if (r.refuses.length) {
    console.warn('sync: opérations refusées', r.refuses);
    publier({ erreur: `${r.refuses.length} opération(s) refusée(s) par le serveur` });
  }
  // Otro turno solo si el servidor tiene más que dar o si quedan operaciones aún no enviadas.
  const restantes = await db.outbox.filter((e) => e.tentatives < MAX_TENTATIVES).count();
  return r.encore || (r.acceptes.length > 0 && restantes > 0);
}

export async function synchroniser(): Promise<void> {
  if (enVol) {
    relancer = true;
    return enVol;
  }
  enVol = (async () => {
    const token = await tokenAppareil();
    if (!token) return;
    if (!navigator.onLine) {
      publier({ etat: 'offline' });
      return;
    }
    publier({ etat: 'syncing' });
    try {
      let encore = true;
      let tours = 0;
      while (encore && tours < 20) {
        encore = await unTour(token);
        tours++;
      }
      publier({
        etat: 'online',
        derniereSync: new Date().toISOString(),
        erreur: statut.erreur?.includes('refusée') ? statut.erreur : null,
      });
    } catch (e) {
      if (e instanceof ErreurReseau) publier({ etat: 'offline' });
      else if (e instanceof ErreurApiClient && e.statutHttp === 401) {
        await ecrireMeta('revoque', '1');
        publier({ etat: 'revoque', erreur: e.message });
      } else {
        console.error('sync', e);
        publier({ etat: 'error', erreur: e instanceof Error ? e.message : 'Erreur' });
      }
    }
  })().finally(() => {
    enVol = null;
    if (relancer) {
      relancer = false;
      planifier(DELAI_APRES_ACTION_MS);
    }
  });
  return enVol;
}

export function planifier(delaiMs: number = DELAI_APRES_ACTION_MS): void {
  window.clearTimeout(minuteur);
  minuteur = window.setTimeout(() => void synchroniser(), delaiMs);
}

/** Instala los disparadores (una sola vez). */
export function demarrerSync(): void {
  if (demarre) return;
  demarre = true;
  window.addEventListener('online', () => {
    publier({ etat: 'online' });
    planifier(0);
  });
  window.addEventListener('offline', () => publier({ etat: 'offline' }));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) planifier(0);
  });
  window.addEventListener('pageshow', () => planifier(0));
  window.addEventListener(EVENEMENT_OUTBOX, () => planifier());
  window.setInterval(() => {
    if (!document.hidden) planifier(0);
  }, INTERVALLE_MS);
  planifier(0);
}
