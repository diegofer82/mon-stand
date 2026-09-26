CREATE TABLE `article_prix` (
	`article_id` text NOT NULL,
	`devise` text NOT NULL,
	`prix` real NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	PRIMARY KEY(`article_id`, `devise`),
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `articles` (
	`id` text PRIMARY KEY NOT NULL,
	`nom` text NOT NULL,
	`categorie_id` text NOT NULL,
	`emoji` text,
	`prix_cfp` integer NOT NULL,
	`promo_2eme_pct` integer,
	`photo_key` text,
	`actif` integer DEFAULT true NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`categorie_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `articles_categorie_idx` ON `articles` (`categorie_id`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`nom` text NOT NULL,
	`emoji` text,
	`ordre` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `comptages_caisse` (
	`id` text PRIMARY KEY NOT NULL,
	`journee_id` text NOT NULL,
	`devise` text NOT NULL,
	`attendu` real NOT NULL,
	`compte` real NOT NULL,
	`ecart` real NOT NULL,
	FOREIGN KEY (`journee_id`) REFERENCES `journees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `comptages_journee_idx` ON `comptages_caisse` (`journee_id`);--> statement-breakpoint
CREATE TABLE `devices` (
	`id` text PRIMARY KEY NOT NULL,
	`nom` text NOT NULL,
	`token_hash` text NOT NULL,
	`vendeur_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`last_seen_at` text,
	FOREIGN KEY (`vendeur_id`) REFERENCES `vendeurs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `journees` (
	`id` text PRIMARY KEY NOT NULL,
	`date_locale` text NOT NULL,
	`lieu` text NOT NULL,
	`vendeur_id` text NOT NULL,
	`fond_caisse_cfp` integer,
	`ouverte_at` text NOT NULL,
	`cloturee_at` text,
	`commentaire_cloture` text,
	`pdf_key` text,
	FOREIGN KEY (`vendeur_id`) REFERENCES `vendeurs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `journees_date_idx` ON `journees` (`date_locale`);--> statement-breakpoint
CREATE TABLE `paiements_heures` (
	`id` text PRIMARY KEY NOT NULL,
	`vendeur_id` text NOT NULL,
	`montant_cfp` integer NOT NULL,
	`date` text NOT NULL,
	`note` text,
	FOREIGN KEY (`vendeur_id`) REFERENCES `vendeurs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sessions_travail` (
	`id` text PRIMARY KEY NOT NULL,
	`vendeur_id` text NOT NULL,
	`debut` text NOT NULL,
	`fin` text,
	`duree_min` integer,
	`commentaire` text,
	`payee_at` text,
	FOREIGN KEY (`vendeur_id`) REFERENCES `vendeurs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sessions_vendeur_idx` ON `sessions_travail` (`vendeur_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `stock_mouvements` (
	`id` text PRIMARY KEY NOT NULL,
	`article_id` text NOT NULL,
	`delta` integer NOT NULL,
	`motif` text NOT NULL,
	`vente_id` text,
	`vendeur_id` text NOT NULL,
	`device_id` text NOT NULL,
	`ts` text NOT NULL,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vente_id`) REFERENCES `ventes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vendeur_id`) REFERENCES `vendeurs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `stock_mouvements_article_idx` ON `stock_mouvements` (`article_id`);--> statement-breakpoint
CREATE TABLE `sync_ops` (
	`op_id` text PRIMARY KEY NOT NULL,
	`device_id` text NOT NULL,
	`received_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `taux_historique` (
	`devise` text NOT NULL,
	`date` text NOT NULL,
	`cfp_par_unite` real NOT NULL,
	`source` text NOT NULL,
	PRIMARY KEY(`devise`, `date`)
);
--> statement-breakpoint
CREATE TABLE `vendeurs` (
	`id` text PRIMARY KEY NOT NULL,
	`prenom` text NOT NULL,
	`pin_hash` text NOT NULL,
	`pin_salt` text NOT NULL,
	`taux_horaire_cfp` integer DEFAULT 0 NOT NULL,
	`actif` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `vente_lignes` (
	`id` text PRIMARY KEY NOT NULL,
	`vente_id` text NOT NULL,
	`article_id` text NOT NULL,
	`nom_snapshot` text NOT NULL,
	`qty` integer NOT NULL,
	`prix_unit_cfp` integer NOT NULL,
	`total_cfp` integer NOT NULL,
	FOREIGN KEY (`vente_id`) REFERENCES `ventes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `vente_lignes_vente_idx` ON `vente_lignes` (`vente_id`);--> statement-breakpoint
CREATE INDEX `vente_lignes_article_idx` ON `vente_lignes` (`article_id`);--> statement-breakpoint
CREATE TABLE `vente_paiements` (
	`id` text PRIMARY KEY NOT NULL,
	`vente_id` text NOT NULL,
	`devise` text NOT NULL,
	`montant_devise` real NOT NULL,
	`total_devise` real,
	`taux_cfp` real,
	`montant_cfp` integer NOT NULL,
	`rendu_montant` real,
	`rendu_devise` text,
	FOREIGN KEY (`vente_id`) REFERENCES `ventes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `vente_paiements_vente_idx` ON `vente_paiements` (`vente_id`);--> statement-breakpoint
CREATE TABLE `ventes` (
	`id` text PRIMARY KEY NOT NULL,
	`journee_id` text NOT NULL,
	`vendeur_id` text NOT NULL,
	`device_id` text NOT NULL,
	`ts` text NOT NULL,
	`sous_total_cfp` integer NOT NULL,
	`remise_panier_cfp` integer DEFAULT 0 NOT NULL,
	`remise_encaissement_cfp` integer DEFAULT 0 NOT NULL,
	`total_cfp` integer NOT NULL,
	`annulee_at` text,
	FOREIGN KEY (`journee_id`) REFERENCES `journees`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vendeur_id`) REFERENCES `vendeurs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ventes_journee_idx` ON `ventes` (`journee_id`);