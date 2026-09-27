import { describe, expect, it } from 'vitest';

import { TAUX_DEFAUT } from '../taux';
import {
  prixVenteDevise,
  totalLigneCfp,
  totalLigneDevise,
  totalPanierDevise,
  totauxPanier,
  unitesEnPromo,
} from './panier';
import type { Article } from './types';

const article = (id: string, prixCfp: number, extra: Partial<Article> = {}): Article => ({
  id,
  nom: id,
  categorieId: 'cat_bijoux',
  emoji: null,
  prixCfp,
  promo2emePct: null,
  prixDevises: {},
  actif: true,
  updatedAt: '2026-09-27T00:00:00.000Z',
  ...extra,
});

const articles = new Map<string, Article>([
  ['collier', article('collier', 2000)],
  ['boucles', article('boucles', 2000, { promo2emePct: 50 })],
  ['bracelet', article('bracelet', 2000, { prixDevises: { AUD: 27 } })],
  ['stylo', article('stylo', 1500)],
]);

describe('totalLigneCfp (v1: calcLT)', () => {
  it('sin promo multiplica', () => {
    expect(totalLigneCfp(2000, null, 3)).toBe(6000);
  });
  it('la 2ª unidad (y la 4ª…) lleva la promo; el redondeo es al final', () => {
    expect(totalLigneCfp(2000, 50, 2)).toBe(3000);
    expect(totalLigneCfp(2000, 50, 3)).toBe(5000);
    expect(totalLigneCfp(1850, 33, 2)).toBe(3090); // 1 850 + 1 239,5 → 3 089,5 → 3 090
    expect(unitesEnPromo(50, 5)).toBe(2);
    expect(unitesEnPromo(null, 5)).toBe(0);
  });
});

describe('totauxPanier', () => {
  it('sous-total, remise acotada y total nunca negativo', () => {
    const t = totauxPanier(
      [
        { articleId: 'collier', qty: 2 },
        { articleId: 'boucles', qty: 2 },
      ],
      articles,
      500,
    );
    expect(t).toEqual({ sousTotalCfp: 7000, remisePanierCfp: 500, totalCfp: 6500, nbArticles: 4 });
    expect(totauxPanier([{ articleId: 'stylo', qty: 1 }], articles, 9999).totalCfp).toBe(0);
  });
  it('ignora artículos desconocidos', () => {
    expect(totauxPanier([{ articleId: 'fantome', qty: 3 }], articles, 0).sousTotalCfp).toBe(0);
  });
});

describe('precios en divisa (v1.5)', () => {
  it('manual si está fijado, calculado si no', () => {
    expect(prixVenteDevise(articles.get('bracelet')!, 'AUD', TAUX_DEFAUT)).toBe(27);
    expect(prixVenteDevise(articles.get('bracelet')!, 'USD', TAUX_DEFAUT)).toBe(20);
    expect(prixVenteDevise(articles.get('collier')!, 'AUD', TAUX_DEFAUT)).toBe(25);
    expect(prixVenteDevise(articles.get('collier')!, 'JPY', TAUX_DEFAUT)).toBe(3000);
  });
  it('la 2ª unidad en promo se redondea como un precio', () => {
    // 25 AUD, 2ª a −50 % = 12,5 → 15 (al 5 más cercano, mínimo el paso)
    expect(totalLigneDevise(25, 50, 2)).toBe(40);
    expect(totalLigneDevise(25, null, 2)).toBe(50);
  });
  it('total del panier = suma de precios en divisa; la remise CFP se convierte y se re-redondea', () => {
    const lignes = [
      { articleId: 'collier', qty: 1 },
      { articleId: 'stylo', qty: 1 },
    ];
    expect(totalPanierDevise(lignes, articles, 'AUD', TAUX_DEFAUT, 0)).toBe(45); // 25 + 20
    // 45 − 500/73,77 (6,78) = 38,22 → 40
    expect(totalPanierDevise(lignes, articles, 'AUD', TAUX_DEFAUT, 500)).toBe(40);
    expect(totalPanierDevise(lignes, articles, 'AUD', {}, 0)).toBe(0);
    expect(totalPanierDevise(lignes, articles, 'AUD', TAUX_DEFAUT, 99999)).toBe(0);
  });
});
