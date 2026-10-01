// Administración: jeton ADMIN_TOKEN mientras Cloudflare Access no está configurado; con Access configurado,
// /api/admin exige el JWT de Access (firmado por el equipo, con el AUD de la aplicación) y el jeton ya no vale.
import { createExecutionContext, env, waitOnExecutionContext } from 'cloudflare:test';
import { sign } from 'hono/jwt';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import worker from '../worker/index';

const EQUIPE = 'equipo-test';
const AUD = 'a'.repeat(64);
const JETON = 'jeton-de-test';
const EMETTEUR = `https://${EQUIPE}.cloudflareaccess.com`;

type Reglages = { ACCESS_TEAM_DOMAIN?: string; ACCESS_AUD?: string; ADMIN_TOKEN?: string };

/** El entorno del test como si fuera producción: sin el atajo local y con los ajustes pedidos. */
function production(reglages: Reglages): Env {
  return { ...env, ENVIRONMENT: 'production', ADMIN_SANS_AUTH: 'false', ...reglages } as unknown as Env;
}

async function moi(e: Env, headers: Record<string, string> = {}) {
  const ctx = createExecutionContext();
  const r = await worker.fetch(new Request('http://localhost/api/admin/moi', { headers }), e, ctx);
  await waitOnExecutionContext(ctx);
  const corps = await r.json<{ admin?: { via: string; email: string | null }; erreur?: { code: string } }>();
  return { statut: r.status, corps };
}

interface Cle {
  privee: JsonWebKey & { kid: string; alg: 'RS256' };
  publique: JsonWebKey & { kid: string; alg: 'RS256' };
}

async function genererCle(kid: string): Promise<Cle> {
  const paire = (await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair;
  const privee = (await crypto.subtle.exportKey('jwk', paire.privateKey)) as JsonWebKey;
  const publique = (await crypto.subtle.exportKey('jwk', paire.publicKey)) as JsonWebKey;
  return { privee: { ...privee, kid, alg: 'RS256' }, publique: { ...publique, kid, alg: 'RS256' } };
}

/** Un JWT con la forma de los de Access: `aud` en lista, emisor del equipo, correo de la persona. */
function jwtAccess(cle: Cle, charge: Record<string, unknown> = {}): Promise<string> {
  const maintenant = Math.floor(Date.now() / 1000);
  return sign(
    {
      aud: [AUD],
      iss: EMETTEUR,
      email: 'proprietaire@example.com',
      iat: maintenant - 5,
      nbf: maintenant - 5,
      exp: maintenant + 300,
      ...charge,
    },
    cle.privee,
  );
}

describe('authAdmin', () => {
  let equipe: Cle;
  let autre: Cle;

  beforeAll(async () => {
    equipe = await genererCle('cle-1');
    autre = await genererCle('cle-1');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** El JWKS del equipo, servido sin salir a la red. */
  function jwksDuTest() {
    return vi.spyOn(globalThis, 'fetch').mockImplementation((entree) => {
      const url = entree instanceof Request ? entree.url : String(entree);
      if (url !== `${EMETTEUR}/cdn-cgi/access/certs`) return Promise.reject(new Error(`fetch inattendu : ${url}`));
      return Promise.resolve(Response.json({ keys: [equipe.publique] }));
    });
  }

  it('sin Access ni jeton configurados: 503, nunca abierto', async () => {
    const r = await moi(production({}));
    expect(r.statut).toBe(503);
    expect(r.corps.erreur?.code).toBe('acces_non_configure');
  });

  it('sin Access: el jeton ADMIN_TOKEN abre, y sin él 401', async () => {
    const e = production({ ADMIN_TOKEN: JETON });
    expect((await moi(e)).corps.erreur?.code).toBe('non_authentifie');
    expect((await moi(e, { Authorization: 'Bearer autre-chose' })).statut).toBe(401);
    const ok = await moi(e, { Authorization: `Bearer ${JETON}` });
    expect(ok.statut).toBe(200);
    expect(ok.corps.admin).toEqual({ via: 'jeton', email: null });
  });

  it('con Access: sin JWT el jeton ya no vale', async () => {
    const appels = jwksDuTest();
    const e = production({ ACCESS_TEAM_DOMAIN: EQUIPE, ACCESS_AUD: AUD, ADMIN_TOKEN: JETON });
    const r = await moi(e, { Authorization: `Bearer ${JETON}` });
    expect(r.statut).toBe(401);
    expect(r.corps.erreur?.code).toBe('access_requis');
    expect(appels).not.toHaveBeenCalled();
  });

  it('con Access: un JWT del equipo para esta aplicación abre y da el correo', async () => {
    jwksDuTest();
    const e = production({ ACCESS_TEAM_DOMAIN: EQUIPE, ACCESS_AUD: AUD });
    const r = await moi(e, { 'Cf-Access-Jwt-Assertion': await jwtAccess(equipe) });
    expect(r.statut).toBe(200);
    expect(r.corps.admin).toEqual({ via: 'access', email: 'proprietaire@example.com' });
  });

  it('con Access: se rechaza el JWT de otra aplicación, de otro emisor, caducado o firmado con otra clave', async () => {
    jwksDuTest();
    const e = production({ ACCESS_TEAM_DOMAIN: EQUIPE, ACCESS_AUD: AUD, ADMIN_TOKEN: JETON });
    const passe = Math.floor(Date.now() / 1000) - 60;
    const refuses = [
      await jwtAccess(equipe, { aud: ['b'.repeat(64)] }),
      await jwtAccess(equipe, { iss: 'https://autre-equipe.cloudflareaccess.com' }),
      await jwtAccess(equipe, { exp: passe }),
      await jwtAccess(autre),
      'pas-un-jwt',
    ];
    for (const jwt of refuses) {
      // Ni siquiera acompañado del jeton.
      const r = await moi(e, { 'Cf-Access-Jwt-Assertion': jwt, Authorization: `Bearer ${JETON}` });
      expect(r.statut).toBe(401);
      expect(r.corps.erreur?.code).toBe('access_requis');
    }
  });
});
