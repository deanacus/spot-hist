export interface SpotifyImage {
  url: string;
  height: number | null;
  width: number | null;
}

export interface SpotifyExternalUrls {
  spotify: string;
}

export interface SpotifyArtist {
  id: string;
  name: string;
  uri: string;
  href: string;
  external_urls?: SpotifyExternalUrls;
}

export interface SpotifyAlbum {
  id: string;
  name: string;
  album_type: string;
  album_group?: string;
  total_tracks: number;
  release_date: string;
  release_date_precision: string;
  uri: string;
  href: string;
  images: SpotifyImage[];
  artists: SpotifyArtist[];
  external_urls?: SpotifyExternalUrls;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  album: SpotifyAlbum;
  artists: SpotifyArtist[];
  disc_number: number;
  track_number: number;
  duration_ms: number;
  explicit: boolean;
  external_ids?: {
    isrc?: string;
  };
  uri: string;
  href: string;
  preview_url: string | null;
  external_urls?: SpotifyExternalUrls;
}

export interface SpotifyPlayContext {
  type: string;
  uri: string;
}

export interface SpotifyRecentlyPlayedItem {
  track: SpotifyTrack;
  played_at: string;
  context: SpotifyPlayContext | null;
}

export interface SpotifyRecentlyPlayedResponse {
  items: SpotifyRecentlyPlayedItem[];
  next: string | null;
  cursors?: {
    after?: string;
    before?: string;
  };
}

export interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

export interface SpotifyUserProfile {
  id: string;
  display_name: string | null;
  email?: string;
}

export interface SpotifyArtistDetail extends SpotifyArtist {
  followers: {
    total: number;
  };
  genres: string[];
  images: SpotifyImage[];
  popularity: number;
}

export interface SpotifyArtistAlbumsResponse {
  items: SpotifyAlbum[];
  next: string | null;
}

export interface SpotifyAlbumTrack {
  id: string;
  name: string;
  uri: string;
  href: string;
  duration_ms: number;
  explicit: boolean;
  track_number: number;
  disc_number: number;
  preview_url: string | null;
  artists: SpotifyArtist[];
}

export interface SpotifyAlbumDetail extends SpotifyAlbum {
  external_urls: SpotifyExternalUrls;
  genres: string[];
  label: string;
  popularity: number;
  copyrights: Array<{
    text: string;
    type: string;
  }>;
  tracks: {
    items: SpotifyAlbumTrack[];
    next?: string | null;
  };
}

export interface SpotifyTrackDetail extends SpotifyTrack {
  external_urls: SpotifyExternalUrls;
  popularity: number;
  external_ids?: {
    isrc?: string;
    ean?: string;
    upc?: string;
  };
}
