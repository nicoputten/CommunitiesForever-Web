CREATE TABLE `community_switches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`after_upload` integer NOT NULL,
	`set_by` text NOT NULL,
	`set_at` integer NOT NULL
);
