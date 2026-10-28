CREATE TABLE `feats` (
	`guid` text NOT NULL,
	`key` text NOT NULL,
	`kind` text NOT NULL,
	`owner` text NOT NULL,
	`upload_id` integer NOT NULL,
	`at` integer NOT NULL,
	`already_had` integer NOT NULL,
	`first_in_group` integer NOT NULL,
	`fields` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `feats_guid_key_unique` ON `feats` (`guid`,`key`);