-- Comprobación tabla por tabla tras la purga: todas las cuentas deben ser 0 (salvo devices: los teléfonos emparejados).
SELECT 'articles' AS tabla, count(*) AS n FROM articles
UNION ALL SELECT 'article_prix', count(*) FROM article_prix
UNION ALL SELECT 'categories', count(*) FROM categories
UNION ALL SELECT 'vendeurs', count(*) FROM vendeurs
UNION ALL SELECT 'journees', count(*) FROM journees
UNION ALL SELECT 'journee_fonds', count(*) FROM journee_fonds
UNION ALL SELECT 'ventes', count(*) FROM ventes
UNION ALL SELECT 'vente_lignes', count(*) FROM vente_lignes
UNION ALL SELECT 'vente_paiements', count(*) FROM vente_paiements
UNION ALL SELECT 'stock_mouvements', count(*) FROM stock_mouvements
UNION ALL SELECT 'comptages_caisse', count(*) FROM comptages_caisse
UNION ALL SELECT 'sessions_travail', count(*) FROM sessions_travail
UNION ALL SELECT 'paiements_heures', count(*) FROM paiements_heures
UNION ALL SELECT 'taux_historique', count(*) FROM taux_historique
UNION ALL SELECT 'settings', count(*) FROM settings
UNION ALL SELECT 'sync_journal', count(*) FROM sync_journal
UNION ALL SELECT 'sync_ops', count(*) FROM sync_ops
UNION ALL SELECT 'devices (teléfonos)', count(*) FROM devices;
