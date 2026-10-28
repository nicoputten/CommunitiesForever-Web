CREATE TABLE `feed_days` (
	`day` integer NOT NULL,
	`guid` text NOT NULL,
	`owner` text NOT NULL,
	`at` integer,
	`source_upload` integer NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `feed_days_day_guid_unique` ON `feed_days` (`day`,`guid`);--> statement-breakpoint
CREATE TABLE `feed_sharing` (
	`owner` text PRIMARY KEY NOT NULL,
	`shared` integer NOT NULL,
	`source_upload` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sightings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`guid` text NOT NULL,
	`zone` text NOT NULL,
	`seen_at` integer NOT NULL,
	`source_upload` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sightings_guid_seen_at_unique` ON `sightings` (`guid`,`seen_at`);