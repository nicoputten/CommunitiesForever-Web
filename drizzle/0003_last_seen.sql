CREATE TABLE `last_seen` (
	`key` text PRIMARY KEY NOT NULL,
	`battle_tag` text NOT NULL,
	`seen_at` integer NOT NULL
);
