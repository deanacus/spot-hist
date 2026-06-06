import type { FastifyInstance } from "fastify";

import { getStatus } from "../services/repository.js";

export async function registerStatusRoutes(app: FastifyInstance) {
  app.get(
    "/api/status",
    {
      preHandler: app.locals.requireSession,
    },
    async () => {
      const status = await getStatus(app.locals.database);
      const pollerState = app.locals.poller.getState();

      return {
        ok: true,
        dbPath: app.locals.database.path,
        account: status.account
          ? {
              spotifyId: status.account.spotifyId,
              displayName: status.account.displayName,
              email: status.account.email,
            }
          : null,
        connection: status.account
          ? {
              spotifyId: status.account.spotifyId,
              displayName: status.account.displayName,
              email: status.account.email,
              tokenExpiresAt: status.account.tokenExpiresAt,
              pollCursor: status.account.pollCursor,
            }
          : null,
        latestPlayAt: status.latestPlay?.playedAt ?? null,
        poller: {
          state: pollerState.running ? "running" : pollerState.lastError ? "degraded" : "idle",
          lastPollAt: pollerState.lastRunAt,
          lastPollResult: pollerState.lastError ?? (pollerState.lastSuccessAt ? "Poll completed" : null),
          nextRunAt: pollerState.nextRunAt,
        },
      };
    },
  );
}
