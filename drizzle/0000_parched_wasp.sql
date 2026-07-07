CREATE TABLE `aip_aero_v4_airports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`icao` text,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`type` text NOT NULL,
	`country` text NOT NULL,
	`slug` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `icao_idx` ON `aip_aero_v4_airports` (`icao`);--> statement-breakpoint
CREATE INDEX `title_idx` ON `aip_aero_v4_airports` (`title`);--> statement-breakpoint
CREATE INDEX `type_idx` ON `aip_aero_v4_airports` (`type`);--> statement-breakpoint
CREATE INDEX `country_idx` ON `aip_aero_v4_airports` (`country`);--> statement-breakpoint
CREATE INDEX `slug_idx` ON `aip_aero_v4_airports` (`slug`);