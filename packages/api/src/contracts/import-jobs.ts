export type SpotifyHistoryImportJobStatus = "queued" | "running" | "completed" | "failed";

export interface SpotifyHistoryImportJobSnapshot {
  id: string;
  source: string;
  status: SpotifyHistoryImportJobStatus;
  phase: string | null;
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
