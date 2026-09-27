CREATE TABLE `journee_fonds` (
	`journee_id` text NOT NULL,
	`devise` text NOT NULL,
	`montant` real NOT NULL,
	PRIMARY KEY(`journee_id`, `devise`),
	FOREIGN KEY (`journee_id`) REFERENCES `journees`(`id`) ON UPDATE no action ON DELETE no action
);
