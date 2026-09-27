// Datos de partida en un teléfono vacío (Fase 3, sin servidor): catálogo v1, una vendedora y las tasas.
// En la Fase 4 el bootstrap del servidor sustituye esta semilla; los ids coinciden.
import { catalogueDefaut, TAUX_HORAIRE_DEFAUT } from '../../shared/domaine/catalogue';
import { dateMetier } from '../../shared/dates';
import { genererSel, hacherPin } from '../../shared/pin';
import { DEVISES_ETRANGERES, TAUX_DEFAUT } from '../../shared/taux';
import { db } from './db';
import { deviceId } from './meta';

export const VENDEUR_DEFAUT_ID = 'vend_1';
const PIN_DEFAUT = '1234';

export async function semerSiVide(): Promise<boolean> {
  if ((await db.articles.count()) > 0) return false;
  const maintenant = new Date().toISOString();
  const { categories, articles, stockInitial } = catalogueDefaut(maintenant);
  const sel = genererSel();
  const pinHash = await hacherPin(PIN_DEFAUT, sel);
  const device = await deviceId();
  await db.transaction(
    'rw',
    [db.categories, db.articles, db.vendeurs, db.mouvements, db.taux, db.settings],
    async () => {
      await db.categories.bulkPut(categories);
      await db.articles.bulkPut(articles);
      await db.vendeurs.put({
        id: VENDEUR_DEFAUT_ID,
        prenom: 'Vendeuse',
        pinHash,
        pinSalt: sel,
        tauxHoraireCfp: TAUX_HORAIRE_DEFAUT,
        actif: true,
      });
      await db.mouvements.bulkPut(
        [...stockInitial].map(([articleId, qty]) => ({
          id: `inv_${articleId}`,
          articleId,
          delta: qty,
          motif: 'inventaire' as const,
          venteId: null,
          vendeurId: VENDEUR_DEFAUT_ID,
          deviceId: device,
          ts: maintenant,
        })),
      );
      await db.taux.bulkPut(
        DEVISES_ETRANGERES.map((devise) => ({
          devise,
          cfpParUnite: TAUX_DEFAUT[devise],
          source: 'defaut',
          date: dateMetier(),
        })),
      );
    },
  );
  return true;
}
