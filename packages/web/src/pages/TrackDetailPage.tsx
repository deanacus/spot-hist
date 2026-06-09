import { Link, useParams } from "react-router-dom";
import {
  ArtistsInline,
  DetailPageIntro,
  DetailPageState,
  RecentPlaysSection,
  SectionHeader,
  StatRow,
  formatDateTime,
  formatDuration,
  formatPlayCount,
} from "../components/DetailUi";
import { AlbumArt, SpotifyLink } from "../components/Media";
import { Shell } from "../components/Ui";
import { useDetailRefresh } from "../lib/detail-page";
import { getErrorMessage } from "../lib/errors";
import {
  isUnauthorizedError,
  useBootstrapQuery,
  useRefreshTrackDetailMutation,
  useTrackDetailQuery,
  useTrackRecentPlaysQuery,
} from "../lib/queries";
import { routes } from "../lib/routes";

function getTrackDetailError(error: unknown) {
  if (!error || isUnauthorizedError(error)) {
    return null;
  }

  return getErrorMessage(error, "Unable to load track detail.");
}

function useTrackDetailPageData(id: string | undefined) {
  const bootstrapQuery = useBootstrapQuery();
  const status = bootstrapQuery.data?.appStatus ?? null;
  const account = status?.account ?? null;
  const detailQuery = useTrackDetailQuery(id, Boolean(status));
  const recentPlaysQuery = useTrackRecentPlaysQuery(id, Boolean(status), 5);
  const {
    error: refreshError,
    isPending: isRefreshing,
    mutate: refreshDetail,
    reset: resetRefresh,
  } = useRefreshTrackDetailMutation(id);
  const detail = detailQuery.data;
  const { refreshWarning, dismissRefreshWarning } = useDetailRefresh({
    id,
    detail,
    detailError: detailQuery.error,
    refreshError,
    isRefreshing,
    resetRefresh,
    refreshErrorMessage: "Unable to refresh track detail right now.",
    refresh: ({ onError }) => refreshDetail(undefined, { onError }),
  });

  return {
    account,
    detail,
    detailError: getTrackDetailError(detailQuery.error),
    detailLoading: detailQuery.isPending && !detail,
    isRefreshing,
    refreshWarning,
    dismissRefreshWarning,
    recentPlays: recentPlaysQuery.data?.items ?? [],
  };
}

function TrackDetailHero(props: {
  detail: NonNullable<ReturnType<typeof useTrackDetailPageData>["detail"]>;
}) {
  const { detail } = props;

  return (
    <>
      <div className="flex items-end gap-6">
        <AlbumArt
          imageUrl={detail.album.imageUrl}
          alt={`${detail.album.name} album art`}
          fallbackLabel="♪"
          className="h-48 w-48 shadow-[0_4px_60px_rgba(0,0,0,0.5)]"
        />
        <div className="min-w-0 flex-1 space-y-2 pb-1">
          <p className="text-xs font-medium uppercase tracking-wider text-(--text-subdued)">Song</p>
          <h1 className="text-5xl font-black tracking-tight">{detail.track.name}</h1>
          <p className="text-sm text-(--text-secondary)">
            <ArtistsInline artists={detail.artists} /> •{" "}
            <Link to={routes.album(detail.album.id)} className="hover:underline">
              {detail.album.name}
            </Link>{" "}
            • {formatDuration(detail.track.durationMs)}
          </p>
          <div className="flex flex-wrap items-center gap-3 text-sm text-(--text-secondary)">
            {detail.track.explicit ? (
              <span className="rounded bg-(--bg-tinted) px-2 py-0.5 text-[10px] font-bold uppercase text-(--text-secondary)">
                E
              </span>
            ) : null}
            {detail.track.isrc ? <span className="text-xs text-(--text-subdued)">ISRC {detail.track.isrc}</span> : null}
          </div>
          <SpotifyLink url={detail.spotify.url} />
        </div>
      </div>

      {detail.spotify.previewUrl ? (
        <audio controls preload="none" src={detail.spotify.previewUrl} className="w-full max-w-md">
          Preview
        </audio>
      ) : null}
    </>
  );
}

function AlbumTracklistSection(props: {
  detail: NonNullable<ReturnType<typeof useTrackDetailPageData>["detail"]>;
}) {
  const { detail } = props;

  return (
    <section className="space-y-3">
      <SectionHeader title="Album tracklist" />
      {detail.albumTracklist.length === 0 ? (
        <p className="text-sm text-(--text-subdued)">No tracklist available.</p>
      ) : (
        <div>
          {detail.albumTracklist.map((item) => (
            <div
              key={item.id}
              className={[
                "group flex items-center gap-3 rounded px-3 py-2 transition-colors",
                item.isCurrentTrack ? "bg-(--accent-subdued)" : "hover:bg-(--bg-hover)",
              ].join(" ")}
            >
              <span className="w-6 text-center text-sm tabular-nums text-(--text-subdued)">
                {item.trackNumber ?? "—"}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm ${item.isCurrentTrack ? "font-bold text-(--accent)" : "font-medium"}`}>
                  {item.routeId ? (
                    <Link to={routes.track(item.routeId)} className="hover:underline">
                      {item.name}
                    </Link>
                  ) : (
                    item.name
                  )}
                </p>
                <p className="truncate text-xs text-(--text-secondary)">
                  <ArtistsInline artists={item.artists} />
                </p>
              </div>
              <span className="text-sm tabular-nums text-(--text-secondary)">
                {item.playCount?.toLocaleString() ?? "0"} scrobbles
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function TrackDetailContent(props: ReturnType<typeof useTrackDetailPageData>) {
  const { detail, dismissRefreshWarning, isRefreshing, recentPlays, refreshWarning } = props;

  if (!detail) {
    return null;
  }

  return (
    <div className="space-y-6">
      <DetailPageIntro
        backTo={routes.tracks}
        backLabel="Back to tracks"
        refreshWarning={refreshWarning}
        onDismissRefreshWarning={dismissRefreshWarning}
        isRefreshing={isRefreshing}
        refreshingMessage="Refreshing track metadata in the background..."
      />

      <TrackDetailHero detail={detail} />

      <StatRow
        items={[
          { label: "Rank", value: detail.stats.rank ? `#${detail.stats.rank}` : "—" },
          { label: "Total scrobbles", value: formatPlayCount(detail.stats.totalPlays) },
          { label: "First scrobbled", value: formatDateTime(detail.stats.firstPlayedAt) },
          { label: "Last scrobbled", value: formatDateTime(detail.stats.lastPlayedAt) },
          { label: "Duration", value: formatDuration(detail.track.durationMs) },
        ]}
      />

      <RecentPlaysSection
        title="Recent scrobbles"
        description="Most recent scrobbles collected for this track."
        items={recentPlays}
        action={
          <Link
            to={routes.trackScrobbles(detail.track.id)}
            className="text-sm font-medium text-(--text-secondary) transition hover:text-(--text-primary)"
          >
            View all
          </Link>
        }
      />

      <AlbumTracklistSection detail={detail} />
    </div>
  );
}

export function TrackDetailPage() {
  const { id } = useParams();
  const trackDetailPageData = useTrackDetailPageData(id);

  return (
    <Shell>
      <DetailPageState
        hasAccount={Boolean(trackDetailPageData.account)}
        hasRouteId={Boolean(id)}
        disconnectedBody="Reconnect in settings before viewing track detail."
        missingIdMessage="Track id is missing from the route."
        isPending={trackDetailPageData.detailLoading}
        loadingLabel="Loading track detail..."
        error={!trackDetailPageData.detail ? trackDetailPageData.detailError : null}
      >
        <TrackDetailContent {...trackDetailPageData} />
      </DetailPageState>
    </Shell>
  );
}
