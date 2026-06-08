import { useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { formatPlayCount } from "../components/DetailUi";
import { ScrobbleList } from "../components/ScrobbleList";
import { Button, EmptyState, InlineNotice, Shell } from "../components/Ui";
import { getErrorMessage } from "../lib/errors";
import {
  isUnauthorizedError,
  queryKeys,
  useAlbumDetailQuery,
  useArtistDetailQuery,
  useBootstrapQuery,
  useCursorPageState,
  useScopedHistoryPageQuery,
  useTrackDetailQuery,
} from "../lib/queries";
import { routes } from "../lib/routes";

const PAGE_SIZE = 50;

type ScopedScrobblesLayoutProps = {
  id: string | undefined;
  title: string;
  subtitle: string;
  backTo: string;
  backLabel: string;
  emptyTitle: string;
  emptyBody: string;
  scope: { kind: "artist" | "album" | "track"; id: string };
  detailPending: boolean;
  detailError: unknown;
  detailErrorFallback: string;
};

function PaginationFooter({
  pageIndex,
  canGoPrevious,
  isPending,
  hasNextPage,
  onPrevious,
  onNext,
}: {
  pageIndex: number;
  canGoPrevious: boolean;
  isPending: boolean;
  hasNextPage: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Button kind="secondary" size="sm" onClick={onPrevious} disabled={!canGoPrevious || isPending}>
        Previous
      </Button>
      <span className="text-xs font-medium text-(--text-subdued)">Page {pageIndex + 1}</span>
      <Button kind="secondary" size="sm" onClick={onNext} disabled={!hasNextPage || isPending}>
        Next
      </Button>
    </div>
  );
}

function ScopedScrobblesLayout({
  id,
  title,
  subtitle,
  backTo,
  backLabel,
  emptyTitle,
  emptyBody,
  scope,
  detailPending,
  detailError,
  detailErrorFallback,
}: ScopedScrobblesLayoutProps) {
  const queryClient = useQueryClient();
  const bootstrapQuery = useBootstrapQuery();
  const status = bootstrapQuery.data?.appStatus ?? null;
  const account = status?.account ?? null;
  const pagination = useCursorPageState(
    account && id ? `${account.spotifyId}:${scope.kind}:${id}` : id ?? null,
  );
  const scrobblesQuery = useScopedHistoryPageQuery(
    Boolean(status) && Boolean(id),
    scope,
    pagination.currentCursor,
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
              <PaginationFooter
                pageIndex={pagination.pageIndex}
                canGoPrevious={pagination.canGoPrevious}
                isPending={scrobblesQuery.isPending}
                hasNextPage={Boolean(scrobblesQuery.data?.nextCursor)}
                onPrevious={pagination.goPrevious}
                onNext={() => pagination.goNext(scrobblesQuery.data?.nextCursor)}
              />
            }
          />
        </div>
      )}
    </Shell>
  );
}

export function ArtistScrobblesPage() {
  const { id } = useParams();
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

  return (
    <ScopedScrobblesLayout
      id={id}
      title={title}
      subtitle={subtitle}
      backTo={id ? routes.artist(id) : routes.artists}
      backLabel="Back to artist"
      emptyTitle="No artist scrobbles yet"
      emptyBody="Scrobbles for this artist will appear here once the tracker collects them."
      scope={id ? { kind: "artist", id } : { kind: "artist", id: "" }}
      detailPending={detailQuery.isPending && !detailQuery.data}
      detailError={detailQuery.error}
      detailErrorFallback="Unable to load artist detail."
    />
  );
}

export function AlbumScrobblesPage() {
  const { id } = useParams();
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

  return (
    <ScopedScrobblesLayout
      id={id}
      title={title}
      subtitle={subtitle}
      backTo={id ? routes.album(id) : routes.albums}
      backLabel="Back to album"
      emptyTitle="No album scrobbles yet"
      emptyBody="Scrobbles for this album will appear here once the tracker collects them."
      scope={id ? { kind: "album", id } : { kind: "album", id: "" }}
      detailPending={detailQuery.isPending && !detailQuery.data}
      detailError={detailQuery.error}
      detailErrorFallback="Unable to load album detail."
    />
  );
}

export function TrackScrobblesPage() {
  const { id } = useParams();
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

  return (
    <ScopedScrobblesLayout
      id={id}
      title={title}
      subtitle={subtitle}
      backTo={id ? routes.track(id) : routes.tracks}
      backLabel="Back to track"
      emptyTitle="No track scrobbles yet"
      emptyBody="Scrobbles for this track will appear here once the tracker collects them."
      scope={id ? { kind: "track", id } : { kind: "track", id: "" }}
      detailPending={detailQuery.isPending && !detailQuery.data}
      detailError={detailQuery.error}
      detailErrorFallback="Unable to load track detail."
    />
  );
}
