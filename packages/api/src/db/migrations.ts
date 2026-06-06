import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type Database from "better-sqlite3";

const migrationDir = join(dirname(fileURLToPath(import.meta.url)), "../../drizzle/migrations");

export function runMigrations(client: Database.Database) {
  client.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const rows = client.prepare("SELECT name FROM _migrations").all() as Array<{ name: string }>;
  const applied = new Set(rows.map((row) => row.name));

  const files = readdirSync(migrationDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (applied.has(file)) {
      continue;
    }

    const sql = readFileSync(join(migrationDir, file), "utf8");
    const transaction = client.transaction(() => {
      client.exec(sql);
      client
        .prepare("INSERT INTO _migrations (name, applied_at) VALUES (?, ?)")
        .run(file, new Date().toISOString());
    });
    transaction();
  }
}
