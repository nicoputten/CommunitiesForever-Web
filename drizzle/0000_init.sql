CREATE TABLE `characters` (
	`guid` text PRIMARY KEY NOT NULL,
	`owner` text,
	`updated_at` integer,
	`source_upload` integer,
	`via` text,
	`data` text NOT NULL,
	FOREIGN KEY (`source_upload`) REFERENCES `uploads`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `locations` (
	`guid` text PRIMARY KEY NOT NULL,
	`zone` text NOT NULL,
	`seen_at` integer NOT NULL,
	`source_upload` integer,
	FOREIGN KEY (`source_upload`) REFERENCES `uploads`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `meta` (
	`id` integer PRIMARY KEY NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `people` (
	`key` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `presence` (
	`guid` text PRIMARY KEY NOT NULL,
	`battle_tag` text NOT NULL,
	`last_seen` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `uploads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uploaded_at` integer NOT NULL,
	`uploaded_by` text NOT NULL,
	`sha256` text NOT NULL,
	`size` integer NOT NULL,
	`raw` blob NOT NULL,
	`schema_version` integer,
	`status` text NOT NULL,
	`reason` text,
	`summary` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uploads_sha256_unique` ON `uploads` (`sha256`);