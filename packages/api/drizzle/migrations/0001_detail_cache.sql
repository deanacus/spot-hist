CREATE TABLE `artist_details` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `artist_id` integer NOT NULL,
  `spotify_url` text,
  `popularity` integer,
  `followers_total` integer,
  `genres_json` text,
  `images_json` text,
  `catalog_albums_json` text,
  `fetched_at` text NOT NULL,
  `refresh_after` text NOT NULL,
  FOREIGN KEY (`artist_id`) REFERENCES `artists`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `artist_details_artist_id_idx` ON `artist_details` (`artist_id`);
--> statement-breakpoint
CREATE TABLE `album_details` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `album_id` integer NOT NULL,
  `spotify_url` text,
  `label` text,
  `popularity` integer,
  `genres_json` text,
  `images_json` text,
  `copyrights_json` text,
  `tracklist_json` text,
  `fetched_at` text NOT NULL,
  `refresh_after` text NOT NULL,
  FOREIGN KEY (`album_id`) REFERENCES `albums`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `album_details_album_id_idx` ON `album_details` (`album_id`);
--> statement-breakpoint
CREATE TABLE `track_details` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `track_id` integer NOT NULL,
  `spotify_url` text,
  `popularity` integer,
  `preview_url` text,
  `external_ids_json` text,
  `fetched_at` text NOT NULL,
  `refresh_after` text NOT NULL,
  FOREIGN KEY (`track_id`) REFERENCES `tracks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `track_details_track_id_idx` ON `track_details` (`track_id`);
