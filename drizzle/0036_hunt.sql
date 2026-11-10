CREATE TABLE `hunt_census` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`day` integer NOT NULL,
	`at` integer NOT NULL,
	`source` text NOT NULL,
	`data` text NOT NULL,
	`by` text
);
--> statement-breakpoint
CREATE TABLE `hunt_census_fetch` (
	`day` integer PRIMARY KEY NOT NULL,
	`at` integer NOT NULL,
	`ok` integer NOT NULL,
	`error` text
);
--> statement-breakpoint
CREATE TABLE `hunt_pins` (
	`n` integer NOT NULL,
	`faction` text NOT NULL,
	`key` text NOT NULL,
	`at` integer NOT NULL,
	`by` text NOT NULL,
	PRIMARY KEY(`n`, `faction`)
);
--> statement-breakpoint
CREATE TABLE `hunt_plan` (
	`n` integer NOT NULL,
	`faction` text NOT NULL,
	`key` text NOT NULL,
	`at` integer NOT NULL,
	PRIMARY KEY(`n`, `faction`)
);
