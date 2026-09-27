import { describe, expect, it } from 'vitest';

import { billetsSuggeres, calculerPaiement, remiseEncaissement, resteEnDevise } from './encaissement';

describe('calculerPaiement en CFP y tarjeta', () => {
  it('compte juste: se acredita todo, sin monnaie', () => {
    const p = calculerPaiement({ resteCfp: 7000, devise: 'CFP' });
    expect(p.montantCfp).toBe(7000);
    expect(p.montantDevise).toBe(7000);
    expect(p.rendu).toBeNull();
  });
  it('billete más grande: monnaie en CFP', () => {
    const p = calculerPaiement({ resteCfp: 7000, devise: 'CFP', montantRecu: 10000 });
    expect(p.montantCfp).toBe(7000);
    expect(p.rendu).toEqual({ montant: 3000, devise: 'CFP' });
  });
  it('si falta dinero se acredita lo recibido; la remise la fija remiseEncaissement', () => {
    const p = calculerPaiement({ resteCfp: 7000, devise: 'CFP', montantRecu: 6500 });
    expect(p.montantCfp).toBe(6500);
    expect(remiseEncaissement(7000, [p])).toBe(500);
  });
  it('la tarjeta nunca devuelve monnaie', () => {
    const p = calculerPaiement({ resteCfp: 7000, devise: 'TPE', montantRecu: 8000 });
    expect(p.montantCfp).toBe(7000);
    expect(p.rendu).toBeNull();
  });
});

describe('calculerPaiement en divisa (v1.4/v1.5)', () => {
  const taux = 73.77;
  it('paga el precio en divisa: se acredita totalDevise × taux, acotado al total', () => {
    const p = calculerPaiement({ resteCfp: 2000, devise: 'AUD', totalDevise: 25, taux });
    expect(p.montantDevise).toBe(25);
    expect(p.montantCfp).toBe(1844); // 25 × 73,77 = 1 844,25
    expect(p.tauxCfp).toBe(taux);
    expect(p.rendu).toBeNull();
    expect(remiseEncaissement(2000, [p])).toBe(156);
  });
  it('billete de 50 AUD: monnaie 25 AUD en la misma divisa, no cobrada', () => {
    const p = calculerPaiement({ resteCfp: 2000, devise: 'AUD', totalDevise: 25, taux, montantRecu: 50 });
    expect(p.montantCfp).toBe(1844);
    expect(p.rendu).toEqual({ montant: 25, devise: 'AUD' });
  });
  it('paga menos que el precio en divisa: se acredita lo recibido', () => {
    const p = calculerPaiement({ resteCfp: 2000, devise: 'AUD', totalDevise: 25, taux, montantRecu: 20 });
    expect(p.montantCfp).toBe(1475); // 20 × 73,77 = 1 475,4
    expect(p.rendu).toBeNull();
  });
  it('si el precio en divisa vale más que el total CFP, lo acreditado se acota al total', () => {
    const p = calculerPaiement({ resteCfp: 1000, devise: 'AUD', totalDevise: 15, taux });
    expect(p.montantCfp).toBe(1000); // 15 × 73,77 = 1 106 > 1 000
  });
  it('yenes: sin decimales', () => {
    const p = calculerPaiement({ resteCfp: 2000, devise: 'JPY', totalDevise: 3000, taux: 0.661, montantRecu: 5000 });
    expect(p.montantCfp).toBe(1983);
    expect(p.rendu).toEqual({ montant: 2000, devise: 'JPY' });
  });
});

describe('pago mixto', () => {
  it('el reste se convierte al tipo del día con los decimales de la divisa, hacia arriba', () => {
    expect(resteEnDevise(1000, 'AUD', 73.77)).toBe(13.56);
    expect(resteEnDevise(1000, 'JPY', 0.661)).toBe(1513);
    expect(resteEnDevise(1000, 'AUD', 0)).toBe(0);
  });
  it('dos pagos cubren el total sin remise', () => {
    const p1 = calculerPaiement({ resteCfp: 7000, devise: 'CFP', montantRecu: 5000 });
    const reste = remiseEncaissement(7000, [p1]);
    expect(reste).toBe(2000);
    const p2 = calculerPaiement({
      resteCfp: reste,
      devise: 'AUD',
      totalDevise: resteEnDevise(reste, 'AUD', 73.77),
      taux: 73.77,
    });
    expect(p2.montantDevise).toBe(27.12);
    expect(p2.montantCfp).toBe(2000);
    expect(remiseEncaissement(7000, [p1, p2])).toBe(0);
  });
});

describe('billetsSuggeres', () => {
  it('propone el billete superior y el siguiente', () => {
    expect(billetsSuggeres(7000, 'CFP')).toEqual([10000, 20000]);
    expect(billetsSuggeres(25, 'AUD')).toEqual([50, 100]);
    expect(billetsSuggeres(3000, 'JPY')).toEqual([5000, 10000]);
  });
  it('por encima del billete grande usa múltiplos, sin repetir el importe exacto', () => {
    expect(billetsSuggeres(20000, 'CFP')).toEqual([30000, 40000]);
    expect(billetsSuggeres(215, 'AUD')).toEqual([300, 400]);
    expect(billetsSuggeres(0, 'CFP')).toEqual([]);
  });
});
