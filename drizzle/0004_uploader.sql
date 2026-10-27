CREATE TABLE `uploader_pairings` (
	`id` text PRIMARY KEY NOT NULL,
	`user_code` text NOT NULL,
	`device_name` text NOT NULL,
	`app_version` text,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`status` text NOT NULL,
	`decided_by` text,
	`token_id` integer,
	FOREIGN KEY (`token_id`) REFERENCES `uploader_tokens`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uploader_pairings_user_code_unique` ON `uploader_pairings` (`user_code`);--> statement-breakpoint
CREATE TABLE `uploader_tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`battle_tag` text NOT NULL,
	`device_name` text NOT NULL,
	`app_version` text,
	`token_hash` text NOT NULL,
	`made_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_used_at` integer,
	`last_upload_at` integer,
	`revoked_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uploader_tokens_token_hash_unique` ON `uploader_tokens` (`token_hash`);--> statement-breakpoint
ALTER TABLE `uploads` ADD `device_id` integer;