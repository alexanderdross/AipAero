CREATE TABLE `aip_aero_v4_health_metrics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`recorded_at` integer NOT NULL,
	`category` text NOT NULL,
	`metric` text NOT NULL,
	`value` real,
	`unit` text,
	`scope` text,
	`status` text,
	`meta` text
);
--> statement-breakpoint
CREATE INDEX `health_category_metric_idx` ON `aip_aero_v4_health_metrics` (`category`,`metric`);--> statement-breakpoint
CREATE INDEX `health_recorded_at_idx` ON `aip_aero_v4_health_metrics` (`recorded_at`);--> statement-breakpoint
CREATE INDEX `health_scope_idx` ON `aip_aero_v4_health_metrics` (`scope`);