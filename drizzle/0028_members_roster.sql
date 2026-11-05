CREATE TABLE `members_before` (
	`id` integer PRIMARY KEY NOT NULL,
	`last_upload` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `uploads` ADD `roster` text;--> statement-breakpoint
ALTER TABLE `uploads` ADD `roster_seen_at` integer;
--> statement-breakpoint
-- WEB-85: the uploads the site had before it keep the old member rule until the owner's first roster arrives.
INSERT INTO `members_before` (`id`, `last_upload`) SELECT 1, coalesce(max(`id`), 0) FROM `uploads`;
