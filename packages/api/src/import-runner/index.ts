import type { SpotifyClient } from "../auth/spotify.js";
import type { AppConfig } from "../config.js";
import type { DatabaseContext } from "../db/index.js";
import {
  claimNextImportJob,
  recoverImportJobs,
  updateImportJob,
} from "../services/import-jobs.js";
import { processSpotifyHistoryImport } from "../services/import.js";

export interface ImportRunnerState {
  running: boolean;
  currentJobId: string | null;
  lastRunAt: string | null;
  lastError: string | null;
  nextRunAt: string | null;
}

export function createImportRunner(
  database: DatabaseContext,
  spotify: SpotifyClient,
  config: AppConfig,
) {
  const state: ImportRunnerState = {
    running: false,
    currentJobId: null,
    lastRunAt: null,
    lastError: null,
    nextRunAt: null,
  };

  let timer: NodeJS.Timeout | null = null;
  let stopped = false;

  const schedule = (delayMs: number) => {
    if (stopped) {
      return;
    }

    if (timer) {
      clearTimeout(timer);
    }

    state.nextRunAt = new Date(Date.now() + delayMs).toISOString();
    timer = setTimeout(() => {
      void run();
    }, delayMs);
  };

  const run = async () => {
    if (state.running || stopped) {
      return;
    }

    state.running = true;
    state.lastRunAt = new Date().toISOString();
    state.lastError = null;

    try {
      const job = claimNextImportJob(database);
      if (!job) {
        schedule(config.pollIntervalMs);
        return;
      }

      state.currentJobId = job.id;

      try {
        const summary = await processSpotifyHistoryImport(
          database,
          spotify,
          job.uploadPath,
          async (progress) => {
            updateImportJob(database, job.id, progress);
          },
        );

        updateImportJob(database, job.id, {
          status: "completed",
          phase: "completed",
          filesProcessed: summary.filesProcessed,
          rowsScanned: summary.rowsScanned,
          imported: summary.imported,
          duplicatesSkipped: summary.duplicatesSkipped,
          nonMusicSkipped: summary.nonMusicSkipped,
          skippedTracksSkipped: summary.skippedTracksSkipped,
          invalidRowsSkipped: summary.invalidRowsSkipped,
          totalTrackIds: summary.totalTrackIds,
          resolvedTrackIds: summary.resolvedTrackIds,
          completedAt: new Date().toISOString(),
          errorMessage: null,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown import error";
        updateImportJob(database, job.id, {
          status: "failed",
          phase: "failed",
          errorMessage: message,
          completedAt: new Date().toISOString(),
        });
        state.lastError = message;
      }

      schedule(0);
    } finally {
      state.currentJobId = null;
      state.running = false;
    }
  };

  return {
    start() {
      recoverImportJobs(database);
      schedule(0);
    },
    stop() {
      stopped = true;
      if (timer) {
        clearTimeout(timer);
      }
    },
    getState() {
      return state;
    },
    trigger() {
      schedule(0);
    },
  };
}
