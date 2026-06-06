# Spotify History Tracker

Self-hosted Spotify listening history tracker with a Fastify API backend, React frontend, and SQLite storage. Track your listening habits, view detailed statistics, and explore your music history over time.

## Features

- 🎵 **Automated History Tracking** - Polls Spotify API every 5 minutes to capture your listening history
- 📊 **Detailed Statistics** - View play counts, listening trends, and historical data
- 🎨 **Artist, Album & Track Details** - Enriched metadata from Spotify including images, genres, and popularity
- 🔐 **Self-Hosted & Private** - Your data stays on your server, encrypted at rest
- 🐳 **Docker Ready** - Single-container deployment with persistent storage
- 📱 **Responsive UI** - Clean, modern interface built with React and Tailwind CSS

## Tech Stack

### Backend (`packages/api`)
- **Runtime:** Node.js with TypeScript
- **Framework:** Fastify
- **Database:** SQLite with Drizzle ORM
- **Authentication:** Session-based with bcrypt password hashing
- **API Integration:** Spotify Web API

### Frontend (`packages/web`)
- **Framework:** React 19
- **Routing:** React Router v7
- **State Management:** TanStack Query (React Query)
- **Styling:** Tailwind CSS v4
- **Build Tool:** Vite

## Prerequisites

- Node.js 18+ and pnpm 9+
- Spotify Developer Account ([Create one here](https://developer.spotify.com/dashboard))
- Spotify Client ID and Secret

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/spot-hist.git
cd spot-hist
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Configure environment variables

Copy the example environment file and fill in your Spotify credentials:

```bash
cp .env.example .env
```

Edit `.env` and set:

- `SPOTIFY_CLIENT_ID` - From your [Spotify Dashboard](https://developer.spotify.com/dashboard)
- `SPOTIFY_CLIENT_SECRET` - From your Spotify Dashboard
- `SPOTIFY_REDIRECT_URI` - Should match `http://127.0.0.1:3000/api/auth/callback` in development
- `ENCRYPTION_KEY` - Generate with `openssl rand -hex 32`

**Required Spotify OAuth Scopes:**
- `user-read-recently-played`
- `user-read-email`

### 4. Run in development mode

```bash
pnpm dev
```

- API runs on `http://localhost:3000`
- Web UI runs on `http://localhost:5173`

### 5. Initial setup

1. Navigate to `http://localhost:5173`
2. Create an admin password
3. Connect your Spotify account
4. Wait for the first poll cycle to collect data (runs every 5 minutes)

## Available Scripts

### Root workspace
- `pnpm dev` - Run both API and web in parallel
- `pnpm build` - Build both packages
- `pnpm lint` - Type-check all packages
- `pnpm test` - Run tests across all packages
- `pnpm typecheck` - Type-check without emitting files

### API package (`packages/api`)
- `pnpm dev` - Run API in watch mode
- `pnpm build` - Build TypeScript to `dist/`
- `pnpm start` - Run production build
- `pnpm test` - Run Vitest tests
- `pnpm db:generate` - Generate Drizzle migrations
- `pnpm db:migrate` - Run database migrations

### Web package (`packages/web`)
- `pnpm dev` - Run Vite dev server
- `pnpm build` - Build production bundle
- `pnpm test` - Run Vitest tests

## Docker Deployment

### Build the image

```bash
docker build -t spot-hist .
```

### Run with Docker

```bash
docker run -d \
  --name spot-hist \
  -p 3000:3000 \
  -v "$(pwd)/.data:/config" \
  --env-file .env \
  spot-hist
```

### Run with Docker Compose

```yaml
version: '3.8'
services:
  spot-hist:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./.data:/config
    env_file:
      - .env
    restart: unless-stopped
```

Then run:

```bash
docker-compose up -d
```

## API Endpoints

### Authentication
- `GET /api/auth/login` - Initiate Spotify OAuth flow
- `GET /api/auth/callback` - OAuth callback handler
- `POST /api/auth/session` - Create session with password
- `POST /api/auth/logout` - Destroy session
- `DELETE /api/auth/account` - Disconnect Spotify account

### Setup
- `GET /api/setup/status` - Check setup completion status
- `POST /api/setup/password` - Set initial admin password

### Data
- `GET /api/status` - Application status and account info
- `GET /api/stats` - Overall listening statistics
- `GET /api/history` - Paginated listening history
- `GET /api/top/artists` - Top artists by play count
- `GET /api/top/albums` - Top albums by play count
- `GET /api/top/tracks` - Top tracks by play count

### Details
- `GET /api/artists/:id` - Artist detail page
- `GET /api/artists/:id/recent-plays` - Paginated recent plays for artist
- `POST /api/artists/:id/refresh` - Refresh artist metadata from Spotify
- `GET /api/albums/:id` - Album detail page
- `GET /api/albums/:id/recent-plays` - Paginated recent plays for album
- `POST /api/albums/:id/refresh` - Refresh album metadata from Spotify
- `GET /api/tracks/:id` - Track detail page
- `GET /api/tracks/:id/recent-plays` - Paginated recent plays for track
- `POST /api/tracks/:id/refresh` - Refresh track metadata from Spotify

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SPOTIFY_CLIENT_ID` | Yes | - | Spotify application client ID |
| `SPOTIFY_CLIENT_SECRET` | Yes | - | Spotify application client secret |
| `SPOTIFY_REDIRECT_URI` | Yes | - | OAuth callback URL |
| `ENCRYPTION_KEY` | Yes | - | 64-character hex key for encrypting tokens |
| `PORT` | No | `3000` | Server port |
| `CONFIG_DIR` | No | `/config` | Directory for database and config files |
| `POLL_INTERVAL_MS` | No | `300000` | Polling interval in milliseconds (5 min) |
| `SESSION_IDLE_TIMEOUT_MS` | No | `1800000` | Session timeout in milliseconds (30 min) |
| `LOG_LEVEL` | No | `info` | Log level: trace, debug, info, warn, error, fatal |

## Data Storage

All data is stored in the `CONFIG_DIR` directory (default: `/config`):

- `spot-hist.db` - SQLite database containing listening history and metadata
- `config.json` - Application configuration (OAuth state, cursor position)

## Architecture

### Monorepo Structure

```
spot-hist/
├── packages/
│   ├── api/          # Fastify backend
│   │   ├── src/
│   │   │   ├── auth/       # Spotify OAuth & session management
│   │   │   ├── db/         # Database schema & migrations
│   │   │   ├── routes/     # API route handlers
│   │   │   ├── services/   # Business logic & data access
│   │   │   └── index.ts    # Server entry point
│   │   └── package.json
│   └── web/          # React frontend
│       ├── src/
│       │   ├── components/ # Reusable UI components
│       │   ├── pages/      # Route pages
│       │   ├── lib/        # API client, queries, utilities
│       │   └── main.tsx    # App entry point
│       └── package.json
├── .env.example
├── Dockerfile
├── docker-compose.yml
└── package.json
```

### Data Flow

1. **Polling Service** - Backend polls Spotify API every 5 minutes
2. **Data Storage** - New plays are stored in SQLite with Drizzle ORM
3. **Enrichment** - Artist/album/track metadata is fetched and cached on-demand
4. **API Layer** - Fastify serves data through REST endpoints
5. **Frontend** - React app queries API using TanStack Query with cursor-based pagination

## Development Tips

### Database Migrations

After modifying the schema in `packages/api/src/db/schema.ts`:

```bash
cd packages/api
pnpm db:generate  # Generate migration files
pnpm db:migrate   # Apply migrations
```

### Testing

Run tests for all packages:

```bash
pnpm test
```

Or run tests for a specific package:

```bash
pnpm --filter @spot-hist/api test
pnpm --filter @spot-hist/web test
```

### Type Checking

```bash
pnpm typecheck
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Acknowledgments

- Built with [Fastify](https://fastify.dev/), [React](https://react.dev/), and [Spotify Web API](https://developer.spotify.com/documentation/web-api)
- UI inspired by Spotify's design language
