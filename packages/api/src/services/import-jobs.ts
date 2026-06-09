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

const importJobPatchColumns = {
  status: "status",
  phase: "phase",
  uploadPath: "upload_path",
  uploadedFiles: "uploaded_files_json",
  filesProcessed: "files_processed",
  rowsScanned: "rows_scanned",
  imported: "imported",
  duplicatesSkipped: "duplicates_skipped",
  nonMusicSkipped: "non_music_skipped",
  skippedTracksSkipped: "skipped_tracks_skipped",
  invalidRowsSkipped: "invalid_rows_skipped",
  totalTrackIds: "total_track_ids",
  resolvedTrackIds: "resolved_track_ids",
  errorMessage: "error_message",
  startedAt: "started_at",
  completedAt: "completed_at",
} as const;

type ImportJobPatch = Partial<
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
>;

function serializeImportJobPatchValue(
  key: keyof typeof importJobPatchColumns,
  value: ImportJobPatch[keyof ImportJobPatch],
) {
  return key === "uploadedFiles" ? JSON.stringify(value) : value;
}

function buildImportJobUpdate(patch: ImportJobPatch) {
  const sets: string[] = [];
  const values: unknown[] = [];

  for (const [key, column] of Object.entries(importJobPatchColumns) as Array<
    [keyof typeof importJobPatchColumns, string]
  >) {
    const value = patch[key];
    if (value === undefined) {
      continue;
    }

    sets.push(`${column} = ?`);
    values.push(serializeImportJobPatchValue(key, value));
  }

  return {
    sets,
    values,
  };
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
  patch: ImportJobPatch,
) {
  const { sets, values } = buildImportJobUpdate(patch);

  sets.push("updated_at = ?");
  values.push(isoNow());
  values.push(id);

  database.client
    .prepare(`UPDATE import_jobs SET ${sets.join(", ")} WHERE id = ?`)
    .run(...values);

  return getImportJobById(database, id);
}
