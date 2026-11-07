CREATE TABLE `boss_kills` (
	`guid` text NOT NULL,
	`encounter_id` integer NOT NULL,
	`at` integer NOT NULL,
	`source_upload` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `boss_kills_guid_encounter_at_unique` ON `boss_kills` (`guid`,`encounter_id`,`at`);--> statement-breakpoint
CREATE INDEX `boss_kills_encounter_at` ON `boss_kills` (`encounter_id`,`at`);