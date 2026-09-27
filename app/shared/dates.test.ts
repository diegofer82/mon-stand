import { describe, expect, it } from 'vitest';

import { dateMetier, heureMetier } from './dates';

describe('dateMetier (Pacific/Noumea, UTC+11)', () => {
  it('una venta a las 07:30 en Nouméa es del día local, no del día anterior en UTC (bug 1)', () => {
    const instant = new Date('2026-10-02T20:30:00Z');
    expect(dateMetier(instant)).toBe('2026-10-03');
    expect(heureMetier(instant)).toBe('07:30');
  });

  it('cambia de día a medianoche de Nouméa', () => {
    expect(dateMetier(new Date('2026-10-03T12:59:00Z'))).toBe('2026-10-03');
    expect(dateMetier(new Date('2026-10-03T13:00:00Z'))).toBe('2026-10-04');
  });
});
