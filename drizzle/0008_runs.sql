CREATE TABLE `run_answers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`run_id` integer NOT NULL,
	`key` text NOT NULL,
	`battle_tag` text NOT NULL,
	`guid` text,
	`answer` text NOT NULL,
	`role` text NOT NULL,
	`source` text NOT NULL,
	`answered_at` integer NOT NULL,
	`waitlisted` integer NOT NULL,
	`moved_up` integer NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `run_answers_run_key_unique` ON `run_answers` (`run_id`,`key`);--> statement-breakpoint
CREATE TABLE `runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`dungeon_id` text NOT NULL,
	`starts_at` integer NOT NULL,
	`note` text,
	`organiser` text NOT NULL,
	`source` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`cancelled_at` integer,
	`cancelled_by` text,
	`reminded_at` integer,
	`starting_at` integer
);
