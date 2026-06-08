export type SetupStatus = {
  setupComplete: boolean;
  spotifyConnected: boolean;
  passwordSet: boolean;
};

export type AccountSummary = {
  displayName: string;
  email: string | null;
  spotifyId: string;
};

export type AppStatus = {
  poller: {
    state: "idle" | "running" | "degraded";
    lastPollAt: string | null;
    lastPollResult: string | null;
  };
  account: AccountSummary | null;
};

export type StatsSummary = {
  totalPlays: number;
  uniqueTracks: number;
  uniqueArtists: number;
  uniqueAlbums: number;
  latestPlayAt: string | null;
};

export type ArtistSummary = {
  id: string;
  name: string;
  imageUrl?: string | null;
};

export type AlbumSummary = {
  id: string;
  name: string;
  imageUrl: string | null;
};

export type TrackSummary = {
  id: string;
  name: string;
  durationMs: number;
  explicit: boolean;
};

export type HistoryItem = {
  id: string;
  playedAt: string;
  contextType: string | null;
  contextUri: string | null;
  track: TrackSummary;
  album: AlbumSummary;
  artists: ArtistSummary[];
};

export type HistoryPage = {
  items: HistoryItem[];
  nextCursor: string | null;
};

export type RankedEntity = {
  playCount: number;
  lastPlayedAt: string | null;
};

export type TopArtist = RankedEntity & {
  artist: ArtistSummary;
};

export type TopAlbum = RankedEntity & {
  album: AlbumSummary;
  artists: ArtistSummary[];
};

export type TopTrack = RankedEntity & {
  track: TrackSummary;
  album: AlbumSummary;
  artists: ArtistSummary[];
};

export type TopArtistsResponse = {
  items: TopArtist[];
};

export type TopAlbumsResponse = {
  items: TopAlbum[];
};

export type TopTracksResponse = {
  items: TopTrack[];
};

export type DetailStatus = "fresh" | "stale" | "missing";

export type SpotifyImage = {
  url: string;
  width: number | null;
  height: number | null;
};

export type DetailPageEnvelope = {
  detailStatus: DetailStatus;
  lastEnrichedAt: string | null;
};

export type ArtistDetailHeader = ArtistSummary & {
  uri: string;
  href: string;
};

export type AlbumDetailHeader = AlbumSummary & {
  uri: string;
  href: string;
  releaseDate: string;
  releaseDatePrecision: string;
  albumType: string;
  totalTracks: number;
  routeId?: string | null;
};

export type TrackDetailHeader = TrackSummary & {
  uri: string;
  href: string;
  previewUrl: string | null;
  isrc: string | null;
  routeId?: string | null;
};

export type ArtistSpotifyDetail = {
  url: string | null;
  popularity: number | null;
  followersTotal: number | null;
  genres: string[];
  images: SpotifyImage[];
};

export type AlbumSpotifyDetail = {
  url: string | null;
  label: string | null;
  popularity: number | null;
  genres: string[];
  images: SpotifyImage[];
  copyrights: Array<{
    text: string;
    type: string | null;
  }>;
};

export type TrackSpotifyDetail = {
  url: string | null;
  popularity: number | null;
  previewUrl: string | null;
  externalIds: Record<string, string>;
};

export type ArtistDetailStats = {
  totalPlays: number;
  rank: number | null;
  uniqueTracks: number;
  uniqueAlbums: number;
  firstPlayedAt: string | null;
  lastPlayedAt: string | null;
};

export type AlbumDetailStats = {
  totalPlays: number;
  rank: number | null;
  uniquePlayedTracks: number;
  firstPlayedAt: string | null;
  lastPlayedAt: string | null;
};

export type TrackDetailStats = {
  totalPlays: number;
  rank: number | null;
  firstPlayedAt: string | null;
  lastPlayedAt: string | null;
};

export type ArtistTopTrack = {
  track: TrackSummary & {
    routeId?: string | null;
  };
  album: AlbumSummary & {
    routeId?: string | null;
  };
  artists: ArtistSummary[];
  playCount: number;
  lastPlayedAt: string | null;
};

export type ArtistTopAlbum = {
  album: AlbumSummary & {
    routeId?: string | null;
  };
  albumType: string;
  artists: ArtistSummary[];
  playCount: number;
  lastPlayedAt: string | null;
};

export type CatalogAlbum = {
  id: string;
  name: string;
  imageUrl: string | null;
  releaseDate: string;
  releaseDatePrecision: string;
  albumType: string;
  totalTracks: number;
  spotifyUrl: string | null;
  artists: ArtistSummary[];
  routeId: string | null;
};

export type AlbumTracklistItem = {
  id: string;
  name: string;
  durationMs: number;
  explicit: boolean;
  discNumber: number;
  trackNumber: number;
  artists: ArtistSummary[];
  playCount: number;
  routeId: string | null;
};

export type ContextBreakdownItem = {
  contextType: string;
  playCount: number;
};

export type AlbumTracklistEntry = AlbumTracklistItem & {
  isCurrentTrack: boolean;
};

export type ArtistDetailPage = DetailPageEnvelope & {
  artist: ArtistDetailHeader;
  spotify: ArtistSpotifyDetail;
  stats: ArtistDetailStats;
  topTracks: ArtistTopTrack[];
  topAlbums: ArtistTopAlbum[];
  recentPlays: HistoryItem[];
  catalogAlbums: CatalogAlbum[];
};

export type AlbumDetailPage = DetailPageEnvelope & {
  album: AlbumDetailHeader;
  artists: ArtistSummary[];
  spotify: AlbumSpotifyDetail;
  stats: AlbumDetailStats;
  tracklist: AlbumTracklistItem[];
  recentPlays: HistoryItem[];
};

export type TrackDetailPage = DetailPageEnvelope & {
  track: TrackDetailHeader;
  album: AlbumDetailHeader & {
    routeId?: string | null;
  };
  artists: ArtistSummary[];
  spotify: TrackSpotifyDetail;
  stats: TrackDetailStats;
  contextBreakdown: ContextBreakdownItem[];
  recentPlays: HistoryItem[];
  albumTracklist: AlbumTracklistEntry[];
};

// Detail refresh failures are assumed to follow the existing `{ message }` error contract.
// Nullable detail fields keep frontend assumptions localized while backend work lands.
export type DetailRefreshError = {
  message: string;
};

export class ApiError<T = unknown> extends Error {
  status: number;
  data: T | null;

  constructor(status: number, message: string, data: T | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

type RequestInitWithJson = RequestInit & {
  json?: unknown;
};

async function request<T>(path: string, init?: RequestInitWithJson): Promise<T> {
  const headers = new Headers(init?.headers);
  let body = init?.body;

  if (init && "json" in init) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(init.json);
  }

  const response = await fetch(path, {
    ...init,
    headers,
    body,
    credentials: "include",
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") ?? "";
  const hasJson = contentType.includes("application/json");
  const payload = hasJson ? ((await response.json()) as T) : null;

  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "message" in payload &&
      typeof (payload as { message: unknown }).message === "string"
        ? ((payload as { message: string }).message ?? "Request failed")
        : `Request failed with status ${response.status}`;

    throw new ApiError(response.status, message, payload);
  }

  return payload as T;
}

export const api = {
  getSetupStatus() {
    return request<SetupStatus>("/api/setup/status");
  },
  createPassword(password: string) {
    return request<void>("/api/setup/password", {
      method: "POST",
      json: { password },
    });
  },
  createSession(password: string) {
    return request<void>("/api/auth/session", {
      method: "POST",
      json: { password },
    });
  },
  getStatus() {
    return request<AppStatus>("/api/status");
  },
  getStats() {
    return request<StatsSummary>("/api/stats");
  },
  getHistory(cursor?: string | null, limit = 25) {
    const search = new URLSearchParams();

    if (cursor) {
      search.set("cursor", cursor);
    }

    search.set("limit", String(limit));

    return request<HistoryPage>(`/api/history?${search.toString()}`);
  },
  getTopArtists(limit = 50) {
    const search = new URLSearchParams();
    search.set("limit", String(limit));

    return request<TopArtistsResponse>(`/api/top/artists?${search.toString()}`);
  },
  getTopAlbums(limit = 50) {
    const search = new URLSearchParams();
    search.set("limit", String(limit));

    return request<TopAlbumsResponse>(`/api/top/albums?${search.toString()}`);
  },
  getTopTracks(limit = 50) {
    const search = new URLSearchParams();
    search.set("limit", String(limit));

    return request<TopTracksResponse>(`/api/top/tracks?${search.toString()}`);
  },
  getArtistDetail(id: string) {
    return request<ArtistDetailPage>(`/api/artists/${id}`);
  },
  refreshArtistDetail(id: string) {
    return request<ArtistDetailPage>(`/api/artists/${id}/refresh`, {
      method: "POST",
    });
  },
  getAlbumDetail(id: string) {
    return request<AlbumDetailPage>(`/api/albums/${id}`);
  },
  refreshAlbumDetail(id: string) {
    return request<AlbumDetailPage>(`/api/albums/${id}/refresh`, {
      method: "POST",
    });
  },
  getTrackDetail(id: string) {
    return request<TrackDetailPage>(`/api/tracks/${id}`);
  },
  refreshTrackDetail(id: string) {
    return request<TrackDetailPage>(`/api/tracks/${id}/refresh`, {
      method: "POST",
    });
  },
  getArtistRecentPlays(id: string, cursor?: string | null, limit = 20) {
    const search = new URLSearchParams();

    if (cursor) {
      search.set("cursor", cursor);
    }

    search.set("limit", String(limit));

    return request<HistoryPage>(`/api/artists/${id}/recent-plays?${search.toString()}`);
  },
  getAlbumRecentPlays(id: string, cursor?: string | null, limit = 20) {
    const search = new URLSearchParams();

    if (cursor) {
      search.set("cursor", cursor);
    }

    search.set("limit", String(limit));

    return request<HistoryPage>(`/api/albums/${id}/recent-plays?${search.toString()}`);
  },
  getTrackRecentPlays(id: string, cursor?: string | null, limit = 20) {
    const search = new URLSearchParams();

    if (cursor) {
      search.set("cursor", cursor);
    }

    search.set("limit", String(limit));

    return request<HistoryPage>(`/api/tracks/${id}/recent-plays?${search.toString()}`);
  },
  logout() {
    return request<void>("/api/auth/logout", {
      method: "POST",
    });
  },
  disconnectAccount() {
    return request<void>("/api/auth/account", {
      method: "DELETE",
    });
  },
  startSpotifyLogin() {
    window.location.assign("/api/auth/login");
  },
};
