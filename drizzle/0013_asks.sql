ALTER TABLE `runs` ADD `kind` text DEFAULT 'run' NOT NULL;--> statement-breakpoint
ALTER TABLE `runs` ADD `expires_at` integer;--> statement-breakpoint
ALTER TABLE `runs` ADD `expired_at` integer;