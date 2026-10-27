CREATE TABLE `guild_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`discord_id` text NOT NULL,
	`name` text NOT NULL,
	`position` integer NOT NULL,
	`present` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `guild_items_kind_discord_id_unique` ON `guild_items` (`kind`,`discord_id`);--> statement-breakpoint
CREATE TABLE `guild_reports` (
	`id` integer PRIMARY KEY NOT NULL,
	`reported_at` integer NOT NULL
);
