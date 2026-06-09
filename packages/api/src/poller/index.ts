import type { AppConfig } from "../config.js";
import type { DatabaseContext } from "../db/index.js";
import type { SpotifyClient } from "../auth/spotify.js";
import { getAccessToken, persistRecentlyPlayedItems } from "../services/repository.js";

interface PollerState {
  running: boolean;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  nextRunAt: string | null;
}

export function createPoller(
  database: DatabaseContext,
  spotify: SpotifyClient,
  config: AppConfig,
) {
  const state: PollerState = {
    running: false,
    lastRunAt: null,
    lastSuccessAt: null,
    lastError: null,
    nextRunAt: null,
  };

  let timer: NodeJS.Timeout | null = null;
  let stopped = false;

  const schedule = (delayMs: number) => {
    if (stopped) {
      return;
    }
    state.nextRunAt = new Date(Date.now() + delayMs).toISOString();
    timer = setTimeout(() => {
      void run();
    }, delayMs);
  };

  const run = async () => {
    state.running = true;
    state.lastRunAt = new Date().toISOString();
    state.lastError = null;

    try {
      const tokenState = await getAccessToken(database, spotify);
      if (!tokenState) {
        schedule(config.pollIntervalMs);
        return;
      }

      const after = tokenState.account.pollCursor ?? undefined;
      const recent = await spotify.fetchRecentlyPlayed(tokenState.accessToken, after);
      if (recent.items.length > 0) {
        await persistRecentlyPlayedItems(database, recent.items);
      }
      state.lastSuccessAt = new Date().toISOString();
      schedule(config.pollIntervalMs);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown poller error";
      state.lastError = message;
      const retryAfter =
        error &&
        typeof error === "object" &&
        "retryAfter" in error &&
        typeof error.retryAfter === "string"
          ? Number(error.retryAfter) * 1000
          : null;
      schedule(Math.min(retryAfter ?? config.pollIntervalMs, config.pollIntervalMs));
    } finally {
      state.running = false;
    }
  };

  return {
    start() {
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
    async trigger() {
      await run();
    },
  };
}
