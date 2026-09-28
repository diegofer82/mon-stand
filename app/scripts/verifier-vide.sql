-- Comprobación tabla por tabla tras la purga: todas las cuentas deben ser 0 (salvo devices: los teléfonos emparejados).
-- Una sola SELECT sobre json_each: D1 rechaza una SELECT compuesta con tantos UNION ALL («too many terms in compound SELECT»).
SELECT key AS tabla, value AS n FROM json_each(json_object(
  'articles', (SELECT count(*) FROM articles),
  'article_prix', (SELECT count(*) FROM article_prix),
  'categories', (SELECT count(*) FROM categories),
  'vendeurs', (SELECT count(*) FROM vendeurs),
  'journees', (SELECT count(*) FROM journees),
  'journee_fonds', (SELECT count(*) FROM journee_fonds),
  'ventes', (SELECT count(*) FROM ventes),
  'vente_lignes', (SELECT count(*) FROM vente_lignes),
  'vente_paiements', (SELECT count(*) FROM vente_paiements),
  'stock_mouvements', (SELECT count(*) FROM stock_mouvements),
  'comptages_caisse', (SELECT count(*) FROM comptages_caisse),
  'sessions_travail', (SELECT count(*) FROM sessions_travail),
  'paiements_heures', (SELECT count(*) FROM paiements_heures),
  'taux_historique', (SELECT count(*) FROM taux_historique),
  'settings', (SELECT count(*) FROM settings),
  'sync_journal', (SELECT count(*) FROM sync_journal),
  'sync_ops', (SELECT count(*) FROM sync_ops),
  'auth_tentatives', (SELECT count(*) FROM auth_tentatives),
  'devices (teléfonos)', (SELECT count(*) FROM devices)
));
