CREATE TABLE `account` (
  `id` integer PRIMARY KEY NOT NULL,
  `spotify_id` text NOT NULL,
  `display_name` text NOT NULL,
  `email` text,
  `access_token` text NOT NULL,
  `refresh_token` text NOT NULL,
  `token_expires_at` text NOT NULL,
  `poll_cursor` integer,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `app_config` (
  `id` integer PRIMARY KEY NOT NULL,
  `password_hash` text,
  `setup_complete` integer DEFAULT false NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `session_token_hash` text NOT NULL,
  `last_seen_at` text NOT NULL,
  `expires_at` text NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_session_token_hash_unique` ON `sessions` (`session_token_hash`);
--> statement-breakpoint
CREATE TABLE `artists` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `spotify_id` text NOT NULL,
  `name` text NOT NULL,
  `uri` text NOT NULL,
  `href` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `artists_spotify_id_unique` ON `artists` (`spotify_id`);
--> statement-breakpoint
CREATE TABLE `albums` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `spotify_id` text NOT NULL,
  `name` text NOT NULL,
  `album_type` text NOT NULL,
  `total_tracks` integer NOT NULL,
  `release_date` text NOT NULL,
  `release_date_precision` text NOT NULL,
  `uri` text NOT NULL,
  `href` text NOT NULL,
  `image_url` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `albums_spotify_id_unique` ON `albums` (`spotify_id`);
--> statement-breakpoint
CREATE TABLE `tracks` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `spotify_id` text NOT NULL,
  `name` text NOT NULL,
  `album_id` integer NOT NULL,
  `disc_number` integer NOT NULL,
  `track_number` integer NOT NULL,
  `duration_ms` integer NOT NULL,
  `explicit` integer NOT NULL,
  `isrc` text,
  `uri` text NOT NULL,
  `href` text NOT NULL,
  `preview_url` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`album_id`) REFERENCES `albums`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tracks_spotify_id_unique` ON `tracks` (`spotify_id`);
--> statement-breakpoint
CREATE TABLE `plays` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `track_id` integer NOT NULL,
  `played_at` text NOT NULL,
  `context_type` text,
  `context_uri` text,
  `created_at` text NOT NULL,
  FOREIGN KEY (`track_id`) REFERENCES `tracks`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `plays_track_id_played_at_unique` ON `plays` (`track_id`, `played_at`);
--> statement-breakpoint
CREATE TABLE `track_artists` (
  `track_id` integer NOT NULL,
  `artist_id` integer NOT NULL,
  PRIMARY KEY(`track_id`, `artist_id`),
  FOREIGN KEY (`track_id`) REFERENCES `tracks`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`artist_id`) REFERENCES `artists`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `album_artists` (
  `album_id` integer NOT NULL,
  `artist_id` integer NOT NULL,
  PRIMARY KEY(`album_id`, `artist_id`),
  FOREIGN KEY (`album_id`) REFERENCES `albums`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`artist_id`) REFERENCES `artists`(`id`) ON UPDATE no action ON DELETE cascade
);
