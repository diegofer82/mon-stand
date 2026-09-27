import { describe, expect, it } from 'vitest';

import {
  arrondir,
  arrondirDevise,
  arrondirMontant,
  formatMontant,
  formatNumber,
  lireMontant,
  prixDevise,
  versCfp,
} from './montants';

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

describe('arrondir / arrondirMontant / lireMontant', () => {
  it('el medio se aleja de cero, también en negativo', () => {
    expect(arrondir(0.5)).toBe(1);
    expect(arrondir(-0.5)).toBe(-1);
    expect(arrondir(1844.25)).toBe(1844);
    expect(arrondir(Number.NaN)).toBe(0);
  });
  it('redondea a los decimales de la divisa', () => {
    expect(arrondirMontant(27.499, 'AUD')).toBe(27.5);
    expect(arrondirMontant(1234.6, 'JPY')).toBe(1235);
    expect(arrondirMontant(1234.6, 'CFP')).toBe(1235);
  });
  it('lee lo que escribe la vendedora y rechaza más decimales de los que admite la divisa', () => {
    expect(lireMontant('7 000')).toBe(7000);
    expect(lireMontant('7\u202f000')).toBe(7000);
    expect(lireMontant('27,5', 'AUD')).toBe(27.5);
    expect(lireMontant('27.50', 'AUD')).toBe(27.5);
    expect(lireMontant('27,5', 'CFP')).toBeNull();
    expect(lireMontant('27,555', 'AUD')).toBeNull();
    expect(lireMontant('27,500', 'AUD')).toBe(27.5);
    expect(lireMontant('abc')).toBeNull();
    expect(lireMontant('')).toBeNull();
  });
  it('convierte a CFP entero y expresa la tarjeta en CFP', () => {
    expect(versCfp(25, 73.77)).toBe(1844);
    expect(formatMontant(3000, 'TPE')).toBe('3\u202f000\u00a0CFP');
  });
});
