import type { FastifyInstance } from "fastify";

import { getHistoryPage } from "../services/repository.js";

export async function registerHistoryRoutes(app: FastifyInstance) {
  app.get(
    "/api/history",
    {
      preHandler: app.locals.requireSession,
    },
    async (request, reply) => {
      const query = request.query as { limit?: string; cursor?: string } | undefined;
      const limit = Math.min(Math.max(Number(query?.limit ?? 50), 1), 200);
      if (Number.isNaN(limit)) {
        reply.code(400).send({ error: "Invalid limit" });
        return;
      }

      return getHistoryPage(app.locals.database, limit, query?.cursor);
    },
  );
}
