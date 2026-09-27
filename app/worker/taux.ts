// Tasas de cambio: cron diario. Base EUR (BCE vía Frankfurter, secours open.er-api) × paridad del CFP.
// Resultado: KV (última tabla), taux_historique y una operación taux.definir por divisa en el diario,
// para que cada teléfono reciba las tasas del día en su siguiente pull.
import { dateMetier } from '../shared/dates';
import { cfpParUniteDepuisEur, DEVISES_ETRANGERES } from '../shared/taux';
import type { Devise } from '../shared/montants';
import type { Op } from '../shared/ops';
import { type Base } from './db';
import { DEVICE_SERVEUR_ID } from './semence';
import { appliquerOpD1 } from './sync/appliquer';

export const CLE_KV_TAUX = 'taux:latest';

export interface TableTauxKv {
  date: string;
  source: string;
  majAt: string;
  /** CFP por unidad, por divisa. */
  taux: Partial<Record<Devise, number>>;
}

type Fetch = typeof fetch;

const A_RECUPERER = DEVISES_ETRANGERES.filter((d) => d !== 'EUR');

/** Devuelve «unidades de divisa por 1 EUR» de la primera fuente que responda con todas las divisas. */
export async function recupererTauxEur(
  fetchImpl: Fetch = fetch,
): Promise<{ source: string; rates: Record<string, number> }> {
  const sources: { source: string; url: string }[] = [
    { source: 'bce', url: `https://api.frankfurter.dev/v1/latest?base=EUR&symbols=${A_RECUPERER.join(',')}` },
    { source: 'open.er-api', url: 'https://open.er-api.com/v6/latest/EUR' },
  ];
  const erreurs: string[] = [];
  for (const s of sources) {
    try {
      const r = await fetchImpl(s.url, { headers: { Accept: 'application/json' } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const corps = await r.json<{ rates?: Record<string, number> }>();
      const rates = corps.rates ?? {};
      if (A_RECUPERER.every((d) => typeof rates[d] === 'number' && rates[d] > 0)) return { source: s.source, rates };
      throw new Error('divisas incompletas');
    } catch (e) {
      erreurs.push(`${s.source}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  throw new Error(`Aucune source de taux disponible (${erreurs.join(' · ')})`);
}

export async function actualiserTaux(env: Env, db: Base, fetchImpl: Fetch = fetch): Promise<TableTauxKv> {
  const { source, rates } = await recupererTauxEur(fetchImpl);
  const maintenant = new Date();
  const date = dateMetier(maintenant);
  const taux: Partial<Record<Devise, number>> = {};
  for (const d of A_RECUPERER) taux[d] = cfpParUniteDepuisEur(rates[d] ?? 0);
  const table: TableTauxKv = { date, source, majAt: maintenant.toISOString(), taux };
  await env.TAUX.put(CLE_KV_TAUX, JSON.stringify(table));
  // Una operación por divisa: se anota en taux_historique y en el diario (los teléfonos la reciben en el pull).
  for (const d of A_RECUPERER) {
    const op: Op = {
      opId: crypto.randomUUID(),
      deviceId: DEVICE_SERVEUR_ID,
      vendeurId: null,
      ts: table.majAt,
      type: 'taux.definir',
      devise: d,
      cfpParUnite: taux[d] ?? 0,
      source,
      date,
    };
    await appliquerOpD1(db, op);
  }
  return table;
}
