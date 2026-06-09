import type { ChangeEvent, FormEvent } from "react";
import { useState } from "react";

import { ApiError, type AppStatus, type SpotifyHistoryImportJob } from "../lib/api";
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

function SettingsSectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="text-sm text-(--text-secondary)">{description}</p>
    </div>
  );
}

function useSessionActionState() {
  const logoutMutation = useLogoutMutation();
  const disconnectMutation = useDisconnectAccountMutation();
  const [busyAction, setBusyAction] = useState<"logout" | "disconnect" | null>(null);

  const sessionError =
    logoutMutation.error || disconnectMutation.error
      ? getErrorMessage(logoutMutation.error ?? disconnectMutation.error, "Unable to update session state.")
      : null;

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

  return {
    busyAction,
    sessionError,
    handleLogout,
    handleDisconnect,
  };
}

function useImportState(enabled: boolean) {
  const importMutation = useStartSpotifyHistoryImportMutation();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [importValidationError, setImportValidationError] = useState<string | null>(null);
  const trackedJobQuery = useTrackedSpotifyHistoryImportJobQuery(enabled, importMutation.data?.id ?? null);
  const importJob = trackedJobQuery.job ?? importMutation.data ?? null;
  const importSummaryCounts = getImportSummaryCounts(importJob);
  const importJobNotice = getImportJobNotice(importJob);
  const isImportBusy = importMutation.isPending || isActiveSpotifyHistoryImportJob(importJob);
  const importButtonLabel = importMutation.isPending
    ? "Starting import..."
    : isImportBusy
      ? "Import running..."
      : "Start import";

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

  const importError = importValidationError
    ? importValidationError
    : importMutation.error
      ? getErrorMessage(importMutation.error, "Unable to start the Spotify history import job.")
      : trackedJobQuery.jobQuery.error
        ? getErrorMessage(trackedJobQuery.jobQuery.error, "Unable to refresh Spotify history import status.")
        : trackedJobQuery.latestJobQuery.error
          ? getErrorMessage(trackedJobQuery.latestJobQuery.error, "Unable to load Spotify history import status.")
          : null;

  return {
    selectedFiles,
    importSummaryCounts,
    importJobNotice,
    importJob,
    importError,
    isImportBusy,
    importButtonLabel,
    handleImportSubmit,
    handleFileChange,
  };
}

function ConnectedAccountSection({ account }: { account: AppStatus["account"] }) {
  return (
    <section className="space-y-4">
      <SettingsSectionHeader
        title="Connected account"
        description={
          account
            ? "This account is the source for polling and all local analytics."
            : "No Spotify account connected. Reconnect to resume polling."
        }
      />

      {account ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-(--text-subdued)">Display name</p>
            <p className="mt-1 text-sm font-medium">{account.displayName}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-(--text-subdued)">Spotify ID</p>
            <p className="mt-1 text-sm font-medium">{account.spotifyId}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-(--text-subdued)">Email</p>
            <p className="mt-1 text-sm font-medium">{account.email ?? "Not provided"}</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function SystemStateSection({ poller }: { poller: AppStatus["poller"] | null | undefined }) {
  return (
    <section className="space-y-4 border-t border-(--border-subtle) pt-6">
      <SettingsSectionHeader title="System state" description="Current polling status for the tracker." />
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-(--text-subdued)">Poller</p>
          <p className="mt-1 text-sm font-medium">{poller?.state ?? "idle"}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-(--text-subdued)">Last poll</p>
          <p className="mt-1 text-sm font-medium">
            {poller?.lastPollAt ? new Date(poller.lastPollAt).toLocaleString() : "Never"}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-(--text-subdued)">Last result</p>
          <p className="mt-1 text-sm text-(--text-secondary)">{poller?.lastPollResult ?? "No result recorded"}</p>
        </div>
      </div>
    </section>
  );
}

function ImportJobCard({
  job,
  notice,
  summaryCounts,
}: {
  job: SpotifyHistoryImportJob;
  notice: ReturnType<typeof getImportJobNotice>;
  summaryCounts: ReturnType<typeof getImportSummaryCounts>;
}) {
  return (
    <div className="space-y-4 rounded bg-(--bg-elevated) p-4">
      <div className="space-y-2">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide text-(--text-subdued)">Latest import job</h3>
          <p className="mt-1 text-sm text-(--text-secondary)">
            Background job status and counters for the most recent Spotify history import.
          </p>
        </div>

        {notice ? <InlineNotice tone={notice.tone}>{notice.message}</InlineNotice> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-(--text-subdued)">Status</p>
            <p className="mt-1 text-sm font-medium">{formatSummaryLabel(job.status)}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-(--text-subdued)">Phase</p>
            <p className="mt-1 text-sm font-medium">{formatOptionalSummaryLabel(job.phase)}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-(--text-subdued)">Created</p>
            <p className="mt-1 text-sm font-medium">{formatTimestamp(job.createdAt)}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-(--text-subdued)">Updated</p>
            <p className="mt-1 text-sm font-medium">{formatTimestamp(job.updatedAt)}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-(--text-subdued)">Started</p>
            <p className="mt-1 text-sm font-medium">{formatTimestamp(job.startedAt)}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-(--text-subdued)">Completed</p>
            <p className="mt-1 text-sm font-medium">{formatTimestamp(job.completedAt)}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-(--text-subdued)">Source</p>
            <p className="mt-1 text-sm font-medium">{job.source}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-(--text-subdued)">Job ID</p>
            <p className="mt-1 text-sm font-medium">{job.id}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {summaryCounts.map((entry) => (
          <div key={entry.key}>
            <p className="text-xs font-medium uppercase tracking-wide text-(--text-subdued)">{entry.label}</p>
            <p className="mt-1 text-lg font-bold">{entry.value.toLocaleString()}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ImportHistorySection({
  selectedFiles,
  importError,
  isImportBusy,
  importButtonLabel,
  importJob,
  importJobNotice,
  importSummaryCounts,
  onSubmit,
  onFileChange,
}: {
  selectedFiles: File[];
  importError: string | null;
  isImportBusy: boolean;
  importButtonLabel: string;
  importJob: SpotifyHistoryImportJob | null;
  importJobNotice: ReturnType<typeof getImportJobNotice>;
  importSummaryCounts: ReturnType<typeof getImportSummaryCounts>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  const selectedFileNames =
    selectedFiles.length > 0
      ? `Selected files: ${selectedFiles.map((file) => file.name).join(", ")}`
      : "No files selected.";

  return (
    <section className="space-y-4 border-t border-(--border-subtle) pt-6">
      <SettingsSectionHeader
        title="Import Spotify history"
        description="Upload a Spotify Extended Streaming History export as a `.zip` or `.json` file. Imports run in the background and will appear here while they are processing."
      />

      <form className="space-y-4" onSubmit={(event) => void onSubmit(event)}>
        <label className="block space-y-2">
          <span className="block text-sm font-medium text-(--text-primary)">Export files</span>
          <input
            key={selectedFiles.map((file) => file.name).join("|") || "empty"}
            accept=".zip,.json,application/zip,application/json"
            className="block w-full rounded border border-(--border-subtle) bg-(--bg-tinted) px-4 py-3 text-sm text-(--text-primary) file:mr-4 file:rounded-full file:border-0 file:bg-(--accent) file:px-4 file:py-2 file:text-sm file:font-semibold file:text-black hover:file:bg-(--accent-highlight)"
            disabled={isImportBusy}
            multiple
            onChange={onFileChange}
            type="file"
          />
        </label>

        <div className="space-y-1 text-sm text-(--text-subdued)">
          <p>
            {isImportBusy
              ? "A Spotify history import job is already queued or running."
              : "Accepted formats: one Spotify `.zip` export bundle or one or more `.json` history files."}
          </p>
          <p>{selectedFileNames}</p>
        </div>

        {importError ? <InlineNotice tone="error">{importError}</InlineNotice> : null}

        <div className="flex flex-wrap gap-3">
          <Button disabled={selectedFiles.length === 0 || isImportBusy} type="submit">
            {importButtonLabel}
          </Button>
        </div>
      </form>

      {importJob ? (
        <ImportJobCard job={importJob} notice={importJobNotice} summaryCounts={importSummaryCounts} />
      ) : null}
    </section>
  );
}

function SessionSection({
  sessionError,
  busyAction,
  onLogout,
  onDisconnect,
}: {
  sessionError: string | null;
  busyAction: "logout" | "disconnect" | null;
  onLogout: () => Promise<void>;
  onDisconnect: () => Promise<void>;
}) {
  return (
    <section className="space-y-4 border-t border-(--border-subtle) pt-6">
      <SettingsSectionHeader
        title="Session"
        description="End your session or disconnect Spotify entirely."
      />

      {sessionError ? <InlineNotice tone="error">{sessionError}</InlineNotice> : null}

      <div className="flex flex-wrap gap-3">
        <Button kind="secondary" disabled={busyAction !== null} onClick={() => void onLogout()}>
          {busyAction === "logout" ? "Logging out..." : "Logout"}
        </Button>
        <Button kind="danger" disabled={busyAction !== null} onClick={() => void onDisconnect()}>
          {busyAction === "disconnect" ? "Disconnecting..." : "Disconnect Spotify"}
        </Button>
      </div>

      <div className="space-y-2 text-sm text-(--text-subdued)">
        <p>Disconnecting stops future polling until Spotify is reconnected.</p>
        <p>Your local password remains in place.</p>
        <p>Previously collected listening history remains in the database.</p>
      </div>
    </section>
  );
}

export function SettingsPage() {
  const bootstrapQuery = useBootstrapQuery();
  const status = bootstrapQuery.data?.appStatus ?? null;
  const sessionState = useSessionActionState();
  const importState = useImportState(Boolean(status));

  return (
    <Shell title="Settings" subtitle="Manage your tracker">
      <div className="max-w-3xl space-y-8">
        <ConnectedAccountSection account={status?.account ?? null} />
        <SystemStateSection poller={status?.poller} />
        <ImportHistorySection
          selectedFiles={importState.selectedFiles}
          importError={importState.importError}
          isImportBusy={importState.isImportBusy}
          importButtonLabel={importState.importButtonLabel}
          importJob={importState.importJob}
          importJobNotice={importState.importJobNotice}
          importSummaryCounts={importState.importSummaryCounts}
          onSubmit={importState.handleImportSubmit}
          onFileChange={importState.handleFileChange}
        />
        <SessionSection
          sessionError={sessionState.sessionError}
          busyAction={sessionState.busyAction}
          onLogout={sessionState.handleLogout}
          onDisconnect={sessionState.handleDisconnect}
        />
      </div>
    </Shell>
  );
}
