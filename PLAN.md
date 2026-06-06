# Detail Pages for Artists, Albums, and Tracks

## Summary

Add protected detail pages at `/artists/:id`, `/albums/:id`, and `/tracks/:id`, where `:id` is the Spotify ID already stored in the local DB. Each page should render immediately from local data, then automatically enrich itself on first visit or when cached Spotify detail is older than 30 days. The enrichment layer should use Spotify catalog endpoints, persist the fetched detail locally, and keep the page DTOs stable so the frontend derives all page state from TanStack Query. The pages should mix rich Spotify metadata with local listening analytics, and any Spotify artwork/images shown on the page should include clear link-back attribution to Spotify. Artist “top tracks” should come from local listening data, not Spotify.

## Key Changes

### 1. Add a detail-enrichment cache layer in the API

- Keep `artists`, `albums`, and `tracks` as the canonical polled entities.
- Add three new cache tables keyed by local entity FK:
  - `artist_details`
  - `album_details`
  - `track_details`
- Each detail table should include:
  - the owning FK (`artist_id`, `album_id`, `track_id`) with a unique constraint
  - `fetched_at`
  - `refresh_after`
  - entity-specific cached fields needed by the UI
  - JSON text columns for list-shaped Spotify metadata rather than over-normalizing catalog-only data
- Store only the simplified shape the UI needs, not raw full Spotify payloads.

Chosen cache payloads:

- `artist_details`
  - `spotify_url`
  - `popularity`
  - `followers_total`
  - `genres_json`
  - `images_json`
  - `catalog_albums_json`
- `album_details`
  - `spotify_url`
  - `label`
  - `popularity`
  - `genres_json`
  - `images_json`
  - `copyrights_json`
  - `tracklist_json`
- `track_details`
  - `spotify_url`
  - `popularity`
  - `preview_url`
  - `external_ids_json`

### 2. Expand the Spotify client and enrichment services

- Add Spotify client methods for:
  - `GET /artists/{id}`
  - `GET /artists/{id}/albums`
  - `GET /albums/{id}`
  - `GET /tracks/{id}`
- Use the existing account access token flow; do not add new OAuth scopes for this feature.
- Implement one enrichment service per entity:
  - load base entity from local DB by `spotify_id`
  - read detail cache row
  - decide `fresh | stale | missing`
  - on refresh, fetch Spotify detail, map to cached columns, upsert cache row, and return updated page DTO
- Refresh policy:
  - first visit with no detail row: fetch and cache
  - stale row older than 30 days: refresh in background on page visit
  - fresh row: do not call Spotify
- Add simple in-process refresh deduplication keyed by entity type + Spotify ID so concurrent visits do not trigger duplicate Spotify fetches.

### 3. Add protected detail APIs with stable page DTOs

- Add protected endpoints:
  - `GET /api/artists/:id`
  - `POST /api/artists/:id/refresh`
  - `GET /api/albums/:id`
  - `POST /api/albums/:id/refresh`
  - `GET /api/tracks/:id`
  - `POST /api/tracks/:id/refresh`
- `GET` endpoints must be read-only and return the current local+cached page DTO plus:
  - `detailStatus: "fresh" | "stale" | "missing"`
  - `lastEnrichedAt: string | null`
- `POST /refresh` endpoints must be idempotent and return the same DTO shape as `GET`, but with fresh cache data after the upsert.
- `404` if the Spotify ID is not present in the local base table.
- `401` if no session.
- `429` and upstream fetch failures should not blank the page:
  - keep serving the local DTO
  - return a refresh error payload from the mutation path
  - let the frontend show a non-blocking notice

Chosen DTO sections:

- `ArtistDetailPage`
  - `artist`: id, name, uri, href
  - `spotify`: url, popularity, followersTotal, genres, images
  - `stats`: totalPlays, rank, uniqueTracks, uniqueAlbums, firstPlayedAt, lastPlayedAt
  - `topTracks`: local top tracks with play counts
  - `topAlbums`: local top albums with play counts
  - `recentPlays`: recent play list
  - `catalogAlbums`: simplified cached artist release list from Spotify

- `AlbumDetailPage`
  - `album`: id, name, imageUrl, uri, href, releaseDate, releaseDatePrecision, albumType, totalTracks
  - `artists`
  - `spotify`: url, label, popularity, genres, images, copyrights
  - `stats`: totalPlays, rank, uniquePlayedTracks, firstPlayedAt, lastPlayedAt
  - `tracklist`: full album tracklist with local play counts per track
  - `recentPlays`: recent plays from this album

- `TrackDetailPage`
  - `track`: id, name, durationMs, explicit, uri, href, previewUrl, isrc
  - `album`
  - `artists`
  - `spotify`: url, popularity, previewUrl, externalIds
  - `stats`: totalPlays, rank, firstPlayedAt, lastPlayedAt
  - `contextBreakdown`: local play counts by context type
  - `recentPlays`: recent plays of this track
  - `albumTracklist`: album tracks with current track highlighted and local play counts where available

### 4. Add repository queries for local analytics

- Add local aggregate queries for:
  - artist rank, play count, unique tracks/albums, first/last played
  - album rank, play count, unique played tracks, first/last played
  - track rank, play count, first/last played
  - local top tracks for an artist
  - local top albums for an artist
  - recent plays filtered by artist/album/track
  - album track play counts
  - track context breakdown
- Rankings should remain all-time and deterministic:
  - primary sort: `playCount DESC`
  - tie-breakers: entity name ascending, then Spotify ID ascending
- Route lookup should use `spotify_id`, not names, end to end.

### 5. Add frontend routes, queries, and page flows

- Add protected routes:
  - `/artists/:id`
  - `/albums/:id`
  - `/tracks/:id`
- Add API client types and TanStack Query hooks for the three `GET` detail endpoints and three refresh mutations.
- Page behavior:
  - load `GET` detail query immediately
  - render local sections right away
  - if `detailStatus` is `missing` or `stale`, trigger the refresh mutation on mount
  - on refresh success, invalidate the detail query and re-render enriched sections
  - on refresh failure, keep rendered local content and show a dismissible inline warning
- Link into the new detail pages from:
  - top artists / albums / tracks list items
  - dashboard recent-play rows
  - artist/album/track cross-links inside detail pages
- Keep routing/query protection consistent with the existing bootstrap/session model.

### 6. Detail page UI composition

- Reuse the current shell and visual language; do not redesign the app frame.
- Artist page:
  - hero with artist image or fallback mark, genres, followers, popularity, Open in Spotify
  - local stats cards
  - local top tracks section
  - local top albums section
  - recent plays section
  - Spotify catalog releases section
- Album page:
  - hero with large cover art, artists, release metadata, label, popularity, Open in Spotify
  - local stats cards
  - full tracklist section with play counts and links to track pages
  - recent plays section
  - copyright / genres metadata panel
- Track page:
  - hero with cover art, artists, album link, duration, explicit badge, preview / Open in Spotify
  - local stats cards
  - recent plays timeline
  - context breakdown panel
  - album tracklist section with current track highlighted
- Any Spotify-sourced visual/media content shown in the UI must include Spotify link-back attribution.

## Public APIs, Types, and Interfaces

- New backend endpoints:
  - `GET /api/artists/:id`
  - `POST /api/artists/:id/refresh`
  - `GET /api/albums/:id`
  - `POST /api/albums/:id/refresh`
  - `GET /api/tracks/:id`
  - `POST /api/tracks/:id/refresh`
- New frontend DTOs:
  - `ArtistDetailPage`
  - `AlbumDetailPage`
  - `TrackDetailPage`
- New query keys:
  - `["artist-detail", id]`
  - `["album-detail", id]`
  - `["track-detail", id]`
- New mutations:
  - `useRefreshArtistDetailMutation(id)`
  - `useRefreshAlbumDetailMutation(id)`
  - `useRefreshTrackDetailMutation(id)`

## Test Plan

- Backend integration tests:
  - `GET` detail returns local-only DTO with `detailStatus: "missing"` before enrichment
  - first `POST /refresh` fetches Spotify data and persists the detail row
  - subsequent `GET` returns cached enriched data without another Spotify fetch
  - stale detail older than 30 days refreshes correctly
  - unknown ID returns `404`
  - unauthenticated access returns `401`
  - duplicate refresh requests do not trigger duplicate upstream fetches
- Backend repository tests:
  - rank and aggregate calculations for artist/album/track stats
  - local top tracks/albums and recent plays ordering
  - album track play count joins
  - context breakdown aggregation
- Frontend tests:
  - protected routing for `/artists/:id`, `/albums/:id`, `/tracks/:id`
  - top-list and dashboard links navigate to the correct detail routes
  - page renders local content immediately when `detailStatus` is `missing`
  - refresh mutation runs automatically for `missing` and `stale`
  - enriched sections appear after refresh success
  - refresh failure leaves local content intact and shows a warning
  - artist fallback image rendering when no cached artist image exists
  - album/track pages render Spotify images when present

## Assumptions and Defaults

- Route IDs are Spotify IDs, not local numeric IDs and not names.
- Detail enrichment is cached for 30 days, then refreshed on next visit.
- First-load UX is “render then enrich”; the page never blocks entirely on Spotify.
- No prefetching before navigation; enrichment is triggered only when the detail route is visited.
- No new OAuth scopes are added for this feature.
- Artist top tracks come from local listening history, not Spotify.
- “Comprehensive” means combining rich Spotify metadata with local play analytics, related local entities, and recent listening history on the same page.
