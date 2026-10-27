CREATE TABLE `game_items` (
	`id` text PRIMARY KEY NOT NULL,
	`battle_tag` text NOT NULL,
	`kind` text NOT NULL,
	`at` integer NOT NULL,
	`received_at` integer NOT NULL,
	`upload_id` integer NOT NULL,
	`result` text NOT NULL,
	`run_id` integer
);
--> statement-breakpoint
ALTER TABLE `runs` ADD `outcome` text;--> statement-breakpoint
ALTER TABLE `runs` ADD `outcome_at` integer;--> statement-breakpoint
ALTER TABLE `runs` ADD `came` integer;--> statement-breakpoint
ALTER TABLE `runs` ADD `signed_up` integer;