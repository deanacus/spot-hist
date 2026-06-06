import { resolve } from "node:path";
import { z } from "zod";

const envSchema = z.object({
  SPOTIFY_CLIENT_ID: z.string().min(1),
  SPOTIFY_CLIENT_SECRET: z.string().min(1),
  SPOTIFY_REDIRECT_URI: z.string().url(),
  ENCRYPTION_KEY: z
    .string()
    .regex(/^[a-fA-F0-9]{64}$/, "ENCRYPTION_KEY must be 64 hex characters"),
  POLL_INTERVAL_MS: z.coerce.number().int().positive().default(300_000),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  CONFIG_DIR: z.string().min(1).default("/config"),
  SESSION_IDLE_TIMEOUT_MS: z.coerce.number().int().positive().default(1_800_000),
});

export type AppConfig = ReturnType<typeof loadConfig>;

export function loadConfig(source: NodeJS.ProcessEnv = process.env) {
  const env = envSchema.parse(source);

  return {
    spotifyClientId: env.SPOTIFY_CLIENT_ID,
    spotifyClientSecret: env.SPOTIFY_CLIENT_SECRET,
    spotifyRedirectUri: env.SPOTIFY_REDIRECT_URI,
    encryptionKey: Buffer.from(env.ENCRYPTION_KEY, "hex"),
    pollIntervalMs: env.POLL_INTERVAL_MS,
    port: env.PORT,
    logLevel: env.LOG_LEVEL,
    configDir: resolve(env.CONFIG_DIR),
    sessionIdleTimeoutMs: env.SESSION_IDLE_TIMEOUT_MS,
  };
}
