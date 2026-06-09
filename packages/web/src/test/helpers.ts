import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { AppStatus, SpotifyHistoryImportJob } from "../lib/api";
import { installFetchMock, waitForPathname } from "./harness";

type FetchMockRoutes = Parameters<typeof installFetchMock>[0];

export function makeSetupStatus() {
  return { setupComplete: true, spotifyConnected: true, passwordSet: true };
}

export function makeAppStatus(): AppStatus {
  return {
    poller: {
      state: "running",
      lastPollAt: "2026-06-03T06:00:00.000Z",
      lastPollResult: "Fetched 5 plays",
    },
    account: {
      displayName: "Dana",
      email: "dana@example.com",
      spotifyId: "user_1",
    },
  };
}

export function makePage<T>(items: T[], options?: Partial<{ total: number; offset: number; limit: number }>) {
  return {
    items,
    total: options?.total ?? items.length,
    offset: options?.offset ?? 0,
    limit: options?.limit ?? items.length,
  };
}

export function makeImportJob(overrides: Partial<SpotifyHistoryImportJob> = {}): SpotifyHistoryImportJob {
  return {
    id: "job_1",
    source: "spotify_history",
    status: "queued",
    phase: "upload_received",
    uploadedFiles: ["Streaming_History_Audio_2025.json"],
    filesProcessed: 0,
    rowsScanned: 0,
    imported: 0,
    duplicatesSkipped: 0,
    nonMusicSkipped: 0,
    skippedTracksSkipped: 0,
    invalidRowsSkipped: 0,
    totalTrackIds: 0,
    resolvedTrackIds: 0,
    errorMessage: null,
    createdAt: "2026-06-03T06:00:00.000Z",
    updatedAt: "2026-06-03T06:00:00.000Z",
    startedAt: null,
    completedAt: null,
    ...overrides,
  };
}

export function installAuthenticatedFetchMock(routes: FetchMockRoutes, options?: {
  setupStatus?: FetchMockRoutes["GET /api/setup/status"];
  appStatus?: FetchMockRoutes["GET /api/status"];
}) {
  return installFetchMock({
    "GET /api/setup/status": options?.setupStatus ?? { body: makeSetupStatus() },
    "GET /api/status": options?.appStatus ?? { body: makeAppStatus() },
    ...routes,
  });
}

export async function openScrobbleDeleteConfirmation(container?: HTMLElement) {
  const scope = container ? within(container) : screen;
  const user = userEvent.setup();

  await user.click(scope.getByRole("button", { name: "Scrobble actions" }));
  await user.click(scope.getByRole("button", { name: "Delete" }));

  return {
    scope,
    user,
  };
}

export async function confirmScrobbleDeletion(container?: HTMLElement) {
  const { scope, user } = await openScrobbleDeleteConfirmation(container);
  await user.click(scope.getByRole("button", { name: "Delete" }));
}

export async function cancelScrobbleDeletion(container?: HTMLElement) {
  const { scope, user } = await openScrobbleDeleteConfirmation(container);
  await user.click(scope.getByRole("button", { name: "Cancel" }));
}

export async function expectNumberedPaginationFlow(options: {
  pageOneLabel: string;
  pageTwoLabel: string;
  nextPath: string;
  previousPath: string;
  expectedRequestUrl: string;
  fetchMock: { calls: Array<{ url: string }> };
}) {
  const user = userEvent.setup();

  expect(await screen.findByText(options.pageOneLabel)).toBeInTheDocument();
  expect(screen.getByText("1")).toHaveAttribute("aria-current", "page");

  await user.click(screen.getByRole("link", { name: "Next" }));

  expect(await screen.findByText(options.pageTwoLabel)).toBeInTheDocument();
  await waitForPathname(options.nextPath);
  expect(screen.getByText("2")).toHaveAttribute("aria-current", "page");
  expect(options.fetchMock.calls.map((call) => call.url)).toContain(options.expectedRequestUrl);

  await user.click(screen.getByRole("link", { name: "Previous" }));

  expect(await screen.findByText(options.pageOneLabel)).toBeInTheDocument();
  await waitForPathname(options.previousPath);
}
