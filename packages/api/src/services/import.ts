import { Buffer } from "node:buffer";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

import { unzipSync } from "fflate";

import type { SpotifyClient } from "../auth/spotify.js";
import type { AppConfig } from "../config.js";
import type { DatabaseContext } from "../db/index.js";
import { getAccessToken, persistImportedPlayedItems } from "./repository.js";
import type { SpotifyRecentlyPlayedItem, SpotifyTrack } from "../types/spotify.js";

export interface UploadedImportFile {
  filename: string;
  contentType: string | undefined;
  data: Buffer;
}

export interface SpotifyHistoryImportSummary {
  filesProcessed: number;
  rowsScanned: number;
  imported: number;
  duplicatesSkipped: number;
  nonMusicSkipped: number;
  skippedTracksSkipped: number;
  invalidRowsSkipped: number;
  totalTrackIds: number;
  resolvedTrackIds: number;
}

export class SpotifyHistoryImportError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "SpotifyHistoryImportError";
    this.statusCode = statusCode;
  }
}

interface ParsedImportRow {
  playedAt: string | null;
  trackId: string | null;
  skipped: boolean;
  isMusic: boolean;
}

interface ParsedImportFile {
  filename: string;
  rows: unknown[];
}

interface CandidatePlay {
  playedAt: string;
  trackId: string;
}

type ImportProgressReporter = (update: ImportProgressUpdate) => Promise<void> | void;

export interface ImportProgressUpdate extends Partial<SpotifyHistoryImportSummary> {
  phase?: string | null;
}

function sleep(delayMs: number) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function isJsonFilename(filename: string) {
  return filename.toLowerCase().endsWith(".json");
}

function isZipFilename(filename: string) {
  return filename.toLowerCase().endsWith(".zip");
}

function sanitizeUploadedFilename(filename: string, index: number) {
  const trimmed = basename(filename.trim());
  if (!trimmed) {
    return `upload-${index}.json`;
  }

  return trimmed.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function parseTrackId(uri: string | null) {
  if (!uri || !uri.startsWith("spotify:track:")) {
    return null;
  }

  const trackId = uri.slice("spotify:track:".length).trim();
  return trackId.length > 0 ? trackId : null;
}

function decodeJsonFile(filename: string, data: Uint8Array) {
  try {
    const parsed = JSON.parse(Buffer.from(data).toString("utf8")) as unknown;
    if (!Array.isArray(parsed)) {
      throw new SpotifyHistoryImportError(400, `${filename} did not contain a JSON array.`);
    }

    return {
      filename,
      rows: parsed,
    } satisfies ParsedImportFile;
  } catch (error) {
    if (error instanceof SpotifyHistoryImportError) {
      throw error;
    }

    throw new SpotifyHistoryImportError(400, `${filename} was not valid JSON.`);
  }
}

function collectParsedFiles(uploadPath: string) {
  const parsedFiles: ParsedImportFile[] = [];
  const uploadedFiles = readdirSync(uploadPath).sort();

  for (const filename of uploadedFiles) {
    const filePath = join(uploadPath, filename);
    const fileData = readFileSync(filePath);

    if (isJsonFilename(filename)) {
      parsedFiles.push(decodeJsonFile(filename, fileData));
      continue;
    }

    if (!isZipFilename(filename)) {
      throw new SpotifyHistoryImportError(400, `Unsupported file type for ${filename}.`);
    }

    let archiveEntries: Record<string, Uint8Array>;
    try {
      archiveEntries = unzipSync(new Uint8Array(fileData));
    } catch {
      throw new SpotifyHistoryImportError(400, `${filename} could not be read as a ZIP archive.`);
    }

    for (const [entryName, entryData] of Object.entries(archiveEntries)) {
      if (!isJsonFilename(entryName)) {
        continue;
      }

      parsedFiles.push(decodeJsonFile(entryName, entryData));
    }
  }

  if (parsedFiles.length === 0) {
    throw new SpotifyHistoryImportError(400, "No JSON history files were found in the upload.");
  }

  return parsedFiles;
}

function parseImportRow(row: unknown): ParsedImportRow {
  if (!row || typeof row !== "object") {
    return {
      playedAt: null,
      trackId: null,
      skipped: false,
      isMusic: false,
    };
  }

  const value = row as Record<string, unknown>;
  const playedAt =
    typeof value.ts === "string" && !Number.isNaN(Date.parse(value.ts))
      ? new Date(value.ts).toISOString()
      : null;
  const spotifyTrackUri =
    typeof value.spotify_track_uri === "string" ? value.spotify_track_uri : null;
  const trackId = parseTrackId(spotifyTrackUri);

  return {
    playedAt,
    trackId,
    skipped: value.skipped === true,
    isMusic: trackId !== null,
  };
}

function buildImportSummary(filesProcessed: number): SpotifyHistoryImportSummary {
  return {
    filesProcessed,
    rowsScanned: 0,
    imported: 0,
    duplicatesSkipped: 0,
    nonMusicSkipped: 0,
    skippedTracksSkipped: 0,
    invalidRowsSkipped: 0,
    totalTrackIds: 0,
    resolvedTrackIds: 0,
  };
}

function buildRecentlyPlayedItem(track: SpotifyTrack, playedAt: string): SpotifyRecentlyPlayedItem {
  return {
    played_at: playedAt,
    context: null,
    track,
  };
}

function getSpotifyRetryMetadata(error: unknown) {
  const status =
    error && typeof error === "object" && "status" in error && typeof error.status === "number"
      ? error.status
      : null;
  const retryAfterMs =
    error && typeof error === "object" && "retryAfter" in error && typeof error.retryAfter === "string"
      ? Number(error.retryAfter) * 1000
      : null;

  return {
    status,
    retryAfterMs,
  };
}

function loadLocalTracksBySpotifyId(database: DatabaseContext, trackIds: string[]) {
  const trackMap = new Map<string, SpotifyTrack>();

  for (const batch of chunkArray(trackIds, 200)) {
    const placeholders = batch.map(() => "?").join(", ");
    const rows = database.client
      .prepare(
        `
          SELECT
            tracks.spotify_id AS track_spotify_id,
            tracks.name AS track_name,
            tracks.disc_number AS disc_number,
            tracks.track_number AS track_number,
            tracks.duration_ms AS duration_ms,
            tracks.explicit AS explicit,
            tracks.isrc AS isrc,
            tracks.uri AS track_uri,
            tracks.href AS track_href,
            tracks.preview_url AS preview_url,
            albums.spotify_id AS album_spotify_id,
            albums.name AS album_name,
            albums.album_type AS album_type,
            albums.total_tracks AS total_tracks,
            albums.release_date AS release_date,
            albums.release_date_precision AS release_date_precision,
            albums.uri AS album_uri,
            albums.href AS album_href,
            albums.image_url AS album_image_url,
            (
              SELECT json_group_array(
                json_object(
                  'id', artists.spotify_id,
                  'name', artists.name,
                  'uri', artists.uri,
                  'href', artists.href
                )
              )
              FROM track_artists
              JOIN artists ON artists.id = track_artists.artist_id
              WHERE track_artists.track_id = tracks.id
            ) AS track_artists_json,
            (
              SELECT json_group_array(
                json_object(
                  'id', artists.spotify_id,
                  'name', artists.name,
                  'uri', artists.uri,
                  'href', artists.href
                )
              )
              FROM album_artists
              JOIN artists ON artists.id = album_artists.artist_id
              WHERE album_artists.album_id = albums.id
            ) AS album_artists_json
          FROM tracks
          JOIN albums ON albums.id = tracks.album_id
          WHERE tracks.spotify_id IN (${placeholders})
        `,
      )
      .all(...batch) as Array<{
      track_spotify_id: string;
      track_name: string;
      disc_number: number;
      track_number: number;
      duration_ms: number;
      explicit: number;
      isrc: string | null;
      track_uri: string;
      track_href: string;
      preview_url: string | null;
      album_spotify_id: string;
      album_name: string;
      album_type: string;
      total_tracks: number;
      release_date: string;
      release_date_precision: string;
      album_uri: string;
      album_href: string;
      album_image_url: string | null;
      track_artists_json: string | null;
      album_artists_json: string | null;
    }>;

    for (const row of rows) {
      trackMap.set(row.track_spotify_id, {
        id: row.track_spotify_id,
        name: row.track_name,
        disc_number: row.disc_number,
        track_number: row.track_number,
        duration_ms: row.duration_ms,
        explicit: Boolean(row.explicit),
        external_ids: row.isrc ? { isrc: row.isrc } : undefined,
        uri: row.track_uri,
        href: row.track_href,
        preview_url: row.preview_url,
        artists: row.track_artists_json ? (JSON.parse(row.track_artists_json) as SpotifyTrack["artists"]) : [],
        album: {
          id: row.album_spotify_id,
          name: row.album_name,
          album_type: row.album_type,
          total_tracks: row.total_tracks,
          release_date: row.release_date,
          release_date_precision: row.release_date_precision,
          uri: row.album_uri,
          href: row.album_href,
          images: row.album_image_url
            ? [{ url: row.album_image_url, height: null, width: null }]
            : [],
          artists: row.album_artists_json ? (JSON.parse(row.album_artists_json) as SpotifyTrack["artists"]) : [],
        },
      });
    }
  }

  return trackMap;
}

async function fetchTrackBatchWithRetry(
  spotify: SpotifyClient,
  accessToken: string,
  trackIds: string[],
  maxAttempts = 5,
) {
  let attempt = 0;

  while (attempt < maxAttempts) {
    try {
      return await spotify.fetchTracks(accessToken, trackIds);
    } catch (error) {
      attempt += 1;
      const { status, retryAfterMs } = getSpotifyRetryMetadata(error);

      if ((status === 429 || (status !== null && status >= 500)) && attempt < maxAttempts) {
        await sleep(retryAfterMs ?? attempt * 1000);
        continue;
      }

      throw error;
    }
  }

  return [];
}

export function stageSpotifyImportFiles(
  config: AppConfig,
  jobId: string,
  uploadedFiles: UploadedImportFile[],
) {
  if (uploadedFiles.length === 0) {
    throw new SpotifyHistoryImportError(400, "Choose at least one Spotify history file to import.");
  }

  const uploadPath = join(config.configDir, "import-jobs", jobId);
  mkdirSync(uploadPath, { recursive: true });

  const stagedFiles: string[] = [];

  for (const [index, file] of uploadedFiles.entries()) {
    const filename = sanitizeUploadedFilename(file.filename, index);
    if (!isJsonFilename(filename) && !isZipFilename(filename)) {
      throw new SpotifyHistoryImportError(400, `Unsupported file type for ${file.filename}.`);
    }

    writeFileSync(join(uploadPath, filename), file.data);
    stagedFiles.push(filename);
  }

  return {
    uploadPath,
    uploadedFiles: stagedFiles,
  };
}

async function reportResolveProgress(
  summary: SpotifyHistoryImportSummary,
  onProgress?: ImportProgressReporter,
) {
  await onProgress?.({
    phase: "resolving",
    resolvedTrackIds: summary.resolvedTrackIds,
    totalTrackIds: summary.totalTrackIds,
  });
}

function collectCandidateRows(parsedFiles: ParsedImportFile[], summary: SpotifyHistoryImportSummary) {
  const candidateRows: CandidatePlay[] = [];

  for (const file of parsedFiles) {
    for (const rawRow of file.rows) {
      summary.rowsScanned += 1;

      const row = parseImportRow(rawRow);
      if (!row.playedAt) {
        summary.invalidRowsSkipped += 1;
        continue;
      }

      if (!row.isMusic || !row.trackId) {
        summary.nonMusicSkipped += 1;
        continue;
      }

      if (row.skipped) {
        summary.skippedTracksSkipped += 1;
        continue;
      }

      candidateRows.push({
        trackId: row.trackId,
        playedAt: row.playedAt,
      });
    }
  }

  return candidateRows;
}

async function resolveTracksForImport(
  database: DatabaseContext,
  spotify: SpotifyClient,
  uniqueTrackIds: string[],
  summary: SpotifyHistoryImportSummary,
  onProgress?: ImportProgressReporter,
) {
  const localTracks = loadLocalTracksBySpotifyId(database, uniqueTrackIds);
  const trackById = new Map(localTracks);
  summary.resolvedTrackIds = trackById.size;

  await reportResolveProgress(summary, onProgress);

  const missingTrackIds = uniqueTrackIds.filter((trackId) => !trackById.has(trackId));
  if (missingTrackIds.length === 0) {
    return trackById;
  }

  const tokenState = await getAccessToken(database, spotify);
  if (!tokenState) {
    throw new SpotifyHistoryImportError(409, "Connect a Spotify account before importing history.");
  }

  for (const batch of chunkArray(missingTrackIds, 50)) {
    const catalogTracks = await fetchTrackBatchWithRetry(spotify, tokenState.accessToken, batch);
    for (const track of catalogTracks) {
      trackById.set(track.id, track);
    }

    summary.resolvedTrackIds = trackById.size;
    await reportResolveProgress(summary, onProgress);
  }

  return trackById;
}

function buildItemsToPersist(
  candidateRows: CandidatePlay[],
  trackById: Map<string, SpotifyTrack>,
  summary: SpotifyHistoryImportSummary,
) {
  const itemsToPersist: SpotifyRecentlyPlayedItem[] = [];

  for (const candidate of candidateRows) {
    const track = trackById.get(candidate.trackId);
    if (!track) {
      summary.invalidRowsSkipped += 1;
      continue;
    }

    itemsToPersist.push(buildRecentlyPlayedItem(track, candidate.playedAt));
  }

  return itemsToPersist;
}

export async function processSpotifyHistoryImport(
  database: DatabaseContext,
  spotify: SpotifyClient,
  uploadPath: string,
  onProgress?: ImportProgressReporter,
) {
  const parsedFiles = collectParsedFiles(uploadPath);
  const summary = buildImportSummary(parsedFiles.length);

  await onProgress?.({
    phase: "parsing",
    filesProcessed: summary.filesProcessed,
  });

  const candidateRows = collectCandidateRows(parsedFiles, summary);
  const uniqueTrackIds = Array.from(new Set(candidateRows.map((row) => row.trackId)));
  summary.totalTrackIds = uniqueTrackIds.length;

  await onProgress?.({
    phase: "resolving",
    rowsScanned: summary.rowsScanned,
    nonMusicSkipped: summary.nonMusicSkipped,
    skippedTracksSkipped: summary.skippedTracksSkipped,
    invalidRowsSkipped: summary.invalidRowsSkipped,
    totalTrackIds: summary.totalTrackIds,
  });

  const trackById = await resolveTracksForImport(
    database,
    spotify,
    uniqueTrackIds,
    summary,
    onProgress,
  );
  const itemsToPersist = buildItemsToPersist(candidateRows, trackById, summary);

  await onProgress?.({
    phase: "persisting",
    invalidRowsSkipped: summary.invalidRowsSkipped,
    resolvedTrackIds: summary.resolvedTrackIds,
    totalTrackIds: summary.totalTrackIds,
  });

  if (itemsToPersist.length > 0) {
    const result = await persistImportedPlayedItems(database, itemsToPersist);
    summary.imported = result.insertedPlayCount;
    summary.duplicatesSkipped = itemsToPersist.length - result.insertedPlayCount;
  }

  return summary;
}
