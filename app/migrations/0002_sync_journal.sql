CREATE TABLE `auth_tentatives` (
	`cle` text PRIMARY KEY NOT NULL,
	`essais` integer DEFAULT 0 NOT NULL,
	`fenetre_debut` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pairing_codes` (
	`code` text PRIMARY KEY NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`expires_at` text NOT NULL,
	`used_at` text,
	`device_id` text,
	FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sync_journal` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`op_id` text NOT NULL,
	`device_id` text NOT NULL,
	`vendeur_id` text,
	`type` text NOT NULL,
	`payload` text NOT NULL,
	`received_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sync_journal_op_id_unique` ON `sync_journal` (`op_id`);--> statement-breakpoint
CREATE INDEX `sync_journal_device_idx` ON `sync_journal` (`device_id`);