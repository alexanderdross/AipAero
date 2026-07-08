CREATE TABLE `aip_aero_v4_airport_facts` (
	`icao` text PRIMARY KEY NOT NULL,
	`lat` real,
	`lon` real,
	`elevation_ft` integer,
	`runways` text,
	`frequencies` text,
	`source` text NOT NULL,
	`updated_at` integer
);
