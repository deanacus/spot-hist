import { mkdirSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import type { AppConfig } from "../config.js";
import { runMigrations } from "./migrations.js";
import { schema } from "./schema.js";

export interface DatabaseContext {
  client: Database.Database;
  db: ReturnType<typeof drizzle<typeof schema>>;
  path: string;
}

export function createDatabase(config: AppConfig): DatabaseContext {
  mkdirSync(config.configDir, { recursive: true });
  const path = join(config.configDir, "spot-hist.db");
  const client = new Database(path);
  client.pragma("journal_mode = WAL");
  client.pragma("foreign_keys = ON");
  runMigrations(client);

  return {
    client,
    db: drizzle(client, { schema }),
    path,
  };
}
