import { useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, Navigate, useParams } from "react-router-dom";
import { formatPlayCount } from "../components/DetailUi";
import { Pagination } from "../components/Pagination";
import { ScrobbleList } from "../components/ScrobbleList";
import { EmptyState, InlineNotice, Shell } from "../components/Ui";
import { getErrorMessage } from "../lib/errors";
import {
  getPageOffset,
  isUnauthorizedError,
  queryKeys,
  useAlbumDetailQuery,
  useArtistDetailQuery,
  useBootstrapQuery,
  useScopedHistoryPageQuery,
  useTrackDetailQuery,
} from "../lib/queries";
import { parsePageParam, routes } from "../lib/routes";

const PAGE_SIZE = 50;

type ScopedScrobblesLayoutProps = {
  id: string | undefined;
  page: number;
  title: string;
  subtitle: string;
  backTo: string;
  backLabel: string;
  emptyTitle: string;
  emptyBody: string;
  getPageHref: (page: number) => string;
  scope: { kind: "artist" | "album" | "track"; id: string };
  detailPending: boolean;
  detailError: unknown;
  detailErrorFallback: string;
};

function ScopedScrobblesLayout({
  id,
  page,
  title,
  subtitle,
  backTo,
  backLabel,
  emptyTitle,
  emptyBody,
  getPageHref,
  scope,
  detailPending,
  detailError,
  detailErrorFallback,
}: ScopedScrobblesLayoutProps) {
  const queryClient = useQueryClient();
  const bootstrapQuery = useBootstrapQuery();
  const status = bootstrapQuery.data?.appStatus ?? null;
  const account = status?.account ?? null;
  const offset = getPageOffset(page, PAGE_SIZE);
  const scrobblesQuery = useScopedHistoryPageQuery(
    Boolean(status) && Boolean(id),
    scope,
    offset,
    PAGE_SIZE,
  );

  useEffect(() => {
    if (isUnauthorizedError(detailError) || isUnauthorizedError(scrobblesQuery.error)) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap });
    }
  }, [detailError, queryClient, scrobblesQuery.error]);

  const detailMessage =
    detailError && !isUnauthorizedError(detailError)
      ? getErrorMessage(detailError, detailErrorFallback)
      : null;
  const scrobbleMessage =
    scrobblesQuery.error && !isUnauthorizedError(scrobblesQuery.error)
      ? getErrorMessage(scrobblesQuery.error, "Unable to load scoped scrobbles.")
      : null;
  const errorMessage = detailMessage ?? scrobbleMessage;

  if (scrobblesQuery.data) {
    const totalPages = Math.max(1, Math.ceil(scrobblesQuery.data.total / PAGE_SIZE));
    if (page > totalPages) {
      return <Navigate replace to={getPageHref(totalPages)} />;
    }
  }

  return (
    <Shell title={title} subtitle={subtitle}>
      {!account ? (
        <EmptyState
          title="Spotify is disconnected"
          body="Reconnect in settings before viewing scoped scrobbles."
        />
      ) : !id ? (
        <InlineNotice tone="error">The route is missing its scoped item id.</InlineNotice>
      ) : detailPending ? (
        <p className="py-8 text-sm text-(--text-subdued) animate-pulse">Loading scrobble context...</p>
      ) : detailMessage ? (
        <InlineNotice tone="error">{detailMessage}</InlineNotice>
      ) : (
        <div className="space-y-6">
          <Link
            to={backTo}
            className="inline-flex items-center gap-1.5 text-sm text-(--text-secondary) transition hover:text-(--text-primary)"
          >
            <span aria-hidden="true">←</span>
            {backLabel}
          </Link>

          <ScrobbleList
            items={scrobblesQuery.data?.items ?? []}
            loading={scrobblesQuery.isPending}
            error={errorMessage}
            emptyTitle={emptyTitle}
            emptyBody={emptyBody}
            footer={
              scrobblesQuery.data ? (
                <Pagination
                  currentPage={page}
                  total={scrobblesQuery.data.total}
                  pageSize={PAGE_SIZE}
                  getHref={getPageHref}
                />
              ) : null
            }
          />
        </div>
      )}
    </Shell>
  );
}

export function ArtistScrobblesPage() {
  const { id, page: pageParam } = useParams();
  const page = parsePageParam(pageParam);
  const currentPage = page ?? 1;

  const bootstrapQuery = useBootstrapQuery();
  const status = bootstrapQuery.data?.appStatus ?? null;
  const detailQuery = useArtistDetailQuery(id, Boolean(status));
  const title = detailQuery.data ? `${detailQuery.data.artist.name} scrobbles` : "Artist scrobbles";
  const subtitle = useMemo(() => {
    if (!detailQuery.data) {
      return "Recent listening history for this artist.";
    }

    return formatPlayCount(detailQuery.data.stats.totalPlays);
  }, [detailQuery.data]);

  if (page === null) {
    return <Navigate replace to={id ? routes.artistScrobbles(id) : routes.artists} />;
  }

  if (pageParam !== undefined && currentPage === 1) {
    return <Navigate replace to={id ? routes.artistScrobbles(id) : routes.artists} />;
  }

  return (
    <ScopedScrobblesLayout
      id={id}
      page={currentPage}
      title={title}
      subtitle={subtitle}
      backTo={id ? routes.artist(id) : routes.artists}
      backLabel="Back to artist"
      emptyTitle="No artist scrobbles yet"
      emptyBody="Scrobbles for this artist will appear here once the tracker collects them."
      getPageHref={(nextPage) => (id ? routes.artistScrobblesPage(id, nextPage) : routes.artists)}
      scope={id ? { kind: "artist", id } : { kind: "artist", id: "" }}
      detailPending={detailQuery.isPending && !detailQuery.data}
      detailError={detailQuery.error}
      detailErrorFallback="Unable to load artist detail."
    />
  );
}

export function AlbumScrobblesPage() {
  const { id, page: pageParam } = useParams();
  const page = parsePageParam(pageParam);
  const currentPage = page ?? 1;

  const bootstrapQuery = useBootstrapQuery();
  const status = bootstrapQuery.data?.appStatus ?? null;
  const detailQuery = useAlbumDetailQuery(id, Boolean(status));
  const title = detailQuery.data ? `${detailQuery.data.album.name} scrobbles` : "Album scrobbles";
  const subtitle = useMemo(() => {
    if (!detailQuery.data) {
      return "Recent listening history for this album.";
    }

    return formatPlayCount(detailQuery.data.stats.totalPlays);
  }, [detailQuery.data]);

  if (page === null) {
    return <Navigate replace to={id ? routes.albumScrobbles(id) : routes.albums} />;
  }

  if (pageParam !== undefined && currentPage === 1) {
    return <Navigate replace to={id ? routes.albumScrobbles(id) : routes.albums} />;
  }

  return (
    <ScopedScrobblesLayout
      id={id}
      page={currentPage}
      title={title}
      subtitle={subtitle}
      backTo={id ? routes.album(id) : routes.albums}
      backLabel="Back to album"
      emptyTitle="No album scrobbles yet"
      emptyBody="Scrobbles for this album will appear here once the tracker collects them."
      getPageHref={(nextPage) => (id ? routes.albumScrobblesPage(id, nextPage) : routes.albums)}
      scope={id ? { kind: "album", id } : { kind: "album", id: "" }}
      detailPending={detailQuery.isPending && !detailQuery.data}
      detailError={detailQuery.error}
      detailErrorFallback="Unable to load album detail."
    />
  );
}

export function TrackScrobblesPage() {
  const { id, page: pageParam } = useParams();
  const page = parsePageParam(pageParam);
  const currentPage = page ?? 1;

  const bootstrapQuery = useBootstrapQuery();
  const status = bootstrapQuery.data?.appStatus ?? null;
  const detailQuery = useTrackDetailQuery(id, Boolean(status));
  const title = detailQuery.data ? `${detailQuery.data.track.name} scrobbles` : "Track scrobbles";
  const subtitle = useMemo(() => {
    if (!detailQuery.data) {
      return "Recent listening history for this track.";
    }

    return formatPlayCount(detailQuery.data.stats.totalPlays);
  }, [detailQuery.data]);

  if (page === null) {
    return <Navigate replace to={id ? routes.trackScrobbles(id) : routes.tracks} />;
  }

  if (pageParam !== undefined && currentPage === 1) {
    return <Navigate replace to={id ? routes.trackScrobbles(id) : routes.tracks} />;
  }

  return (
    <ScopedScrobblesLayout
      id={id}
      page={currentPage}
      title={title}
      subtitle={subtitle}
      backTo={id ? routes.track(id) : routes.tracks}
      backLabel="Back to track"
      emptyTitle="No track scrobbles yet"
      emptyBody="Scrobbles for this track will appear here once the tracker collects them."
      getPageHref={(nextPage) => (id ? routes.trackScrobblesPage(id, nextPage) : routes.tracks)}
      scope={id ? { kind: "track", id } : { kind: "track", id: "" }}
      detailPending={detailQuery.isPending && !detailQuery.data}
      detailError={detailQuery.error}
      detailErrorFallback="Unable to load track detail."
    />
  );
}
