import type { FastifyInstance } from "fastify";

import { deleteHistoryItem, getHistoryPage } from "../services/repository.js";
import { parsePaginationQuery, parsePositiveId } from "./shared.js";

export async function registerHistoryRoutes(app: FastifyInstance) {
  app.get(
    "/api/history",
    {
      preHandler: app.locals.requireSession,
    },
    async (request, reply) => {
      const query = request.query as { limit?: string; offset?: string } | undefined;
      const pagination = parsePaginationQuery(query, 50);
      if ("error" in pagination) {
        reply.code(400).send({ error: pagination.error });
        return;
      }

      return getHistoryPage(app.locals.database, pagination.limit, pagination.offset);
    },
  );

  app.delete(
    "/api/history/:id",
    {
      preHandler: app.locals.requireSession,
    },
    async (request, reply) => {
      const params = request.params as { id?: string } | undefined;
      const id = parsePositiveId(params?.id);

      if (id === null) {
        reply.code(400).send({ error: "Invalid id" });
        return;
      }

      const deleted = await deleteHistoryItem(app.locals.database, id);
      if (!deleted) {
        reply.code(404).send({ error: "History item not found" });
        return;
      }

      reply.code(204).send();
    },
  );
}
