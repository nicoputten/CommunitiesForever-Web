CREATE TABLE `character_professions` (
	`guid` text NOT NULL,
	`skill_line_id` integer NOT NULL,
	`owner` text,
	`name` text,
	`skill` integer,
	`max` integer,
	`spec` text,
	`link` text,
	`link_type` text,
	`scanned_at` integer,
	PRIMARY KEY(`guid`, `skill_line_id`)
);
--> statement-breakpoint
CREATE TABLE `character_recipe_scans` (
	`guid` text PRIMARY KEY NOT NULL,
	`owner` text,
	`recipes_at` integer,
	`first_upload_id` integer NOT NULL,
	`upload_id` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `character_recipes` (
	`guid` text NOT NULL,
	`recipe_id` integer NOT NULL,
	`item_id` integer,
	`first_seen_at` integer NOT NULL,
	`baseline` integer NOT NULL,
	`upload_id` integer NOT NULL,
	PRIMARY KEY(`guid`, `recipe_id`)
);
--> statement-breakpoint
CREATE INDEX `character_recipes_recipe` ON `character_recipes` (`recipe_id`);--> statement-breakpoint
CREATE TABLE `item_import` (
	`id` integer PRIMARY KEY NOT NULL,
	`build` text NOT NULL,
	`era_build` text NOT NULL,
	`cmangos` text NOT NULL,
	`imported_at` integer NOT NULL,
	`items` integer NOT NULL,
	`recipes` integer NOT NULL,
	`hash` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `items` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text,
	`quality` integer,
	`icon_name` text,
	`data` text NOT NULL,
	`origin` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `recipe_finds` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`upload_id` integer NOT NULL,
	`guid` text NOT NULL,
	`owner` text,
	`recipe_id` integer NOT NULL,
	`at` integer NOT NULL,
	`posted_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recipe_finds_upload_guid_recipe` ON `recipe_finds` (`upload_id`,`guid`,`recipe_id`);--> statement-breakpoint
CREATE TABLE `recipe_reagents` (
	`recipe_id` integer NOT NULL,
	`item_id` integer NOT NULL,
	`count` integer NOT NULL,
	PRIMARY KEY(`recipe_id`, `item_id`)
);
--> statement-breakpoint
CREATE TABLE `recipe_sources` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`recipe_id` integer NOT NULL,
	`kind` text NOT NULL,
	`place` text,
	`npc` text,
	`quest` text,
	`faction` text,
	`rank` text,
	`is_rare` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `recipe_sources_recipe` ON `recipe_sources` (`recipe_id`);--> statement-breakpoint
CREATE TABLE `recipes` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text,
	`skill_line_id` integer,
	`created_item_id` integer,
	`orange` integer,
	`yellow` integer,
	`green` integer,
	`grey` integer,
	`category` text,
	`obtainable` integer NOT NULL,
	`forever_only` integer NOT NULL,
	`origin` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `recipes_skill_line` ON `recipes` (`skill_line_id`);--> statement-breakpoint
CREATE INDEX `recipes_created_item` ON `recipes` (`created_item_id`);