# Spotify History Tracker

A self-hosted application (single Docker container) that continuously collects a user's Spotify listening history via the Recently Played API and stores the complete, normalized data in SQLite. Includes a React SPA frontend for viewing history, basic stats, and managing the Spotify connection. Designed for single-user deployment on UNRAID, inspired by apps like Sonarr and Radarr.

## Goals

- Capture **all** data returned by the Spotify Recently Played endpoint — no filtering or thresholds
- Run unattended in the background with automatic token refresh
- Normalize data into proper relational entities (tracks, albums, artists, etc.)
- Deduplicate plays so re-polling the same window doesn't create duplicates
- Provide a React-based web UI for viewing listening history and basic stats
- Be simple to deploy as a single Docker container on UNRAID

## Tech Stack

| Layer           | Choice         | Rationale                                              |
| --------------- | -------------- | ------------------------------------------------------ |
| Language        | TypeScript     | Type safety, shared types across monorepo              |
| Runtime         | Node.js        | Mature, great for background services + web servers    |
| Backend         | Fastify        | Lightweight, fast, excellent TypeScript support         |
| ORM             | Drizzle        | Type-safe, SQL-like syntax, great migrations           |
| Database        | SQLite         | Embedded, single file, no separate container needed    |
| Frontend        | React + Vite   | Fast builds, modern DX, standard SPA tooling           |
| Styling         | Tailwind CSS 4 | Utility-first, fast iteration, small bundle            |
| Package Manager | pnpm           | Fast, disk-efficient, excellent workspace support      |
| Container       | Docker         | Single container with `/config` volume for data        |

## Architecture

Monorepo with two packages (`packages/api` and `packages/web`) that build into a single Docker container. At runtime, one Fastify process serves both the API endpoints and the built React SPA as static files.

### Runtime Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Docker Container                                       │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Node.js Process (Fastify)                        │  │
│  │                                                   │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  │  │
│  │  │  REST API  │  │   Static   │  │   Poll     │  │  │
│  │  │  Routes    │  │   Files    │  │   Worker   │  │  │
│  │  │  /api/*    │  │   (React)  │  │ (interval) │  │  │
│  │  └────────────┘  └────────────┘  └────────────┘  │  │
│  └──────────────────────┬────────────────────────────┘  │
│                         │                               │
│  ┌──────────────────────▼────────────────────────────┐  │
│  │  /config/spot-hist.db (SQLite)                    │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  Volume: /config (persistent)                           │
└─────────────────────────────────────────────────────────┘
```

### Development Structure (Monorepo)

```
┌─────────────────────────────┐     ┌─────────────────────────────┐
│  packages/web               │     │  packages/api               │
│  (Vite dev server :5173)    │────►│  (Fastify dev server :3000) │
│  React SPA                  │HTTP │  REST API + Poll Worker     │
└─────────────────────────────┘     └─────────────────────────────┘
```

In development, the Vite dev server proxies API requests to Fastify. In production, Fastify serves the built SPA directly.

## Single-User Model

This is a **single-user/single-tenant** application. The database stores one connected Spotify account. The `users` table is simplified to a single "connected account" record. There is no user registration, multi-tenancy, or account switching.

## App Security

The web UI is protected by a simple password/PIN set during the first-run setup wizard. This prevents unauthorized access from other devices on the LAN.

- Password is hashed (bcrypt) and stored in the SQLite database
- API requests require a session token (cookie-based, HTTP-only)
- Session expires after a configurable idle timeout
- The password can be reset by deleting the config and re-running setup

## First-Run Setup Wizard

On first launch (no connected Spotify account), the app displays a setup wizard:

1. **Set password** — User creates a password/PIN to protect the UI
2. **Connect Spotify** — Initiates OAuth flow to link Spotify account
3. **Confirmation** — Shows connected account info, begins polling

After setup, subsequent visits go directly to the login screen (password entry), then the dashboard.

## Spotify API Details

### Endpoint

`GET https://api.spotify.com/v1/me/player/recently-played`

- Returns up to **50** most recent plays
- Supports cursor-based pagination (`after` / `before` as Unix timestamps in ms)
- Requires scope: `user-read-recently-played`

### Polling Strategy

- Poll every **5 minutes** (configurable via env var)
- Use the `after` cursor (stored as the most recent `played_at` timestamp) to only fetch new plays
- On first run, fetch the maximum window (50 items)
- If the API returns 0 new items, no-op and wait for next interval
- Handle rate limits (429) with exponential backoff

### Authentication

- OAuth 2.0 **Authorization Code** flow (server-side app with a secret)
- Scopes: `user-read-recently-played`
- Token refresh happens automatically before expiry (tokens last 1 hour; refresh when <5 min remaining)
- Refresh tokens are stored encrypted in the database

## Database Schema (SQLite)

### Core Entities

```
┌──────────┐       ┌──────────┐       ┌──────────┐
│  Artist  │◄──M2M─┤  Track   │──M2O──►│  Album   │
└──────────┘       └────┬─────┘       └──────────┘
                        │                    │
                        │                    │
                   ┌────▼─────┐              │
                   │   Play   │         M2M with
                   └────┬─────┘         Artist
                        │
                   ┌────▼─────┐
                   │ Account  │
                   └──────────┘
```

### Entity Definitions

#### `account` (single row — the connected Spotify account)
| Column           | Type      | Notes                                 |
| ---------------- | --------- | ------------------------------------- |
| id               | INTEGER   | Primary key (always 1)                |
| spotify_id       | TEXT      | Spotify user ID                       |
| display_name     | TEXT      | From Spotify profile                  |
| email            | TEXT      | From Spotify profile (nullable)       |
| access_token     | TEXT      | Encrypted, current OAuth access token |
| refresh_token    | TEXT      | Encrypted, OAuth refresh token        |
| token_expires_at | TEXT      | ISO 8601 timestamp                    |
| poll_cursor      | INTEGER   | `after` cursor for next poll (ms)     |
| created_at       | TEXT      | ISO 8601                              |
| updated_at       | TEXT      | ISO 8601                              |

#### `app_config` (app-level settings stored in DB)
| Column         | Type    | Notes                            |
| -------------- | ------- | -------------------------------- |
| id             | INTEGER | Primary key (always 1)           |
| password_hash  | TEXT    | Bcrypt hash of the UI password   |
| setup_complete | INTEGER | 0 or 1 — whether setup is done  |
| created_at     | TEXT    | ISO 8601                         |

#### `artists`
| Column     | Type    | Notes                      |
| ---------- | ------- | -------------------------- |
| id         | INTEGER | Primary key (autoincrement)|
| spotify_id | TEXT    | Spotify artist ID (unique) |
| name       | TEXT    | Artist name                |
| uri        | TEXT    | Spotify URI                |
| href       | TEXT    | API endpoint URL           |
| created_at | TEXT    | ISO 8601                   |
| updated_at | TEXT    | ISO 8601                   |

#### `albums`
| Column                 | Type    | Notes                            |
| ---------------------- | ------- | -------------------------------- |
| id                     | INTEGER | Primary key (autoincrement)      |
| spotify_id             | TEXT    | Spotify album ID (unique)        |
| name                   | TEXT    | Album name                       |
| album_type             | TEXT    | "album", "single", "compilation" |
| total_tracks           | INTEGER | Number of tracks in album        |
| release_date           | TEXT    | Release date (variable precision)|
| release_date_precision | TEXT    | "year", "month", or "day"        |
| uri                    | TEXT    | Spotify URI                      |
| href                   | TEXT    | API endpoint URL                 |
| image_url              | TEXT    | Largest available cover art URL  |
| created_at             | TEXT    | ISO 8601                         |
| updated_at             | TEXT    | ISO 8601                         |

#### `tracks`
| Column       | Type    | Notes                                            |
| ------------ | ------- | ------------------------------------------------ |
| id           | INTEGER | Primary key (autoincrement)                      |
| spotify_id   | TEXT    | Spotify track ID (unique)                        |
| name         | TEXT    | Track name                                       |
| album_id     | INTEGER | References `albums.id`                           |
| disc_number  | INTEGER | Disc number                                      |
| track_number | INTEGER | Position on disc                                 |
| duration_ms  | INTEGER | Track length in milliseconds                     |
| explicit     | INTEGER | 0 or 1                                           |
| isrc         | TEXT    | International Standard Recording Code (nullable) |
| uri          | TEXT    | Spotify URI                                      |
| href         | TEXT    | API endpoint URL                                 |
| preview_url  | TEXT    | 30s preview URL (nullable)                       |
| created_at   | TEXT    | ISO 8601                                         |
| updated_at   | TEXT    | ISO 8601                                         |

#### `plays` (the listening event)
| Column       | Type    | Notes                                              |
| ------------ | ------- | -------------------------------------------------- |
| id           | INTEGER | Primary key (autoincrement)                        |
| track_id     | INTEGER | References `tracks.id`                             |
| played_at    | TEXT    | ISO 8601 — when the track was played (from API)    |
| context_type | TEXT    | "album", "playlist", "artist", etc. (nullable)     |
| context_uri  | TEXT    | Spotify URI of the context (nullable)              |
| created_at   | TEXT    | ISO 8601                                           |

**Unique constraint:** `(track_id, played_at)` — prevents duplicate play records (single-user, so no user_id needed)

#### `track_artists` (M2M join)
| Column    | Type    | Notes                  |
| --------- | ------- | ---------------------- |
| track_id  | INTEGER | References `tracks.id` |
| artist_id | INTEGER | References `artists.id`|
| (PK)      |         | composite              |

#### `album_artists` (M2M join)
| Column    | Type    | Notes                   |
| --------- | ------- | ----------------------- |
| album_id  | INTEGER | References `albums.id`  |
| artist_id | INTEGER | References `artists.id` |
| (PK)      |         | composite               |

## Project Structure

```
spot-hist/
├── packages/
│   ├── api/
│   │   ├── src/
│   │   │   ├── index.ts              # Entry point — starts Fastify + poll worker
│   │   │   ├── config.ts             # Environment variable parsing + validation
│   │   │   ├── db/
│   │   │   │   ├── schema.ts         # Drizzle schema definitions
│   │   │   │   ├── migrate.ts        # Migration runner
│   │   │   │   └── index.ts          # Drizzle client instance
│   │   │   ├── auth/
│   │   │   │   ├── routes.ts         # /api/auth/* — OAuth + session routes
│   │   │   │   ├── spotify.ts        # OAuth helpers (token exchange, refresh)
│   │   │   │   ├── session.ts        # Session management (cookie-based)
│   │   │   │   └── encryption.ts     # Token encryption/decryption utils
│   │   │   ├── routes/
│   │   │   │   ├── setup.ts          # /api/setup/* — first-run wizard endpoints
│   │   │   │   ├── history.ts        # /api/history — play history endpoints
│   │   │   │   ├── stats.ts          # /api/stats — basic counts/stats
│   │   │   │   └── status.ts         # /api/status — system health, poll status
│   │   │   ├── poller/
│   │   │   │   ├── index.ts          # Poll loop manager
│   │   │   │   ├── fetch.ts          # Calls Spotify recently-played endpoint
│   │   │   │   └── persist.ts        # Upserts entities, creates play records
│   │   │   └── types/
│   │   │       └── spotify.ts        # TypeScript types for Spotify API responses
│   │   ├── drizzle/
│   │   │   └── migrations/           # Generated SQL migrations
│   │   ├── tsconfig.json
│   │   └── package.json
│   └── web/
│       ├── src/
│       │   ├── main.tsx              # React entry point
│       │   ├── App.tsx               # Router + layout
│       │   ├── pages/
│       │   │   ├── Setup.tsx         # First-run setup wizard
│       │   │   ├── Login.tsx         # Password entry
│       │   │   ├── Dashboard.tsx     # Main view — recent history + counts
│       │   │   └── Settings.tsx      # Connection status, disconnect option
│       │   ├── components/           # Reusable UI components
│       │   └── lib/
│       │       └── api.ts            # API client (fetch wrapper)
│       ├── index.html
│       ├── vite.config.ts
│       ├── tailwind.config.ts
│       ├── tsconfig.json
│       └── package.json
├── Dockerfile
├── .dockerignore
├── .env.example
├── pnpm-workspace.yaml
├── package.json                      # Root workspace config
├── tsconfig.base.json                # Shared TypeScript config
└── IDEA.md
```

## Configuration (Environment Variables)

| Variable                | Required | Default       | Description                          |
| ----------------------- | -------- | ------------- | ------------------------------------ |
| `SPOTIFY_CLIENT_ID`    | Yes      | —             | Spotify app client ID                |
| `SPOTIFY_CLIENT_SECRET`| Yes      | —             | Spotify app client secret            |
| `SPOTIFY_REDIRECT_URI` | Yes      | —             | OAuth callback URL                   |
| `ENCRYPTION_KEY`       | Yes      | —             | 32-byte key for token encryption     |
| `POLL_INTERVAL_MS`     | No       | `300000` (5m) | How often to poll                    |
| `PORT`                 | No       | `3000`        | Server port                          |
| `LOG_LEVEL`            | No       | `info`        | Pino log level                       |
| `CONFIG_DIR`           | No       | `/config`     | Directory for SQLite DB and data     |

## API Routes

### Public (no session required)

| Method | Path                | Description                               |
| ------ | ------------------- | ----------------------------------------- |
| GET    | `/api/setup/status` | Returns whether setup is complete         |
| POST   | `/api/setup/password` | Set initial password (first-run only)   |
| GET    | `/api/auth/login`   | Redirects to Spotify OAuth consent screen |
| GET    | `/api/auth/callback`| Handles OAuth callback, stores tokens     |
| POST   | `/api/auth/session` | Password login, returns session cookie    |

### Protected (session required)

| Method | Path                | Description                               |
| ------ | ------------------- | ----------------------------------------- |
| GET    | `/api/status`       | Health check, poll status, connection info |
| GET    | `/api/history`      | Paginated play history (recent first)     |
| GET    | `/api/stats`        | Basic counts (total plays, unique tracks, unique artists) |
| POST   | `/api/auth/logout`  | Destroy session                           |
| DELETE | `/api/auth/account` | Disconnect Spotify account (clear tokens) |

### Static Files

| Path  | Description                              |
| ----- | ---------------------------------------- |
| `/*`  | Serves built React SPA (index.html fallback for client-side routing) |

## Docker Setup (UNRAID-friendly)

### Dockerfile (multi-stage build)

```dockerfile
# Stage 1: Install dependencies and build
FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/api/package.json packages/api/
COPY packages/web/package.json packages/web/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter web build
RUN pnpm --filter api build
RUN pnpm deploy --filter api --prod /prod/api

# Stage 2: Production image
FROM node:20-alpine
RUN apk add --no-cache tini
WORKDIR /app
COPY --from=builder /prod/api .
COPY --from=builder /app/packages/web/dist ./public
ENV NODE_ENV=production
ENV CONFIG_DIR=/config
EXPOSE 3000
VOLUME ["/config"]
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
```

### Key Docker Patterns (Sonarr/Radarr-inspired)

- **Single exposed port** (`3000`) — all traffic (UI + API) on one port
- **Single volume** (`/config`) — contains SQLite database and any runtime data
- **`tini` as init** — proper signal handling and zombie process reaping
- **Non-root user** — run as UID/GID configurable via env (PUID/PGID) for UNRAID compatibility
- **Health check** — `HEALTHCHECK CMD wget -qO- http://localhost:3000/api/status || exit 1`
- **Alpine-based** — small image size

### UNRAID Template Variables

```xml
<Port>3000</Port>
<Volume>/config</Volume>
<Config Type="Variable" Name="SPOTIFY_CLIENT_ID" Target="SPOTIFY_CLIENT_ID" />
<Config Type="Variable" Name="SPOTIFY_CLIENT_SECRET" Target="SPOTIFY_CLIENT_SECRET" />
<Config Type="Variable" Name="SPOTIFY_REDIRECT_URI" Target="SPOTIFY_REDIRECT_URI" />
<Config Type="Variable" Name="ENCRYPTION_KEY" Target="ENCRYPTION_KEY" />
```

## Key Design Decisions

1. **Single-user/single-tenant** — No multi-user support. One connected Spotify account per instance. Simplifies the schema, auth, and UI.
2. **Monorepo, single-container** — `packages/api` and `packages/web` are separate during development but build into one container where Fastify serves the SPA as static files.
3. **SQLite** — Embedded database. No separate container or docker-compose needed. Single file in the `/config` volume. More than sufficient for single-user workload.
4. **Upsert-based persistence** — Tracks, albums, and artists are upserted by `spotify_id`. If metadata changes, we update it on the next encounter.
5. **Deduplication** — The unique constraint on `(track_id, played_at)` ensures idempotent polling. Re-fetching the same window is safe.
6. **No thresholds** — Unlike Last.fm (which requires 50% or 4 minutes), we store every single play event the API reports.
7. **Encrypted tokens** — Access and refresh tokens are AES-256-GCM encrypted at rest.
8. **Cursor-based polling** — We store the most recent `played_at` as a Unix timestamp cursor and use the `after` parameter to only fetch new plays.
9. **Password-protected UI** — Simple bcrypt-hashed password set during first-run, with cookie-based sessions.
10. **Env vars only for config** — No config file. All settings via environment variables, matching UNRAID's Docker template pattern.

## Future Considerations (Out of Scope for v1)

- Leaderboards (top tracks/artists/albums by time period)
- Visual charts (plays per day/week, listening time over time)
- Export to CSV/JSON
- Webhook notifications on new plays
- Historical import from Spotify's GDPR data export
- PUID/PGID support for file permission mapping
- UNRAID Community Applications template XML
