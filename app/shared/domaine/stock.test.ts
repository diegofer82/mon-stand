import { describe, expect, it } from 'vitest';

import { catalogueDefaut } from './catalogue';
import { etatStock, ordreCaisse, quantites, unitesVendues } from './stock';
import type { Vente } from './types';

describe('stock como libro de movimientos', () => {
  it('la cantidad es la suma de los deltas', () => {
    const q = quantites([
      { articleId: 'a', delta: 10 },
      { articleId: 'a', delta: -3 },
      { articleId: 'b', delta: 2 },
      { articleId: 'a', delta: 1 },
    ]);
    expect(q.get('a')).toBe(8);
    expect(q.get('b')).toBe(2);
    expect(q.get('c')).toBeUndefined();
  });
  it('estado: agotado, bajo (≤ 2), ok', () => {
    expect(etatStock(0)).toBe('epuise');
    expect(etatStock(-1)).toBe('epuise');
    expect(etatStock(2)).toBe('faible');
    expect(etatStock(3)).toBe('ok');
  });
});

describe('ordreCaisse («Tout»)', () => {
  const { articles } = catalogueDefaut('2026-09-27T00:00:00.000Z');
  const vente = (lignes: [string, number][], annuleeAt: string | null = null): Vente => ({
    id: 'v',
    journeeId: 'j',
    vendeurId: 'vend_1',
    deviceId: 'd',
    ts: '2026-09-20T00:00:00.000Z',
    sousTotalCfp: 0,
    remisePanierCfp: 0,
    remiseEncaissementCfp: 0,
    totalCfp: 0,
    annuleeAt,
    lignes: lignes.map(([articleId, qty]) => ({
      id: articleId,
      articleId,
      nomSnapshot: '',
      qty,
      prixUnitCfp: 0,
      totalCfp: 0,
    })),
    paiements: [],
  });

  it('más vendidos primero, empate por nombre, agotados al final, sin los artículos sin precio', () => {
    const ventes = [
      vente([
        ['art_stylo', 3],
        ['art_magnet', 1],
      ]),
      vente([['art_magnet', 5]], '2026-09-21T00:00:00.000Z'),
    ];
    const vendues = unitesVendues(ventes);
    expect(vendues.get('art_magnet')).toBe(1); // la venta anulada no cuenta
    const quantite = new Map(articles.map((a) => [a.id, a.id === 'art_stylo' ? 0 : 5]));
    const ordre = ordreCaisse(articles, quantite, vendues).map((a) => a.id);
    expect(ordre[0]).toBe('art_magnet');
    expect(ordre[1]).toBe('art_bague'); // 0 ventas, primero por nombre
    expect(ordre[ordre.length - 1]).toBe('art_stylo'); // agotado
    expect(ordre).not.toContain('art_bourgoir');
    expect(ordre).not.toContain('art_boite-deco');
  });
});
