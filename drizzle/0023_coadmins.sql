CREATE TABLE `admin_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`at` integer NOT NULL,
	`by` text NOT NULL,
	`action` text NOT NULL,
	`target` text,
	`detail` text
);
--> statement-breakpoint
CREATE TABLE `admins` (
	`key` text PRIMARY KEY NOT NULL,
	`battle_tag` text NOT NULL,
	`added_by` text NOT NULL,
	`added_at` integer NOT NULL
);
