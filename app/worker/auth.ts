// Autenticación: dispositivo (token de emparejamiento), administración (Cloudflare Access o jeton) y
// limitación de intentos de PIN.
import { eq } from 'drizzle-orm';
import type { Context, MiddlewareHandler } from 'hono';
import { verifyWithJwks } from 'hono/jwt';

import type { CodeErreur, ErreurApi } from '../shared/api';
import { baseDe, schema, type Base } from './db';

export interface Appareil {
  id: string;
  nom: string;
  vendeurId: string | null;
}

export type Variables = {
  db: Base;
  appareil: Appareil;
  admin: { via: 'access' | 'jeton' | 'local'; email: string | null };
};
export type AppEnv = { Bindings: Env; Variables: Variables };

export function erreur(
  c: Context,
  statut: 400 | 401 | 403 | 404 | 429 | 500 | 503,
  code: CodeErreur,
  message: string,
  details?: unknown,
) {
  const corps: ErreurApi = { erreur: { code, message, ...(details !== undefined ? { details } : {}) } };
  return c.json(corps, statut);
}

function hex(bytes: ArrayBuffer | Uint8Array): string {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256Hex(texte: string): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texte)));
}

/** Token de dispositivo: 32 bytes aleatorios en hex. Solo se guarda su SHA-256. */
export function genererToken(): string {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return hex(b);
}

const ALPHABET_CODE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O ni 1/I

export function genererCodeAppairage(longueur: number): string {
  const b = new Uint8Array(longueur);
  crypto.getRandomValues(b);
  return [...b].map((x) => ALPHABET_CODE[x % ALPHABET_CODE.length]).join('');
}

export function egalConstant(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function bearer(c: Context): string | null {
  const h = c.req.header('Authorization');
  if (!h) return null;
  const [type, valeur] = h.split(' ');
  return type?.toLowerCase() === 'bearer' && valeur ? valeur.trim() : null;
}

/** Pone la base en el contexto. */
export const avecBase: MiddlewareHandler<AppEnv> = async (c, next) => {
  c.set('db', baseDe(c.env.DB));
  await next();
};

/** Exige un token de dispositivo emparejado (Authorization: Bearer <token>). */
export const authAppareil: MiddlewareHandler<AppEnv> = async (c, next) => {
  const token = bearer(c);
  if (!token) return erreur(c, 401, 'non_authentifie', 'Appareil non appairé');
  const db = c.get('db');
  const hash = await sha256Hex(token);
  const rows = await db
    .select({
      id: schema.devices.id,
      nom: schema.devices.nom,
      vendeurId: schema.devices.vendeurId,
      tokenHash: schema.devices.tokenHash,
    })
    .from(schema.devices)
    .where(eq(schema.devices.tokenHash, hash))
    .limit(1);
  const d = rows[0];
  if (!d || d.tokenHash === '') return erreur(c, 401, 'appareil_inconnu', 'Appareil inconnu ou révoqué');
  c.set('appareil', { id: d.id, nom: d.nom, vendeurId: d.vendeurId });
  await next();
};

/**
 * Administración: JWT de Cloudflare Access (cabecera Cf-Access-Jwt-Assertion), o el jeton ADMIN_TOKEN
 * (secreto de Wrangler) en Authorization: Bearer, o nada en local si ADMIN_SANS_AUTH = "true".
 * Sin ninguno configurado en producción: 503, nunca abierto.
 */
export const authAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const env = c.env;
  // Las vars llegan tipadas como literales de wrangler.jsonc ("" en local): se leen como string.
  const teamDomain: string = env.ACCESS_TEAM_DOMAIN;
  const aud: string = env.ACCESS_AUD;
  const jwt = c.req.header('Cf-Access-Jwt-Assertion');
  if (jwt && teamDomain && aud) {
    try {
      const payload = await verifyWithJwks(jwt, {
        jwks_uri: `https://${teamDomain}.cloudflareaccess.com/cdn-cgi/access/certs`,
        allowedAlgorithms: ['RS256'],
        verification: { aud, iss: `https://${teamDomain}.cloudflareaccess.com` },
      });
      const email = typeof payload.email === 'string' ? payload.email : null;
      c.set('admin', { via: 'access', email });
      await next();
      return;
    } catch (e) {
      console.warn('Access: JWT refusé', e instanceof Error ? e.message : e);
      return erreur(c, 401, 'non_authentifie', 'Jeton Access invalide');
    }
  }
  const jeton = bearer(c);
  if (jeton && env.ADMIN_TOKEN && egalConstant(jeton, env.ADMIN_TOKEN)) {
    c.set('admin', { via: 'jeton', email: null });
    await next();
    return;
  }
  if (env.ENVIRONMENT === 'local' && env.ADMIN_SANS_AUTH === 'true') {
    c.set('admin', { via: 'local', email: null });
    await next();
    return;
  }
  if (!env.ADMIN_TOKEN && !(teamDomain && aud)) {
    return erreur(c, 503, 'acces_non_configure', 'Administration non configurée : Cloudflare Access ou ADMIN_TOKEN');
  }
  return erreur(c, 401, 'non_authentifie', 'Authentification administrateur requise');
};

// ---- Limitación de intentos (ventana deslizante) ----

const FENETRE_MS = 60_000;
export const MAX_ESSAIS_PIN = 5;

export interface EtatEssais {
  bloque: boolean;
  restants: number;
  reessayerDansS: number;
}

export async function lireEssais(db: Base, cle: string, maintenant: Date): Promise<EtatEssais> {
  const rows = await db.select().from(schema.authTentatives).where(eq(schema.authTentatives.cle, cle)).limit(1);
  const r = rows[0];
  if (!r) return { bloque: false, restants: MAX_ESSAIS_PIN, reessayerDansS: 0 };
  const age = maintenant.getTime() - new Date(r.fenetreDebut).getTime();
  if (age >= FENETRE_MS) return { bloque: false, restants: MAX_ESSAIS_PIN, reessayerDansS: 0 };
  const restants = Math.max(0, MAX_ESSAIS_PIN - r.essais);
  return { bloque: restants === 0, restants, reessayerDansS: Math.ceil((FENETRE_MS - age) / 1000) };
}

export async function noterEchec(db: Base, cle: string, maintenant: Date): Promise<EtatEssais> {
  const rows = await db.select().from(schema.authTentatives).where(eq(schema.authTentatives.cle, cle)).limit(1);
  const r = rows[0];
  const iso = maintenant.toISOString();
  const dansFenetre = r && maintenant.getTime() - new Date(r.fenetreDebut).getTime() < FENETRE_MS;
  const essais = dansFenetre ? r.essais + 1 : 1;
  await db
    .insert(schema.authTentatives)
    .values({ cle, essais, fenetreDebut: dansFenetre ? r.fenetreDebut : iso })
    .onConflictDoUpdate({
      target: schema.authTentatives.cle,
      set: { essais, fenetreDebut: dansFenetre ? r.fenetreDebut : iso },
    });
  return lireEssais(db, cle, maintenant);
}

export async function effacerEssais(db: Base, cle: string): Promise<void> {
  await db.delete(schema.authTentatives).where(eq(schema.authTentatives.cle, cle));
}
