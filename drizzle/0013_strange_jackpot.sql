CREATE TABLE `aip_aero_v4_analytics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`recorded_at` integer NOT NULL,
	`url` text NOT NULL,
	`lcp` real,
	`cls` real,
	`inp` real,
	`fcp` real,
	`ttfb` real,
	`nav` text,
	`conn` text
);
--> statement-breakpoint
CREATE INDEX `analytics_url_idx` ON `aip_aero_v4_analytics` (`url`);--> statement-breakpoint
CREATE INDEX `analytics_recorded_at_idx` ON `aip_aero_v4_analytics` (`recorded_at`);