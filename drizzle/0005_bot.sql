CREATE TABLE `bot_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`data` text NOT NULL,
	`created_at` integer NOT NULL,
	`upload_id` integer,
	`posted_at` integer,
	`message_id` text
);
--> statement-breakpoint
CREATE TABLE `bot_tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`token_hash` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_used_at` integer,
	`revoked_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bot_tokens_token_hash_unique` ON `bot_tokens` (`token_hash`);