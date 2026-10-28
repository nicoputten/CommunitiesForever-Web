CREATE TABLE `doomsday_goals` (
	`owner` text NOT NULL,
	`period` text NOT NULL,
	`n` integer NOT NULL,
	`at` integer,
	`source_upload` integer NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `doomsday_goals_owner_period_n_unique` ON `doomsday_goals` (`owner`,`period`,`n`);--> statement-breakpoint
CREATE TABLE `doomsday_status` (
	`owner` text PRIMARY KEY NOT NULL,
	`streak` integer,
	`best` integer,
	`pool` integer,
	`reset` integer,
	`at` integer,
	`source_upload` integer NOT NULL
);
