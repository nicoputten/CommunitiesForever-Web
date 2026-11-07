CREATE TABLE `boss_drops` (
	`boss_id` integer NOT NULL,
	`item_id` integer NOT NULL,
	`position` integer NOT NULL,
	`chance` real NOT NULL,
	`class_id` integer,
	`subclass_id` integer,
	`classes` integer,
	`quest_id` integer,
	`recipe_id` integer,
	PRIMARY KEY(`boss_id`, `item_id`)
);
--> statement-breakpoint
CREATE TABLE `dungeon_bosses` (
	`id` integer PRIMARY KEY NOT NULL,
	`dungeon_id` text NOT NULL,
	`wing_id` text,
	`position` integer NOT NULL,
	`name` text NOT NULL,
	`final` integer NOT NULL,
	`optional` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `dungeon_bosses_dungeon` ON `dungeon_bosses` (`dungeon_id`,`wing_id`,`position`);