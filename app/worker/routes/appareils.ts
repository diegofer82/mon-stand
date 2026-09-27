// Emparejamiento de un teléfono con un código generado desde /admin.
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';

import { appairageRequeteSchema, type AppairageReponse } from '../../shared/api';
import { erreur, genererToken, sha256Hex, type AppEnv } from '../auth';
import { schema } from '../db';

export const appareils = new Hono<AppEnv>();

appareils.post('/pair', async (c) => {
  const corps = appairageRequeteSchema.safeParse(await c.req.json().catch(() => null));
  if (!corps.success) return erreur(c, 400, 'requete_invalide', 'Code ou nom manquant', corps.error.issues);
  const db = c.get('db');
  const maintenant = new Date().toISOString();
  const rows = await db
    .select()
    .from(schema.pairingCodes)
    .where(eq(schema.pairingCodes.code, corps.data.code))
    .limit(1);
  const code = rows[0];
  if (!code || code.usedAt || code.expiresAt < maintenant)
    return erreur(c, 400, 'code_invalide', 'Code inconnu, déjà utilisé ou expiré');
  const token = genererToken();
  const deviceId = `dev_${crypto.randomUUID()}`;
  await db.batch([
    db
      .insert(schema.devices)
      .values({ id: deviceId, nom: corps.data.nom, tokenHash: await sha256Hex(token), lastSeenAt: maintenant }),
    db
      .update(schema.pairingCodes)
      .set({ usedAt: maintenant, deviceId })
      .where(eq(schema.pairingCodes.code, corps.data.code)),
  ]);
  const reponse: AppairageReponse = { deviceId, token, nom: corps.data.nom };
  return c.json(reponse, 201);
});
