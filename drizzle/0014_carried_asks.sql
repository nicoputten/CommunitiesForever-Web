CREATE TABLE `game_item_carriers` (
	`id` text NOT NULL,
	`battle_tag` text NOT NULL,
	`upload_id` integer NOT NULL,
	`received_at` integer NOT NULL,
	PRIMARY KEY(`id`, `battle_tag`)
);
