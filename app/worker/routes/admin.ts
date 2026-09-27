// Administración (propietario): códigos de emparejamiento y dispositivos. Protegida por authAdmin.
import { desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';

import { CODE_APPAIRAGE_LONGUEUR, type Appareil } from '../../shared/api';
import { erreur, genererCodeAppairage, type AppEnv } from '../auth';
import { schema } from '../db';
import { DEVICE_SERVEUR_ID, semerSiVide } from '../semence';

export const admin = new Hono<AppEnv>();

const CODE_DUREE_MS = 15 * 60_000;

admin.get('/moi', (c) => c.json({ admin: c.get('admin') }));

/** Genera un código de emparejamiento válido 15 minutos. */
admin.post('/pairing', async (c) => {
  const db = c.get('db');
  await semerSiVide(db);
  const code = genererCodeAppairage(CODE_APPAIRAGE_LONGUEUR);
  const expiresAt = new Date(Date.now() + CODE_DUREE_MS).toISOString();
  await db.insert(schema.pairingCodes).values({ code, expiresAt });
  return c.json({ code, expiresAt }, 201);
});

admin.get('/devices', async (c) => {
  const db = c.get('db');
  const rows = await db.select().from(schema.devices).orderBy(desc(schema.devices.createdAt));
  const appareils: Appareil[] = rows
    .filter((d) => d.id !== DEVICE_SERVEUR_ID)
    .map((d) => ({
      id: d.id,
      nom: d.nom,
      vendeurId: d.vendeurId,
      createdAt: d.createdAt,
      lastSeenAt: d.lastSeenAt,
      actif: d.tokenHash !== '',
    }));
  return c.json({ appareils });
});

/** Revoca un dispositivo: su token deja de valer; sus operaciones ya recibidas se conservan. */
admin.delete('/devices/:id', async (c) => {
  const db = c.get('db');
  const id = c.req.param('id');
  const rows = await db
    .select({ id: schema.devices.id })
    .from(schema.devices)
    .where(eq(schema.devices.id, id))
    .limit(1);
  if (!rows[0] || id === DEVICE_SERVEUR_ID) return erreur(c, 404, 'introuvable', 'Appareil introuvable');
  await db.update(schema.devices).set({ tokenHash: '' }).where(eq(schema.devices.id, id));
  return c.json({ ok: true });
});
