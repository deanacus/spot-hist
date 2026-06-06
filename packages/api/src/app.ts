import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import cookie from "@fastify/cookie";
import formbody from "@fastify/formbody";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";

import { createSpotifyClient, type SpotifyClient } from "./auth/spotify.js";
import { requireSession } from "./auth/session.js";
import { loadConfig, type AppConfig } from "./config.js";
import { createDatabase, type DatabaseContext } from "./db/index.js";
import { createPoller } from "./poller/index.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerDetailRoutes } from "./routes/details.js";
import { registerHistoryRoutes } from "./routes/history.js";
import { registerSetupRoutes } from "./routes/setup.js";
import { registerStatsRoutes } from "./routes/stats.js";
import { registerStatusRoutes } from "./routes/status.js";
import { registerTopRoutes } from "./routes/top.js";

export interface BuildAppOptions {
  config?: AppConfig;
  database?: DatabaseContext;
  spotify?: SpotifyClient;
  publicDir?: string;
  skipPoller?: boolean;
}

function resolvePublicDir(explicitDir?: string) {
  if (explicitDir) {
    return explicitDir;
  }

  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(process.cwd(), "public"),
    join(process.cwd(), "packages/web/dist"),
    join(moduleDir, "../../public"),
    join(moduleDir, "../../../packages/web/dist"),
  ];

  return candidates.find((candidate) => existsSync(candidate));
}

export async function buildApp(options: BuildAppOptions = {}) {
  const config = options.config ?? loadConfig();
  const database = options.database ?? createDatabase(config);
  const spotify = options.spotify ?? createSpotifyClient(config);
  const app = Fastify({
    logger: {
      level: config.logLevel,
    },
  });

  app.decorate("locals", {
    config,
    database,
    spotify,
    requireSession: (request, reply) => requireSession(request, reply, database, config),
    poller: createPoller(database, spotify, config),
  });

  await app.register(cookie);
  await app.register(formbody);

  await registerSetupRoutes(app);
  await registerAuthRoutes(app);
  await registerStatusRoutes(app);
  await registerHistoryRoutes(app);
  await registerStatsRoutes(app);
  await registerTopRoutes(app);
  await registerDetailRoutes(app);

  const publicDir = resolvePublicDir(options.publicDir);

  if (publicDir) {
    await app.register(fastifyStatic, {
      root: publicDir,
      prefix: "/",
      wildcard: false,
    });

    app.get("/*", async (_request, reply) => {
      await reply.sendFile("index.html");
    });
  }

  if (!options.skipPoller) {
    app.addHook("onReady", async () => {
      app.locals.poller.start();
    });
  }

  app.addHook("onClose", async () => {
    app.locals.poller.stop();
    database.client.close();
  });

  return app;
}

declare module "fastify" {
  interface FastifyInstance {
    locals: {
      config: AppConfig;
      database: DatabaseContext;
      spotify: SpotifyClient;
      requireSession: (request: Parameters<typeof requireSession>[0], reply: Parameters<typeof requireSession>[1]) => Promise<void>;
      poller: ReturnType<typeof createPoller>;
    };
  }
}
