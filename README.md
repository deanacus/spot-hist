# Spotify History Tracker

Self-hosted Spotify listening history tracker with a Fastify API, React SPA, and SQLite storage.

## Development

Install dependencies and run both apps:

```bash
pnpm install
pnpm dev
```

The API runs on `http://localhost:3000` and the Vite app on `http://localhost:5173`.

## Required environment

- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `SPOTIFY_REDIRECT_URI`
- `ENCRYPTION_KEY`

See `.env.example` for the full set of variables.

## Docker

Build and run the single-container deployment with a persistent `/config` volume:

```bash
docker build -t spot-hist .
docker run --rm -p 3000:3000 -v "$(pwd)/.data:/config" --env-file .env spot-hist
```
