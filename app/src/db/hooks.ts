// Lecturas reactivas de IndexedDB (dexie-react-hooks): la pantalla se repinta cuando cambian los datos.
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';

import { dateMetier } from '../../shared/dates';
import { debutFenetreVentes, quantites, unitesVendues } from '../../shared/domaine/stock';
import type {
  Article,
  Categorie,
  Journee,
  SessionTravail,
  TableTaux,
  Vendeur,
  Vente,
} from '../../shared/domaine/types';
import { tableTauxComplete } from '../../shared/taux';
import { db } from './db';

const VIDE: never[] = [];

export function useCategories(): Categorie[] {
  return useLiveQuery(() => db.categories.orderBy('ordre').toArray(), [], VIDE);
}

export function useArticles(): Article[] {
  return useLiveQuery(() => db.articles.toArray(), [], VIDE);
}

export function useArticlesMap(): Map<string, Article> {
  const articles = useArticles();
  return useMemo(() => new Map(articles.map((a) => [a.id, a])), [articles]);
}

/** Cantidad por artículo, suma de todos los movimientos. */
export function useQuantites(): Map<string, number> {
  const mouvements = useLiveQuery(() => db.mouvements.toArray(), [], VIDE);
  return useMemo(() => quantites(mouvements), [mouvements]);
}

/** Unidades vendidas en los últimos 30 días, para el orden de la caja. Fijo mientras dure la jornada. */
export function useVendues30j(journeeId: string | null): Map<string, number> {
  const ventes = useLiveQuery(
    () => db.ventes.where('ts').aboveOrEqual(debutFenetreVentes(new Date())).toArray(),
    // Se recalcula solo al cambiar de jornada: las fichas no se mueven bajo el dedo.
    [journeeId],
    VIDE,
  );
  return useMemo(() => unitesVendues(ventes), [ventes]);
}

export function useVendeurs(): Vendeur[] {
  return useLiveQuery(() => db.vendeurs.toArray(), [], VIDE);
}

export function useVendeur(id: string | null): Vendeur | undefined {
  return useLiveQuery(() => (id ? db.vendeurs.get(id) : undefined), [id]);
}

/** La jornada abierta (sin clôture), si la hay: la más reciente. */
export function useJourneeOuverte(): Journee | null | undefined {
  return useLiveQuery(async () => {
    const ouvertes = await db.journees.filter((j) => j.clotureeAt === null).toArray();
    ouvertes.sort((a, b) => b.ouverteAt.localeCompare(a.ouverteAt));
    return ouvertes[0] ?? null;
  }, []);
}

export function useJourneesCloturees(): Journee[] {
  return useLiveQuery(
    async () => {
      const j = await db.journees.filter((x) => x.clotureeAt !== null).toArray();
      return j.sort((a, b) => (b.clotureeAt ?? '').localeCompare(a.clotureeAt ?? ''));
    },
    [],
    VIDE,
  );
}

export function useVentesJournee(journeeId: string | null): Vente[] {
  return useLiveQuery(
    async () =>
      journeeId
        ? (await db.ventes.where('journeeId').equals(journeeId).toArray()).sort((a, b) => b.ts.localeCompare(a.ts))
        : [],
    [journeeId],
    VIDE,
  );
}

export function useComptages(journeeId: string | null) {
  return useLiveQuery(
    () => (journeeId ? db.comptages.where('journeeId').equals(journeeId).toArray() : []),
    [journeeId],
    VIDE,
  );
}

export function useTaux(): TableTaux & Record<string, number> {
  const lignes = useLiveQuery(() => db.taux.toArray(), [], VIDE);
  return useMemo(() => tableTauxComplete(Object.fromEntries(lignes.map((l) => [l.devise, l.cfpParUnite]))), [lignes]);
}

export function useTauxDetail() {
  return useLiveQuery(() => db.taux.toArray(), [], VIDE);
}

export function useSessions(vendeurId: string | null): SessionTravail[] {
  return useLiveQuery(
    async () =>
      vendeurId
        ? (await db.sessions.where('vendeurId').equals(vendeurId).toArray()).sort((a, b) =>
            b.debut.localeCompare(a.debut),
          )
        : [],
    [vendeurId],
    VIDE,
  );
}

export function useSessionEnCours(vendeurId: string | null): SessionTravail | null {
  const sessions = useSessions(vendeurId);
  return sessions.find((s) => s.fin === null) ?? null;
}

export function useSetting(key: string): string | null | undefined {
  return useLiveQuery(async () => (await db.settings.get(key))?.value ?? null, [key]);
}

export function useOutboxCount(): number {
  return useLiveQuery(() => db.outbox.count(), [], 0);
}

/** Fecha de negocio de hoy, refrescada cuando cambia (una jornada abierta ayer sigue siendo «de ayer»). */
export function dateDuJour(): string {
  return dateMetier(new Date());
}
