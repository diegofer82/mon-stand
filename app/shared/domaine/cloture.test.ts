import { describe, expect, it } from 'vitest';

import { attenduParDevise, ecartComptage, resumeJournee } from './cloture';
import type { Paiement, Vente } from './types';

const paiement = (p: Partial<Paiement> & Pick<Paiement, 'devise' | 'montantDevise' | 'montantCfp'>): Paiement => ({
  id: `p_${p.devise}_${p.montantDevise}`,
  totalDevise: null,
  tauxCfp: null,
  renduMontant: null,
  renduDevise: null,
  ...p,
});

const vente = (n: number, totalCfp: number, paiements: Paiement[], extra: Partial<Vente> = {}): Vente => ({
  id: `v${n}`,
  journeeId: 'j1',
  vendeurId: 'vend_1',
  deviceId: 'd1',
  ts: `2026-10-03T0${n}:00:00.000Z`,
  sousTotalCfp: totalCfp,
  remisePanierCfp: 0,
  remiseEncaissementCfp: 0,
  totalCfp,
  annuleeAt: null,
  lignes: [
    { id: `l${n}`, articleId: 'art_collier-200', nomSnapshot: 'Collier 200', qty: 1, prixUnitCfp: totalCfp, totalCfp },
  ],
  paiements,
  ...extra,
});

const ventes: Vente[] = [
  vente(1, 2000, [
    paiement({ devise: 'CFP', montantDevise: 5000, montantCfp: 2000, renduMontant: 3000, renduDevise: 'CFP' }),
  ]),
  vente(
    2,
    2000,
    [
      paiement({
        devise: 'AUD',
        montantDevise: 50,
        totalDevise: 25,
        tauxCfp: 73.77,
        montantCfp: 1844,
        renduMontant: 25,
        renduDevise: 'AUD',
      }),
    ],
    { remiseEncaissementCfp: 156 },
  ),
  vente(3, 3000, [paiement({ devise: 'TPE', montantDevise: 3000, montantCfp: 3000 })], {
    lignes: [{ id: 'l3', articleId: 'art_stylo', nomSnapshot: 'Stylo', qty: 2, prixUnitCfp: 1500, totalCfp: 3000 }],
  }),
  vente(4, 9999, [paiement({ devise: 'CFP', montantDevise: 9999, montantCfp: 9999 })], {
    annuleeAt: '2026-10-03T05:00:00.000Z',
  }),
];

describe('resumeJournee', () => {
  it('KPIs sin las ventas anuladas, reparto por modo de pago y top de artículos', () => {
    const r = resumeJournee(ventes);
    expect(r.nbVentes).toBe(3);
    expect(r.nbArticles).toBe(4);
    expect(r.totalEncaisseCfp).toBe(6844);
    expect(r.remisesEncaissementCfp).toBe(156);
    expect(r.panierMoyenCfp).toBe(2281);
    expect(r.parPaiement).toEqual([
      { devise: 'CFP', nb: 1, montantDevise: 5000, rendu: 3000, montantCfp: 2000 },
      { devise: 'AUD', nb: 1, montantDevise: 50, rendu: 25, montantCfp: 1844 },
      { devise: 'TPE', nb: 1, montantDevise: 3000, rendu: 0, montantCfp: 3000 },
    ]);
    expect(r.topArticles[0]).toEqual({ articleId: 'art_collier-200', nom: 'Collier 200', qty: 2, totalCfp: 4000 });
    expect(r.topArticles[1]).toEqual({ articleId: 'art_stylo', nom: 'Stylo', qty: 2, totalCfp: 3000 });
  });
  it('sin ventas todo queda a cero', () => {
    expect(resumeJournee([]).panierMoyenCfp).toBe(0);
  });
});

describe('conteo de caja', () => {
  it('esperado por divisa = fondo + recibido − monnaie devuelta; la tarjeta no cuenta', () => {
    const a = attenduParDevise({ fonds: { CFP: 1000, AUD: 100 } }, ventes);
    expect(a).toEqual([
      { devise: 'CFP', fond: 1000, recu: 5000, rendu: 3000, attendu: 3000 },
      { devise: 'AUD', fond: 100, recu: 50, rendu: 25, attendu: 125 },
    ]);
  });
  it('una divisa sin fondo aparece si hubo un pago en ella', () => {
    const a = attenduParDevise({ fonds: {} }, [
      vente(1, 2000, [paiement({ devise: 'JPY', montantDevise: 3000, montantCfp: 1983 })]),
    ]);
    expect(a).toEqual([{ devise: 'JPY', fond: 0, recu: 3000, rendu: 0, attendu: 3000 }]);
  });
  it('el écart se firma desde lo contado y respeta los decimales', () => {
    expect(ecartComptage(125, 120, 'AUD')).toBe(-5);
    expect(ecartComptage(3000, 3000, 'CFP')).toBe(0);
    expect(ecartComptage(10.1, 10.3, 'AUD')).toBe(0.2);
  });
});
