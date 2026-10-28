ALTER TABLE `bot_settings` ADD `doomsday_board` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `bot_settings` ADD `doomsday_ladder` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `bot_settings` ADD `doomsday_channel` text;--> statement-breakpoint
ALTER TABLE `bot_settings` ADD `doomsday_reset` integer DEFAULT 68400 NOT NULL;--> statement-breakpoint
ALTER TABLE `bot_settings` ADD `doomsday_reset_previous` integer;--> statement-breakpoint
ALTER TABLE `bot_settings` ADD `doomsday_reset_changed_at` integer;--> statement-breakpoint
ALTER TABLE `bot_settings` ADD `realm_time_zone` text DEFAULT 'Europe/Paris' NOT NULL;