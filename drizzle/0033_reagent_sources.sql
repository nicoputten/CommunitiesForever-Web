CREATE TABLE `reagent_sources` (
	`item_id` integer NOT NULL,
	`kind` text NOT NULL,
	`position` integer NOT NULL,
	`name` text,
	`zone` text,
	`chance` real,
	`recipe_id` integer,
	`creature_type` text,
	`min_level` integer,
	`max_level` integer,
	PRIMARY KEY(`item_id`, `kind`, `position`)
);
