import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import {
  type ImportJobSummary,
  createImportJob,
  getImportJobById,
  getLatestImportJob,
  ImportJobConflictError,
  updateImportJob,
} from "../services/import-jobs.js";
import {
  stageSpotifyImportFiles,
  SpotifyHistoryImportError,
  type UploadedImportFile,
} from "../services/import.js";

function toImportJobResponse(job: ImportJobSummary | null) {
  if (!job) {
    return null;
  }

  return {
    id: job.id,
    source: job.source,
    status: job.status,
    phase: job.phase,
    uploadedFiles: job.uploadedFiles,
    filesProcessed: job.filesProcessed,
    rowsScanned: job.rowsScanned,
    imported: job.imported,
    duplicatesSkipped: job.duplicatesSkipped,
    nonMusicSkipped: job.nonMusicSkipped,
    skippedTracksSkipped: job.skippedTracksSkipped,
    invalidRowsSkipped: job.invalidRowsSkipped,
    totalTrackIds: job.totalTrackIds,
    resolvedTrackIds: job.resolvedTrackIds,
    errorMessage: job.errorMessage,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
  };
}

async function readUploadedImportFiles(request: FastifyRequest) {
  const uploadedFiles: UploadedImportFile[] = [];

  for await (const part of request.parts()) {
    if (part.type !== "file") {
      continue;
    }

    uploadedFiles.push({
      filename: part.filename,
      contentType: part.mimetype,
      data: await part.toBuffer(),
    });
  }

  return uploadedFiles;
}

function failImportJob(app: FastifyInstance, jobId: string, message: string) {
  updateImportJob(app.locals.database, jobId, {
    status: "failed",
    phase: "failed",
    errorMessage: message,
    completedAt: new Date().toISOString(),
  });
}

function sendImportError(
  reply: FastifyReply,
  statusCode: number,
  message: string,
  extra: Record<string, unknown> = {},
) {
  reply.code(statusCode).send({
    message,
    ...extra,
  });
}

export async function registerImportRoutes(app: FastifyInstance) {
  app.post(
    "/api/imports/spotify-history",
    {
      preHandler: app.locals.requireSession,
    },
    async (request, reply) => {
      if (!request.isMultipart()) {
        reply.code(400).send({
          message: "Upload a Spotify history ZIP or JSON file.",
        });
        return;
      }

      let jobId: string | null = null;

      try {
        const uploadedFiles = await readUploadedImportFiles(request);

        if (uploadedFiles.length === 0) {
          throw new SpotifyHistoryImportError(400, "Choose at least one Spotify history file to import.");
        }

        const job = createImportJob(app.locals.database, {
          uploadPath: "__pending__",
          uploadedFiles: [],
        });
        jobId = job.id;

        const stagedFiles = stageSpotifyImportFiles(app.locals.config, job.id, uploadedFiles);
        const stagedJob = updateImportJob(app.locals.database, job.id, {
          uploadPath: stagedFiles.uploadPath,
          uploadedFiles: stagedFiles.uploadedFiles,
        });

        app.locals.importRunner.trigger();

        reply.code(202).send(toImportJobResponse(stagedJob));
      } catch (error) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "FST_REQ_FILE_TOO_LARGE"
        ) {
          sendImportError(reply, 413, "Spotify history uploads are limited to 10 MB per file.");
          return;
        }

        if (error instanceof ImportJobConflictError) {
          sendImportError(reply, 409, "A Spotify history import is already running.", {
            job: toImportJobResponse(error.job),
          });
          return;
        }

        if (error instanceof SpotifyHistoryImportError) {
          if (jobId) {
            failImportJob(app, jobId, error.message);
          }

          sendImportError(reply, error.statusCode, error.message);
          return;
        }

        if (jobId) {
          failImportJob(app, jobId, "Unable to start Spotify history import right now.");
        }

        request.log.error({ err: error }, "Unable to enqueue Spotify history import.");
        sendImportError(reply, 500, "Unable to start Spotify history import right now.");
      }
    },
  );

  app.get(
    "/api/imports/spotify-history/latest",
    {
      preHandler: app.locals.requireSession,
    },
    async () => {
      return toImportJobResponse(getLatestImportJob(app.locals.database));
    },
  );

  app.get(
    "/api/imports/spotify-history/:id",
    {
      preHandler: app.locals.requireSession,
    },
    async (request, reply) => {
      const params = request.params as { id?: string } | undefined;
      if (!params?.id) {
        reply.code(400).send({
          message: "Import job id is required.",
        });
        return;
      }

      const job = getImportJobById(app.locals.database, params.id);
      if (!job || job.source !== "spotify_history") {
        reply.code(404).send({
          message: "Import job not found.",
        });
        return;
      }

      return toImportJobResponse(job);
    },
  );
}
