import { SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

interface Health {
  statut: string;
  environnement: string;
  dateMetier: string;
  fuseau: string;
  base: { ok: boolean; migration?: string | null; tables?: number };
}

describe('GET /api/health', () => {
  it('responde ok con la base migrada', async () => {
    const response = await SELF.fetch('http://localhost/api/health');
    expect(response.status).toBe(200);
    const body = await response.json<Health>();
    expect(body.statut).toBe('ok');
    expect(body.environnement).toBe('local');
    expect(body.fuseau).toBe('Pacific/Noumea');
    expect(body.dateMetier).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(body.base.ok).toBe(true);
    expect(body.base.migration).toMatch(/^0000_/);
    expect(body.base.tables).toBe(16);
  });

  it('las demás rutas de la API responden 404 en JSON', async () => {
    const response = await SELF.fetch('http://localhost/api/inexistante');
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ erreur: 'Route inconnue' });
  });
});
