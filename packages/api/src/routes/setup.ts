import bcrypt from "bcryptjs";
import type { FastifyInstance } from "fastify";

import { ensurePassword, getSetupStatus } from "../services/repository.js";

export async function registerSetupRoutes(app: FastifyInstance) {
  app.get("/api/setup/status", async () => getSetupStatus(app.locals.database));

  app.post("/api/setup/password", async (request, reply) => {
    const body = request.body as { password?: string } | undefined;
    const password = body?.password?.trim();

    if (!password) {
      reply.code(400).send({ error: "Password is required" });
      return;
    }

    try {
      await ensurePassword(app.locals.database, await bcrypt.hash(password, 10));
      reply.code(204).send();
    } catch (error) {
      reply.code(409).send({
        error: error instanceof Error ? error.message : "Unable to set password",
      });
    }
  });
}
