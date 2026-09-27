// Datos de partida en una D1 vacía: catálogo v1, stock inicial, una vendedora «Vendeuse» (PIN 1234, a cambiar)
// y las tasas por defecto. Mismos ids que la semilla del teléfono de la Fase 3 y que el importador de la Fase 6.
import { dateMetier } from '../shared/dates';
import { catalogueDefaut, TAUX_HORAIRE_DEFAUT } from '../shared/domaine/catalogue';
import { genererSel, hacherPin } from '../shared/pin';
import { DEVISES_ETRANGERES, TAUX_DEFAUT } from '../shared/taux';
import { schema, type Base } from './db';
import { morceaux } from './db/morceaux';

export const VENDEUR_DEFAUT_ID = 'vend_1';
export const DEVICE_SERVEUR_ID = 'dev_serveur';
const PIN_DEFAUT = '1234';

/** Siembra la base si no tiene artículos. Devuelve true si sembró. */
export async function semerSiVide(db: Base): Promise<boolean> {
  const existant = await db.select({ id: schema.articles.id }).from(schema.articles).limit(1);
  if (existant.length > 0) return false;
  const maintenant = new Date().toISOString();
  const { categories, articles, stockInitial } = catalogueDefaut(maintenant);
  const sel = genererSel();
  const pinHash = await hacherPin(PIN_DEFAUT, sel);
  const mouvements = [...stockInitial].map(([articleId, qty]) => ({
    id: `inv_${articleId}`,
    articleId,
    delta: qty,
    motif: 'inventaire' as const,
    venteId: null,
    vendeurId: VENDEUR_DEFAUT_ID,
    deviceId: DEVICE_SERVEUR_ID,
    ts: maintenant,
  }));
  await db.batch([
    db
      .insert(schema.vendeurs)
      .values({
        id: VENDEUR_DEFAUT_ID,
        prenom: 'Vendeuse',
        pinHash,
        pinSalt: sel,
        tauxHoraireCfp: TAUX_HORAIRE_DEFAUT,
        actif: true,
      })
      .onConflictDoNothing(),
    // Dispositivo «servidor» para los movimientos que no nacen en un teléfono (semilla, importación).
    db.insert(schema.devices).values({ id: DEVICE_SERVEUR_ID, nom: 'Serveur', tokenHash: '' }).onConflictDoNothing(),
    db.insert(schema.categories).values(categories).onConflictDoNothing(),
    ...morceaux(
      articles.map(({ prixDevises: _p, ...a }) => a),
      9,
    ).map((m) => db.insert(schema.articles).values(m).onConflictDoNothing()),
    ...morceaux(mouvements, 8).map((m) => db.insert(schema.stockMouvements).values(m).onConflictDoNothing()),
    db
      .insert(schema.tauxHistorique)
      .values(
        DEVISES_ETRANGERES.map((devise) => ({
          devise,
          date: dateMetier(),
          cfpParUnite: TAUX_DEFAUT[devise],
          source: 'defaut',
        })),
      )
      .onConflictDoNothing(),
  ]);
  return true;
}
