CREATE TABLE `bot_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`milestones` integer NOT NULL,
	`runs` integer NOT NULL,
	`recap` integer NOT NULL,
	`posts_channel` text,
	`recap_channel` text,
	`runs_channel` text,
	`mention_role` text,
	`recap_day` integer NOT NULL,
	`recap_time` text NOT NULL,
	`reminders` integer NOT NULL,
	`reminder_minutes` integer NOT NULL,
	`ask_now` integer NOT NULL,
	`mark_done` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`updated_by` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `discord_links` (
	`key` text PRIMARY KEY NOT NULL,
	`battle_tag` text NOT NULL,
	`discord_id` text NOT NULL,
	`discord_name` text NOT NULL,
	`linked_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `discord_links_discord_id_unique` ON `discord_links` (`discord_id`);--> statement-breakpoint
CREATE TABLE `user_prefs` (
	`key` text PRIMARY KEY NOT NULL,
	`battle_tag` text NOT NULL,
	`time_zone` text,
	`time_zone_from` text,
	`updated_at` integer NOT NULL
);
