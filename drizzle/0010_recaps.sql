CREATE TABLE `recap_start` (
	`id` integer PRIMARY KEY NOT NULL,
	`started_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `recaps` (
	`week` integer PRIMARY KEY NOT NULL,
	`start` integer NOT NULL,
	`end` integer NOT NULL,
	`computed_at` integer NOT NULL,
	`data` text NOT NULL,
	`snapshot` text NOT NULL
);
