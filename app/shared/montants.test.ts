import { describe, expect, it } from 'vitest';

import { arrondirDevise, formatMontant, formatNumber, prixDevise } from './montants';

// Tasas por defecto de la v1.5 (CFP por unidad de divisa).
const TAUX = { AUD: 73.77, USD: 104.98, NZD: 59.52, EUR: 119.332, JPY: 0.661 };

describe('prixDevise (regla v1.5)', () => {
  it('reproduce los ejemplos del README: 2 000 CFP → 25 AUD, 20 USD, 3 000 JPY', () => {
    expect(prixDevise(2000, TAUX.AUD)).toBe(25);
    expect(prixDevise(2000, TAUX.USD)).toBe(20);
    expect(prixDevise(2000, TAUX.JPY)).toBe(3000);
  });

  it('redondea al 5 más cercano, y a la centena por encima de 1 000', () => {
    expect(prixDevise(1000, TAUX.AUD)).toBe(15);
    expect(prixDevise(16000, TAUX.AUD)).toBe(215);
    expect(prixDevise(1500, TAUX.JPY)).toBe(2300);
  });

  it('nunca devuelve menos que el paso ni un precio con tasa inválida', () => {
    expect(arrondirDevise(1.2)).toBe(5);
    expect(arrondirDevise(0)).toBe(0);
    expect(prixDevise(2000, 0)).toBe(0);
  });
});

describe('formatNumber / formatMontant', () => {
  it('separa los miles con un espacio fino insecable', () => {
    expect(formatNumber(7000)).toBe('7\u202f000');
    expect(formatNumber(54661)).toBe('54\u202f661');
  });

  it('no muestra decimales en CFP ni en yenes, sí en las otras divisas', () => {
    expect(formatNumber(1999.6)).toBe('2\u202f000');
    expect(formatNumber(10500, 'JPY')).toBe('10\u202f500');
    expect(formatNumber(12.5, 'AUD')).toBe('12,5');
  });

  it('usa el signo menos tipográfico y pega el código de divisa', () => {
    expect(formatNumber(-500)).toBe('\u2212500');
    expect(formatMontant(90, 'AUD')).toBe('90\u00a0AUD');
  });
});
