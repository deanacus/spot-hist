CREATE TABLE `import_jobs` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `source` text NOT NULL,
  `status` text NOT NULL,
  `phase` text,
  `upload_path` text NOT NULL,
  `uploaded_files_json` text NOT NULL,
  `files_processed` integer DEFAULT 0 NOT NULL,
  `rows_scanned` integer DEFAULT 0 NOT NULL,
  `imported` integer DEFAULT 0 NOT NULL,
  `duplicates_skipped` integer DEFAULT 0 NOT NULL,
  `non_music_skipped` integer DEFAULT 0 NOT NULL,
  `skipped_tracks_skipped` integer DEFAULT 0 NOT NULL,
  `invalid_rows_skipped` integer DEFAULT 0 NOT NULL,
  `total_track_ids` integer DEFAULT 0 NOT NULL,
  `resolved_track_ids` integer DEFAULT 0 NOT NULL,
  `error_message` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  `started_at` text,
  `completed_at` text
);
--> statement-breakpoint
CREATE INDEX `import_jobs_status_idx` ON `import_jobs` (`status`);
--> statement-breakpoint
CREATE INDEX `import_jobs_created_at_idx` ON `import_jobs` (`created_at`);
