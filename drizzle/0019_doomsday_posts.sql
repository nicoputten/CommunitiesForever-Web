CREATE TABLE `doomsday_posts` (
	`kind` text NOT NULL,
	`n` integer NOT NULL,
	`event_id` integer NOT NULL,
	`last_data` text,
	`created_at` integer NOT NULL,
	`final_at` integer,
	PRIMARY KEY(`kind`, `n`)
);
