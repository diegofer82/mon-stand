import { describe, expect, it } from 'vitest';

import { arrondir30, dureeMinutes, formatDuree, montantDuCfp, resumeHeures } from './heures';
import type { SessionTravail } from './types';

describe('arrondir30', () => {
  it('menos de 15 minutos hacia abajo, 15 o más hacia arriba', () => {
    expect(arrondir30(new Date('2026-10-03T07:14:59Z')).toISOString()).toBe('2026-10-03T07:00:00.000Z');
    expect(arrondir30(new Date('2026-10-03T07:15:00Z')).toISOString()).toBe('2026-10-03T07:30:00.000Z');
    expect(arrondir30(new Date('2026-10-03T07:44:00Z')).toISOString()).toBe('2026-10-03T07:30:00.000Z');
    expect(arrondir30(new Date('2026-10-03T07:45:00Z')).toISOString()).toBe('2026-10-03T08:00:00.000Z');
  });
});

describe('duración e importe', () => {
  it('calcula minutos, formato y lo debido', () => {
    expect(dureeMinutes('2026-10-03T07:00:00Z', '2026-10-03T14:30:00Z')).toBe(450);
    expect(formatDuree(450)).toBe('7h30');
    expect(formatDuree(45)).toBe('0h45');
    expect(montantDuCfp(450, 1500)).toBe(11250);
    expect(montantDuCfp(90, 1500)).toBe(2250);
    expect(dureeMinutes('2026-10-03T14:00:00Z', '2026-10-03T07:00:00Z')).toBe(0);
  });
});

describe('resumeHeures', () => {
  const session = (id: string, dureeMin: number | null, payeeAt: string | null): SessionTravail => ({
    id,
    vendeurId: 'vend_1',
    debut: '2026-10-03T07:00:00Z',
    fin: dureeMin === null ? null : '2026-10-03T14:30:00Z',
    dureeMin,
    commentaire: null,
    payeeAt,
  });
  it('separa lo pagado de lo pendiente e ignora la sesión en curso', () => {
    const r = resumeHeures(
      [session('a', 450, null), session('b', 120, '2026-10-04T00:00:00Z'), session('c', null, null)],
      1500,
    );
    expect(r).toEqual({ nbSessions: 2, totalMin: 570, duCfp: 11250, payeCfp: 3000 });
  });
});
