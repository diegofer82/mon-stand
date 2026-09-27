// Identidad del dispositivo y cursor de sincronización, en la tabla meta.
import { db } from './db';

let deviceIdCache: string | null = null;

/** Id estable del teléfono, generado la primera vez. */
export async function deviceId(): Promise<string> {
  if (deviceIdCache) return deviceIdCache;
  const existant = await db.meta.get('deviceId');
  if (existant) {
    deviceIdCache = existant.value;
    return existant.value;
  }
  const nouveau = `dev_${crypto.randomUUID()}`;
  await db.meta.put({ key: 'deviceId', value: nouveau });
  deviceIdCache = nouveau;
  return nouveau;
}

export async function lireMeta(key: string): Promise<string | null> {
  return (await db.meta.get(key))?.value ?? null;
}

export async function ecrireMeta(key: string, value: string): Promise<void> {
  await db.meta.put({ key, value });
}
