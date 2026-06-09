import type { ChangeEvent, FormEvent } from "react";
import { useState } from "react";

import { ApiError, type SpotifyHistoryImportJob } from "../lib/api";
import { Shell, Button, InlineNotice } from "../components/Ui";
import { getErrorMessage } from "../lib/errors";
import {
  isActiveSpotifyHistoryImportJob,
  useBootstrapQuery,
  useDisconnectAccountMutation,
  useLogoutMutation,
  useStartSpotifyHistoryImportMutation,
  useTrackedSpotifyHistoryImportJobQuery,
} from "../lib/queries";

const SUPPORTED_IMPORT_EXTENSIONS = [".zip", ".json"];
const IMPORT_SUMMARY_FIELDS = [
  "uploadedFiles",
  "filesProcessed",
  "rowsScanned",
  "imported",
  "duplicatesSkipped",
  "nonMusicSkipped",
  "skippedTracksSkipped",
  "invalidRowsSkipped",
  "totalTrackIds",
  "resolvedTrackIds",
] as const;

function isSupportedImportFile(file: File) {
  const fileName = file.name.toLowerCase();

  return SUPPORTED_IMPORT_EXTENSIONS.some((extension) => fileName.endsWith(extension));
}

function formatSummaryLabel(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\w/, (character) => character.toUpperCase());
}

function formatOptionalSummaryLabel(value: string | null) {
  return value ? formatSummaryLabel(value) : "Not yet";
}

function formatTimestamp(value: string | null) {
  return value ? new Date(value).toLocaleString() : "Not yet";
}

function getImportSummaryCounts(job: SpotifyHistoryImportJob | null) {
  if (!job) {
    return [];
  }

  return IMPORT_SUMMARY_FIELDS.map((key) => ({
    key,
    label: formatSummaryLabel(key),
    value: job[key],
  }));
}

function getImportJobNotice(job: SpotifyHistoryImportJob | null) {
  if (!job) {
    return null;
  }

  if (job.status === "failed") {
    return {
      tone: "error" as const,
      message: job.errorMessage ?? "Spotify history import failed.",
    };
  }

  if (job.status === "completed") {
    return {
      tone: "success" as const,
      message: "Spotify history import completed.",
    };
  }

  if (job.status === "running") {
    return {
      tone: "neutral" as const,
      message: `Spotify history import is running${job.phase ? `: ${formatOptionalSummaryLabel(job.phase)}` : ""}.`,
    };
  }

  return {
    tone: "neutral" as const,
    message: "Spotify history import is queued and will start shortly.",
  };
}

export function SettingsPage() {
  const bootstrapQuery = useBootstrapQuery();
  const logoutMutation = useLogoutMutation();
  const disconnectMutation = useDisconnectAccountMutation();
  const importMutation = useStartSpotifyHistoryImportMutation();
  const [busyAction, setBusyAction] = useState<"logout" | "disconnect" | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [importValidationError, setImportValidationError] = useState<string | null>(null);
  const status = bootstrapQuery.data?.appStatus ?? null;
  const trackedJobQuery = useTrackedSpotifyHistoryImportJobQuery(Boolean(status), importMutation.data?.id ?? null);
  const importJob = trackedJobQuery.job ?? importMutation.data ?? null;
  const importSummaryCounts = getImportSummaryCounts(importJob);
  const importJobNotice = getImportJobNotice(importJob);
  const isImportBusy = importMutation.isPending || isActiveSpotifyHistoryImportJob(importJob);
  const importButtonLabel = importMutation.isPending
    ? "Starting import..."
    : isImportBusy
      ? "Import running..."
      : "Start import";

  async function handleLogout() {
    setBusyAction("logout");

    try {
      await logoutMutation.mutateAsync();
    } catch {
      return;
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDisconnect() {
    const confirmed = window.confirm(
      "Disconnect the Spotify account and return the app to reconnect-required state?",
    );

    if (!confirmed) {
      return;
    }

    setBusyAction("disconnect");

    try {
      await disconnectMutation.mutateAsync();
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        return;
      }
    } finally {
      setBusyAction(null);
    }
  }

  async function handleImportSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (selectedFiles.length === 0) {
      setImportValidationError("Choose at least one Spotify history export file to import.");
      return;
    }

    if (!selectedFiles.every(isSupportedImportFile)) {
      setImportValidationError("Only Spotify history `.zip` or `.json` exports are supported.");
      return;
    }

    setImportValidationError(null);

    try {
      await importMutation.mutateAsync(selectedFiles);
      setSelectedFiles([]);
    } catch {
      return;
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);

    importMutation.reset();

    if (files.length === 0) {
      setSelectedFiles([]);
      setImportValidationError(null);
      return;
    }

    if (!files.every(isSupportedImportFile)) {
      setSelectedFiles([]);
      setImportValidationError("Only Spotify history `.zip` or `.json` exports are supported.");
      event.target.value = "";
      return;
    }

    setSelectedFiles(files);
    setImportValidationError(null);
  }

  const sessionError =
    logoutMutation.error || disconnectMutation.error
      ? getErrorMessage(logoutMutation.error ?? disconnectMutation.error, "Unable to update session state.")
      : null;
  const importError = importValidationError
    ? importValidationError
    : importMutation.error
      ? getErrorMessage(importMutation.error, "Unable to start the Spotify history import job.")
      : trackedJobQuery.jobQuery.error
        ? getErrorMessage(trackedJobQuery.jobQuery.error, "Unable to refresh Spotify history import status.")
        : trackedJobQuery.latestJobQuery.error
          ? getErrorMessage(trackedJobQuery.latestJobQuery.error, "Unable to load Spotify history import status.")
          : null;

  return (
    <Shell title="Settings" subtitle="Manage your tracker">
      <div className="max-w-3xl space-y-8">
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-bold">Connected account</h2>
            <p className="text-sm text-(--text-secondary)">
              {status?.account
                ? "This account is the source for polling and all local analytics."
                : "No Spotify account connected. Reconnect to resume polling."}
            </p>
          </div>

          {status?.account ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-(--text-subdued)">Display name</p>
                <p className="mt-1 text-sm font-medium">{status.account.displayName}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-(--text-subdued)">Spotify ID</p>
                <p className="mt-1 text-sm font-medium">{status.account.spotifyId}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-(--text-subdued)">Email</p>
                <p className="mt-1 text-sm font-medium">{status.account.email ?? "Not provided"}</p>
              </div>
            </div>
          ) : null}
        </section>

        <section className="space-y-4 border-t border-(--border-subtle) pt-6">
          <h2 className="text-lg font-bold">System state</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-(--text-subdued)">Poller</p>
              <p className="mt-1 text-sm font-medium">{status?.poller.state ?? "idle"}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-(--text-subdued)">Last poll</p>
              <p className="mt-1 text-sm font-medium">
                {status?.poller.lastPollAt ? new Date(status.poller.lastPollAt).toLocaleString() : "Never"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-(--text-subdued)">Last result</p>
              <p className="mt-1 text-sm text-(--text-secondary)">
                {status?.poller.lastPollResult ?? "No result recorded"}
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4 border-t border-(--border-subtle) pt-6">
          <div>
            <h2 className="text-lg font-bold">Import Spotify history</h2>
            <p className="text-sm text-(--text-secondary)">
              Upload a Spotify Extended Streaming History export as a `.zip` or `.json` file. Imports run in the
              background and will appear here while they are processing.
            </p>
          </div>

          <form className="space-y-4" onSubmit={(event) => void handleImportSubmit(event)}>
            <label className="block space-y-2">
              <span className="block text-sm font-medium text-(--text-primary)">Export files</span>
              <input
                key={selectedFiles.map((file) => file.name).join("|") || "empty"}
                accept=".zip,.json,application/zip,application/json"
                className="block w-full rounded border border-(--border-subtle) bg-(--bg-tinted) px-4 py-3 text-sm text-(--text-primary) file:mr-4 file:rounded-full file:border-0 file:bg-(--accent) file:px-4 file:py-2 file:text-sm file:font-semibold file:text-black hover:file:bg-(--accent-highlight)"
                disabled={isImportBusy}
                multiple
                onChange={handleFileChange}
                type="file"
              />
            </label>

            <div className="space-y-1 text-sm text-(--text-subdued)">
              <p>
                {isImportBusy
                  ? "A Spotify history import job is already queued or running."
                  : "Accepted formats: one Spotify `.zip` export bundle or one or more `.json` history files."}
              </p>
              <p>
                {selectedFiles.length > 0
                  ? `Selected files: ${selectedFiles.map((file) => file.name).join(", ")}`
                  : "No files selected."}
              </p>
            </div>

            {importError ? <InlineNotice tone="error">{importError}</InlineNotice> : null}

            <div className="flex flex-wrap gap-3">
              <Button disabled={selectedFiles.length === 0 || isImportBusy} type="submit">
                {importButtonLabel}
              </Button>
            </div>
          </form>

          {importJob ? (
            <div className="space-y-4 rounded bg-(--bg-elevated) p-4">
              <div className="space-y-2">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wide text-(--text-subdued)">Latest import job</h3>
                  <p className="mt-1 text-sm text-(--text-secondary)">
                    Background job status and counters for the most recent Spotify history import.
                  </p>
                </div>

                {importJobNotice ? <InlineNotice tone={importJobNotice.tone}>{importJobNotice.message}</InlineNotice> : null}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-(--text-subdued)">Status</p>
                    <p className="mt-1 text-sm font-medium">{formatSummaryLabel(importJob.status)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-(--text-subdued)">Phase</p>
                    <p className="mt-1 text-sm font-medium">{formatOptionalSummaryLabel(importJob.phase)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-(--text-subdued)">Created</p>
                    <p className="mt-1 text-sm font-medium">{formatTimestamp(importJob.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-(--text-subdued)">Updated</p>
                    <p className="mt-1 text-sm font-medium">{formatTimestamp(importJob.updatedAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-(--text-subdued)">Started</p>
                    <p className="mt-1 text-sm font-medium">{formatTimestamp(importJob.startedAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-(--text-subdued)">Completed</p>
                    <p className="mt-1 text-sm font-medium">{formatTimestamp(importJob.completedAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-(--text-subdued)">Source</p>
                    <p className="mt-1 text-sm font-medium">{importJob.source}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-(--text-subdued)">Job ID</p>
                    <p className="mt-1 text-sm font-medium">{importJob.id}</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {importSummaryCounts.map((entry) => (
                  <div key={entry.key}>
                    <p className="text-xs font-medium uppercase tracking-wide text-(--text-subdued)">
                      {entry.label}
                    </p>
                    <p className="mt-1 text-lg font-bold">{entry.value.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <section className="space-y-4 border-t border-(--border-subtle) pt-6">
          <div>
            <h2 className="text-lg font-bold">Session</h2>
            <p className="text-sm text-(--text-secondary)">
              End your session or disconnect Spotify entirely.
            </p>
          </div>

          {sessionError ? <InlineNotice tone="error">{sessionError}</InlineNotice> : null}

          <div className="flex flex-wrap gap-3">
            <Button kind="secondary" disabled={busyAction !== null} onClick={() => void handleLogout()}>
              {busyAction === "logout" ? "Logging out..." : "Logout"}
            </Button>
            <Button kind="danger" disabled={busyAction !== null} onClick={() => void handleDisconnect()}>
              {busyAction === "disconnect" ? "Disconnecting..." : "Disconnect Spotify"}
            </Button>
          </div>

          <div className="space-y-2 text-sm text-(--text-subdued)">
            <p>Disconnecting stops future polling until Spotify is reconnected.</p>
            <p>Your local password remains in place.</p>
            <p>Previously collected listening history remains in the database.</p>
          </div>
        </section>
      </div>
    </Shell>
  );
}
