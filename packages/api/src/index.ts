import { buildApp } from "./app.js";

const app = await buildApp();

try {
  await app.listen({
    host: "0.0.0.0",
    port: app.locals.config.port,
  });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
