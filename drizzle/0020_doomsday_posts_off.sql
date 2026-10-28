PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_bot_settings` (
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
	`doomsday_board` integer DEFAULT false NOT NULL,
	`doomsday_ladder` integer DEFAULT false NOT NULL,
	`doomsday_channel` text,
	`doomsday_reset` integer DEFAULT 68400 NOT NULL,
	`doomsday_reset_previous` integer,
	`doomsday_reset_changed_at` integer,
	`realm_time_zone` text DEFAULT 'Europe/Paris' NOT NULL,
	`updated_at` integer NOT NULL,
	`updated_by` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_bot_settings`("id", "milestones", "runs", "recap", "posts_channel", "recap_channel", "runs_channel", "mention_role", "recap_day", "recap_time", "reminders", "reminder_minutes", "ask_now", "mark_done", "doomsday_board", "doomsday_ladder", "doomsday_channel", "doomsday_reset", "doomsday_reset_previous", "doomsday_reset_changed_at", "realm_time_zone", "updated_at", "updated_by") SELECT "id", "milestones", "runs", "recap", "posts_channel", "recap_channel", "runs_channel", "mention_role", "recap_day", "recap_time", "reminders", "reminder_minutes", "ask_now", "mark_done", "doomsday_board", "doomsday_ladder", "doomsday_channel", "doomsday_reset", "doomsday_reset_previous", "doomsday_reset_changed_at", "realm_time_zone", "updated_at", "updated_by" FROM `bot_settings`;--> statement-breakpoint
DROP TABLE `bot_settings`;--> statement-breakpoint
ALTER TABLE `__new_bot_settings` RENAME TO `bot_settings`;--> statement-breakpoint
-- WEB-58 (Nico, 2026-10-28): Doomsday's posts are off until the admin turns them on at launch; rows written while
-- the default was on (0018) never had a way to turn them on, so they go off too.
UPDATE `bot_settings` SET `doomsday_board` = false, `doomsday_ladder` = false;--> statement-breakpoint
PRAGMA foreign_keys=ON;