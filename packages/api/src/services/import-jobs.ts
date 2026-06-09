import { existsSync } from "node:fs";

import type { DatabaseContext } from "../db/index.js";

export type ImportJobStatus = "queued" | "running" | "completed" | "failed";

export interface ImportJobSummary {
  id: string;
  source: string;
  status: ImportJobStatus;
  phase: string | null;
  uploadPath: string;
  uploadedFiles: string[];
  filesProcessed: number;
  rowsScanned: number;
  imported: number;
  duplicatesSkipped: number;
  nonMusicSkipped: number;
  skippedTracksSkipped: number;
  invalidRowsSkipped: number;
  totalTrackIds: number;
  resolvedTrackIds: number;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

type ImportJobRow = {
  id: number;
  source: string;
  status: ImportJobStatus;
  phase: string | null;
  upload_path: string;
  uploaded_files_json: string;
  files_processed: number;
  rows_scanned: number;
  imported: number;
  duplicates_skipped: number;
  non_music_skipped: number;
  skipped_tracks_skipped: number;
  invalid_rows_skipped: number;
  total_track_ids: number;
  resolved_track_ids: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
};

export class ImportJobConflictError extends Error {
  job: ImportJobSummary;

  constructor(job: ImportJobSummary) {
    super("An import job is already running.");
    this.name = "ImportJobConflictError";
    this.job = job;
  }
}

function isoNow() {
  return new Date().toISOString();
}

function mapImportJobRow(row: ImportJobRow | undefined): ImportJobSummary | null {
  if (!row) {
    return null;
  }

  return {
    id: String(row.id),
    source: row.source,
    status: row.status,
    phase: row.phase,
    uploadPath: row.upload_path,
    uploadedFiles: JSON.parse(row.uploaded_files_json) as string[],
    filesProcessed: row.files_processed,
    rowsScanned: row.rows_scanned,
    imported: row.imported,
    duplicatesSkipped: row.duplicates_skipped,
    nonMusicSkipped: row.non_music_skipped,
    skippedTracksSkipped: row.skipped_tracks_skipped,
    invalidRowsSkipped: row.invalid_rows_skipped,
    totalTrackIds: row.total_track_ids,
    resolvedTrackIds: row.resolved_track_ids,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}

export function getImportJobById(database: DatabaseContext, id: string | number) {
  const row = database.client
    .prepare("SELECT * FROM import_jobs WHERE id = ?")
    .get(id) as ImportJobRow | undefined;

  return mapImportJobRow(row);
}

export function getLatestImportJob(database: DatabaseContext, source = "spotify_history") {
  const row = database.client
    .prepare("SELECT * FROM import_jobs WHERE source = ? ORDER BY id DESC LIMIT 1")
    .get(source) as ImportJobRow | undefined;

  return mapImportJobRow(row);
}

function getActiveImportJob(database: DatabaseContext, source = "spotify_history") {
  const row = database.client
    .prepare(
      "SELECT * FROM import_jobs WHERE source = ? AND status IN ('queued', 'running') ORDER BY id ASC LIMIT 1",
    )
    .get(source) as ImportJobRow | undefined;

  return mapImportJobRow(row);
}

export function createImportJob(
  database: DatabaseContext,
  input: {
    source?: string;
    uploadPath: string;
    uploadedFiles: string[];
  },
) {
  const source = input.source ?? "spotify_history";
  const activeJob = getActiveImportJob(database, source);
  if (activeJob) {
    throw new ImportJobConflictError(activeJob);
  }

  const timestamp = isoNow();
  const result = database.client
    .prepare(
      `INSERT INTO import_jobs (
        source, status, phase, upload_path, uploaded_files_json, created_at, updated_at
      ) VALUES (?, 'queued', 'queued', ?, ?, ?, ?)`,
    )
    .run(source, input.uploadPath, JSON.stringify(input.uploadedFiles), timestamp, timestamp);

  return getImportJobById(database, Number(result.lastInsertRowid))!;
}

export function recoverImportJobs(database: DatabaseContext, source = "spotify_history") {
  const rows = database.client
    .prepare("SELECT * FROM import_jobs WHERE source = ? AND status = 'running'")
    .all(source) as ImportJobRow[];

  const timestamp = isoNow();
  const queueStmt = database.client.prepare(
    "UPDATE import_jobs SET status = 'queued', phase = 'queued', updated_at = ?, started_at = NULL WHERE id = ?",
  );
  const failStmt = database.client.prepare(
    "UPDATE import_jobs SET status = 'failed', phase = 'failed', error_message = ?, updated_at = ?, completed_at = ? WHERE id = ?",
  );

  for (const row of rows) {
    if (existsSync(row.upload_path)) {
      queueStmt.run(timestamp, row.id);
      continue;
    }

    failStmt.run("Import payload is missing.", timestamp, timestamp, row.id);
  }
}

export function claimNextImportJob(database: DatabaseContext, source = "spotify_history") {
  const transaction = database.client.transaction(() => {
    const row = database.client
      .prepare(
        "SELECT * FROM import_jobs WHERE source = ? AND status = 'queued' ORDER BY id ASC LIMIT 1",
      )
      .get(source) as ImportJobRow | undefined;

    if (!row) {
      return null;
    }

    const timestamp = isoNow();
    database.client
      .prepare(
        "UPDATE import_jobs SET status = 'running', phase = 'preparing', updated_at = ?, started_at = COALESCE(started_at, ?) WHERE id = ?",
      )
      .run(timestamp, timestamp, row.id);

    return getImportJobById(database, row.id);
  });

  return transaction();
}

export function updateImportJob(
  database: DatabaseContext,
  id: string | number,
  patch: Partial<
    Pick<
      ImportJobSummary,
      | "status"
      | "phase"
      | "uploadPath"
      | "uploadedFiles"
      | "filesProcessed"
      | "rowsScanned"
      | "imported"
      | "duplicatesSkipped"
      | "nonMusicSkipped"
      | "skippedTracksSkipped"
      | "invalidRowsSkipped"
      | "totalTrackIds"
      | "resolvedTrackIds"
      | "errorMessage"
      | "startedAt"
      | "completedAt"
    >
  >,
) {
  const sets: string[] = [];
  const values: unknown[] = [];

  if (patch.status !== undefined) {
    sets.push("status = ?");
    values.push(patch.status);
  }
  if (patch.phase !== undefined) {
    sets.push("phase = ?");
    values.push(patch.phase);
  }
  if (patch.uploadPath !== undefined) {
    sets.push("upload_path = ?");
    values.push(patch.uploadPath);
  }
  if (patch.uploadedFiles !== undefined) {
    sets.push("uploaded_files_json = ?");
    values.push(JSON.stringify(patch.uploadedFiles));
  }
  if (patch.filesProcessed !== undefined) {
    sets.push("files_processed = ?");
    values.push(patch.filesProcessed);
  }
  if (patch.rowsScanned !== undefined) {
    sets.push("rows_scanned = ?");
    values.push(patch.rowsScanned);
  }
  if (patch.imported !== undefined) {
    sets.push("imported = ?");
    values.push(patch.imported);
  }
  if (patch.duplicatesSkipped !== undefined) {
    sets.push("duplicates_skipped = ?");
    values.push(patch.duplicatesSkipped);
  }
  if (patch.nonMusicSkipped !== undefined) {
    sets.push("non_music_skipped = ?");
    values.push(patch.nonMusicSkipped);
  }
  if (patch.skippedTracksSkipped !== undefined) {
    sets.push("skipped_tracks_skipped = ?");
    values.push(patch.skippedTracksSkipped);
  }
  if (patch.invalidRowsSkipped !== undefined) {
    sets.push("invalid_rows_skipped = ?");
    values.push(patch.invalidRowsSkipped);
  }
  if (patch.totalTrackIds !== undefined) {
    sets.push("total_track_ids = ?");
    values.push(patch.totalTrackIds);
  }
  if (patch.resolvedTrackIds !== undefined) {
    sets.push("resolved_track_ids = ?");
    values.push(patch.resolvedTrackIds);
  }
  if (patch.errorMessage !== undefined) {
    sets.push("error_message = ?");
    values.push(patch.errorMessage);
  }
  if (patch.startedAt !== undefined) {
    sets.push("started_at = ?");
    values.push(patch.startedAt);
  }
  if (patch.completedAt !== undefined) {
    sets.push("completed_at = ?");
    values.push(patch.completedAt);
  }

  sets.push("updated_at = ?");
  values.push(isoNow());
  values.push(id);

  database.client
    .prepare(`UPDATE import_jobs SET ${sets.join(", ")} WHERE id = ?`)
    .run(...values);

  return getImportJobById(database, id);
}
