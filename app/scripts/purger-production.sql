-- Purga de los datos de prueba antes de importar el export v1 (Fase 6). Lo lanza el propietario, a mano:
--   npx wrangler d1 execute mon-stand-production --remote --env production --file scripts/purger-production.sql
-- Antes: guardar una copia (npx wrangler d1 export mon-stand-production --remote --env production --output <fuera del repo>.sql).
-- Después: comprobar que todo está a cero con scripts/verifier-vide.sql, y solo entonces importar.
-- Antes de lanzarla: désappairer todos los teléfonos (Réglages → Désappairer). Un teléfono que sigue emparejado
-- no vuelve a hacer bootstrap: conservaría los datos de prueba y reinyectaría sus operaciones pendientes.
-- Entre la purga y la importación no se genera ningún código ni se abre la app: sembrarían el catálogo por defecto.
-- Las filas de devices y los códigos se conservan (los teléfonos antiguos se revocan desde /admin).
DELETE FROM sync_journal;
DELETE FROM sync_ops;
DELETE FROM auth_tentatives;
DELETE FROM comptages_caisse;
DELETE FROM vente_paiements;
DELETE FROM vente_lignes;
DELETE FROM stock_mouvements;
DELETE FROM ventes;
DELETE FROM journee_fonds;
DELETE FROM journees;
DELETE FROM sessions_travail;
DELETE FROM paiements_heures;
DELETE FROM article_prix;
DELETE FROM articles;
DELETE FROM categories;
DELETE FROM taux_historique;
DELETE FROM settings;
-- Un teléfono queda ligado a la vendedora que entró con su PIN (devices.vendeur_id): se desliga antes de borrarla,
-- si no la clave foránea rechaza el DELETE y la purga entera se anula. Vuelve a ligarse en el próximo PIN.
UPDATE devices SET vendeur_id = NULL;
DELETE FROM vendeurs;
DELETE FROM devices WHERE id = 'dev_serveur';
