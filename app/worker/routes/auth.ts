// PIN de vendedora verificado en el servidor (PBKDF2), con 5 intentos por minuto y por teléfono.
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';

import { pinRequeteSchema } from '../../shared/api';
import { verifierPin } from '../../shared/pin';
import { effacerEssais, erreur, lireEssais, noterEchec, type AppEnv } from '../auth';
import { schema } from '../db';

export const auth = new Hono<AppEnv>();

auth.post('/pin', async (c) => {
  const corps = pinRequeteSchema.safeParse(await c.req.json().catch(() => null));
  if (!corps.success) return erreur(c, 400, 'requete_invalide', 'Vendeuse et PIN à 4 chiffres requis');
  const db = c.get('db');
  const appareil = c.get('appareil');
  const cle = `pin:${appareil.id}:${corps.data.vendeurId}`;
  const maintenant = new Date();
  const etat = await lireEssais(db, cle, maintenant);
  if (etat.bloque) {
    c.header('Retry-After', String(etat.reessayerDansS));
    return erreur(c, 429, 'trop_d_essais', `Trop d’essais. Réessayez dans ${etat.reessayerDansS} s.`, {
      reessayerDansS: etat.reessayerDansS,
    });
  }
  const rows = await db.select().from(schema.vendeurs).where(eq(schema.vendeurs.id, corps.data.vendeurId)).limit(1);
  const v = rows[0];
  const ok = v && v.actif && v.pinHash !== '' && (await verifierPin(corps.data.pin, v.pinSalt, v.pinHash));
  if (!ok) {
    const apres = await noterEchec(db, cle, maintenant);
    return erreur(
      c,
      401,
      'pin_incorrect',
      apres.bloque
        ? `Trop d’essais. Réessayez dans ${apres.reessayerDansS} s.`
        : `Code incorrect. Il reste ${apres.restants} essai${apres.restants > 1 ? 's' : ''}.`,
      {
        restants: apres.restants,
      },
    );
  }
  await effacerEssais(db, cle);
  await db
    .update(schema.devices)
    .set({ vendeurId: v.id, lastSeenAt: maintenant.toISOString() })
    .where(eq(schema.devices.id, appareil.id));
  return c.json({ ok: true as const, vendeurId: v.id, prenom: v.prenom });
});
