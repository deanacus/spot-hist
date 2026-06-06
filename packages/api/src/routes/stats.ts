import type { FastifyInstance } from "fastify";

import { getStats } from "../services/repository.js";

export async function registerStatsRoutes(app: FastifyInstance) {
  app.get(
    "/api/stats",
    {
      preHandler: app.locals.requireSession,
    },
    async () => getStats(app.locals.database),
  );
}
