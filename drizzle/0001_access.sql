CREATE TABLE `blocks` (
	`key` text PRIMARY KEY NOT NULL,
	`battle_tag` text NOT NULL,
	`blocked_at` integer NOT NULL,
	`blocked_by` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `guests` (
	`key` text PRIMARY KEY NOT NULL,
	`battle_tag` text NOT NULL,
	`may_upload` integer NOT NULL,
	`added_at` integer NOT NULL,
	`added_by` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `members` (
	`key` text PRIMARY KEY NOT NULL,
	`battle_tag` text NOT NULL,
	`first_upload` integer NOT NULL,
	FOREIGN KEY (`first_upload`) REFERENCES `uploads`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
DROP INDEX `uploads_sha256_unique`;--> statement-breakpoint
ALTER TABLE `uploads` ADD `community` text;--> statement-breakpoint
ALTER TABLE `uploads` ADD `rejection` text;--> statement-breakpoint
CREATE UNIQUE INDEX `uploads_sha256_uploaded_by_unique` ON `uploads` (`sha256`,`uploaded_by`);