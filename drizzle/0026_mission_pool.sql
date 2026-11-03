CREATE TABLE `mission_overrides` (
	`period` text NOT NULL,
	`n` integer NOT NULL,
	`slot` integer NOT NULL,
	`id` text NOT NULL,
	`kind` text NOT NULL,
	`at` integer NOT NULL,
	`by` text NOT NULL,
	PRIMARY KEY(`period`, `n`, `slot`)
);
--> statement-breakpoint
CREATE TABLE `mission_plan` (
	`period` text NOT NULL,
	`n` integer NOT NULL,
	`plan` text NOT NULL,
	`at` integer NOT NULL,
	PRIMARY KEY(`period`, `n`)
);
--> statement-breakpoint
CREATE TABLE `mission_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`off` integer NOT NULL,
	`often` text NOT NULL,
	`changed_at` integer NOT NULL,
	`changed_by` text NOT NULL
);
