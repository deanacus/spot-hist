import type { ReactNode } from 'react';
import { EmptyState, InlineNotice } from './Ui';
import { AlbumArt, ArtistArtwork, InternalDetailLink } from './Media';
import type { TopAlbum, TopArtist, TopTrack } from '../lib/api';
import { routes } from '../lib/routes';

function formatPlayCount(playCount: number) {
  return playCount.toLocaleString();
}

function formatLastPlayed(lastPlayedAt: string | null) {
  if (!lastPlayedAt) return '—';
  return new Date(lastPlayedAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/* ─── Column Header Row ─── */

function ListHeader({ columns }: { columns: string[] }) {
  return (
    <div className="flex items-center gap-3 border-b border-(--border-subtle) px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-(--text-subdued)">
      <span className="w-8 text-center">#</span>
      {columns.map((col) => (
        <span key={col} className={col === 'Title' ? 'flex-1 min-w-0' : 'shrink-0 w-28 text-right'}>
          {col}
        </span>
      ))}
    </div>
  );
}

function TopListMetrics({ playCount, lastPlayedAt }: { playCount: number; lastPlayedAt: string | null }) {
  return (
    <>
      <span className="w-28 text-right text-sm tabular-nums text-(--text-secondary)">
        {formatPlayCount(playCount)}
      </span>
      <span className="w-28 text-right text-sm text-(--text-subdued)">{formatLastPlayed(lastPlayedAt)}</span>
    </>
  );
}

type TopListRowProps = {
  rank: number;
  artwork: ReactNode;
  primary: ReactNode;
  secondary?: ReactNode;
  playCount: number;
  lastPlayedAt: string | null;
};

function TopListRow({ rank, artwork, primary, secondary, playCount, lastPlayedAt }: TopListRowProps) {
  return (
    <div className="group flex items-center gap-3 rounded px-3 py-2.5 transition-colors hover:bg-(--bg-hover)">
      <span className="w-8 text-center text-sm tabular-nums text-(--text-subdued) group-hover:text-(--text-primary)">
        {rank}
      </span>
      {artwork}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-(--text-primary)">{primary}</p>
        {secondary ? <p className="truncate text-xs text-(--text-secondary)">{secondary}</p> : null}
      </div>
      <TopListMetrics playCount={playCount} lastPlayedAt={lastPlayedAt} />
    </div>
  );
}

function ArtistLinks({ artists }: { artists: Array<{ id: string; name: string }> }) {
  return artists.map((artist, index) => (
    <span key={artist.id}>
      {index > 0 ? ', ' : null}
      <InternalDetailLink to={routes.artist(artist.id)}>{artist.name}</InternalDetailLink>
    </span>
  ));
}

/* ─── TopListSection ─── */

type TopListSectionProps = {
  loading: boolean;
  error: string | null;
  emptyTitle: string;
  emptyBody: string;
  children: ReactNode;
  footer?: ReactNode;
};

function TopListSection({ loading, error, emptyTitle, emptyBody, children, footer }: TopListSectionProps) {
  if (loading) {
    return <p className="py-8 text-sm text-(--text-subdued) animate-pulse">Loading...</p>;
  }

  if (error) {
    return <InlineNotice tone="error">{error}</InlineNotice>;
  }

  if (!children) {
    return <EmptyState title={emptyTitle} body={emptyBody} />;
  }

  return (
    <div className="space-y-4">
      {children}
      {footer ? <div>{footer}</div> : null}
    </div>
  );
}

/* ─── Top Artists List ─── */
type TopArtistsListProps = {
  items: TopArtist[];
  loading: boolean;
  error: string | null;
  offset?: number;
  footer?: ReactNode;
};

export function TopArtistsList({ items, loading, error, offset = 0, footer }: TopArtistsListProps) {
  return (
    <TopListSection
      loading={loading}
      error={error}
      emptyTitle="No artists yet"
      emptyBody="Artists will appear here once the tracker has collected enough listening history."
      footer={footer}
    >
      {items.length > 0 ? (
        <div>
          <ListHeader columns={['Title', 'Scrobbles', 'Last scrobbled']} />
          {items.map((item, index) => (
            <TopListRow
              key={item.artist.id}
              rank={offset + index + 1}
              artwork={
                <ArtistArtwork
                  name={item.artist.name}
                  imageUrl={item.artist.imageUrl ?? null}
                  className="h-10 w-10"
                />
              }
              primary={
                <InternalDetailLink to={routes.artist(item.artist.id)}>
                  {item.artist.name}
                </InternalDetailLink>
              }
              playCount={item.playCount}
              lastPlayedAt={item.lastPlayedAt}
            />
          ))}
        </div>
      ) : null}
    </TopListSection>
  );
}

/* ─── Top Albums List ─── */

type TopAlbumsListProps = {
  items: TopAlbum[];
  loading: boolean;
  error: string | null;
  offset?: number;
  footer?: ReactNode;
};

export function TopAlbumsList({ items, loading, error, offset = 0, footer }: TopAlbumsListProps) {
  return (
    <TopListSection
      loading={loading}
      error={error}
      emptyTitle="No albums yet"
      emptyBody="Albums will appear here once the tracker has collected enough listening history."
      footer={footer}
    >
      {items.length > 0 ? (
        <div>
          <ListHeader columns={['Title', 'Scrobbles', 'Last scrobbled']} />
          {items.map((item, index) => (
            <TopListRow
              key={item.album.id}
              rank={offset + index + 1}
              artwork={
                <AlbumArt
                  imageUrl={item.album.imageUrl}
                  alt={`${item.album.name} album art`}
                  fallbackLabel="LP"
                />
              }
              primary={
                <InternalDetailLink to={routes.album(item.album.id)}>
                  {item.album.name}
                </InternalDetailLink>
              }
              secondary={<ArtistLinks artists={item.artists} />}
              playCount={item.playCount}
              lastPlayedAt={item.lastPlayedAt}
            />
          ))}
        </div>
      ) : null}
    </TopListSection>
  );
}

/* ─── Top Tracks List ─── */

type TopTracksListProps = {
  items: TopTrack[];
  loading: boolean;
  error: string | null;
  offset?: number;
  footer?: ReactNode;
};

export function TopTracksList({ items, loading, error, offset = 0, footer }: TopTracksListProps) {
  return (
    <TopListSection
      loading={loading}
      error={error}
      emptyTitle="No tracks yet"
      emptyBody="Tracks will appear here once the tracker has collected enough listening history to rank them."
      footer={footer}
    >
      {items.length > 0 ? (
        <div>
          <ListHeader columns={['Title', 'Scrobbles', 'Last scrobbled']} />
          {items.map((item, index) => (
            <TopListRow
              key={item.track.id}
              rank={offset + index + 1}
              artwork={
                <AlbumArt
                  imageUrl={item.album.imageUrl}
                  alt={`${item.album.name} album art`}
                  fallbackLabel="♪"
                />
              }
              primary={
                <InternalDetailLink to={routes.track(item.track.id)}>
                  {item.track.name}
                </InternalDetailLink>
              }
              secondary={
                <>
                  <ArtistLinks artists={item.artists} /> •{' '}
                  <InternalDetailLink to={routes.album(item.album.id)}>
                    {item.album.name}
                  </InternalDetailLink>
                </>
              }
              playCount={item.playCount}
              lastPlayedAt={item.lastPlayedAt}
            />
          ))}
        </div>
      ) : null}
    </TopListSection>
  );
}
