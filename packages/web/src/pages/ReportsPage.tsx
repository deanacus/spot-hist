import { EmptyState, Shell } from "../components/Ui";
import { ReportCharts } from "../components/reports/ReportCharts";
import { ReportHero } from "../components/reports/ReportHero";
import { ReportMetricStrip } from "../components/reports/ReportMetricStrip";
import { RankedEntityList } from "../components/reports/RankedEntityList";
import { ReportNavigator } from "../components/reports/ReportNavigator";
import { formatCalendarDate } from "../lib/datetime";
import { getErrorMessage } from "../lib/errors";
import { formatDecimal, formatDuration, formatShare, parseReportOffset, parseReportTimeframe } from "../lib/reports";
import { routes } from "../lib/routes";
import { isUnauthorizedError, useReportQuery } from "../lib/queries";
import { useInvalidateBootstrapOnUnauthorized, usePageStatus } from "../lib/page-state";
import { useSearchParams } from "react-router-dom";

export function ReportsPage() {
  const [searchParams] = useSearchParams();
  const timeframe = parseReportTimeframe(searchParams.get("timeframe"));
  const offset = parseReportOffset(searchParams.get("offset"));
  const { status, account } = usePageStatus();
  const reportQuery = useReportQuery(Boolean(status), timeframe, offset);
  useInvalidateBootstrapOnUnauthorized(reportQuery.error);

  const error =
    reportQuery.error && !isUnauthorizedError(reportQuery.error)
      ? getErrorMessage(reportQuery.error, "Unable to load your listening report.")
      : null;

  const report = reportQuery.data;

  return (
    <Shell title="Reports" subtitle={report?.label ?? "Listening report"} contentWidthClassName="max-w-[1280px]">
      {!account ? (
        <EmptyState title="Spotify is disconnected" body="Reconnect in settings before viewing reports." />
      ) : reportQuery.isPending ? (
        <div className="rounded-2xl border border-(--border-subtle) bg-(--bg-elevated) p-6 text-sm text-(--text-secondary)">
          Building your listening report…
        </div>
      ) : error ? (
        <EmptyState title="Unable to load reports" body={error} />
      ) : report ? (
        <div className="space-y-6">
          <ReportNavigator
            timeframe={report.timeframe}
            offset={report.offset}
            label={report.label}
            hasPrevious={report.hasPreviousPeriod}
            hasNext={report.hasNextPeriod}
          />

          <ReportHero report={report} />

          {report.summary.totalScrobbles === 0 ? (
            <EmptyState
              title="No scrobbles in this period"
              body="Pick another timeframe or move to an earlier period to see a filled report."
            />
          ) : null}

          <ReportMetricStrip
            title="Discovery"
            items={[
              {
                label: "Artists",
                value: report.discovery.uniqueArtists.toLocaleString(),
                hint: `${report.discovery.newArtists.toLocaleString()} new to you`,
              },
              {
                label: "Albums",
                value: report.discovery.uniqueAlbums.toLocaleString(),
                hint: `${report.discovery.newAlbums.toLocaleString()} new to you`,
              },
              {
                label: "Tracks",
                value: report.discovery.uniqueTracks.toLocaleString(),
                hint: `${report.discovery.newTracks.toLocaleString()} new to you`,
              },
            ]}
          />

          <div className="grid gap-4 xl:grid-cols-3">
            <RankedEntityList
              title="Top artists"
              subtitle="The artists that defined this period"
              items={report.topArtists.map((item, index) => ({
                rank: index + 1,
                kind: "artist",
                name: item.artist.name,
                to: routes.artist(item.artist.id),
                imageUrl: item.artist.imageUrl ?? null,
                eyebrow: `${item.playCount.toLocaleString()} scrobbles · ${formatDuration(item.listeningTimeMs)}`,
                statLine: formatShare(item.shareOfScrobbles),
              }))}
            />
            <RankedEntityList
              title="Top albums"
              subtitle="Most replayed albums and singles"
              items={report.topAlbums.map((item, index) => ({
                rank: index + 1,
                kind: "album",
                name: item.album.name,
                to: routes.album(item.album.id),
                imageUrl: item.album.imageUrl,
                eyebrow: item.artists.map((artist) => artist.name).join(", "),
                statLine: `${item.playCount.toLocaleString()} scrobbles · ${formatDuration(item.listeningTimeMs)}`,
              }))}
            />
            <RankedEntityList
              title="Top tracks"
              subtitle="The songs you lived with"
              items={report.topTracks.map((item, index) => ({
                rank: index + 1,
                kind: "track",
                name: item.track.name,
                to: routes.track(item.track.id),
                imageUrl: item.album.imageUrl,
                eyebrow: item.artists.map((artist) => artist.name).join(", "),
                statLine: `${item.playCount.toLocaleString()} scrobbles · ${formatDuration(item.listeningTimeMs)}`,
              }))}
            />
          </div>

          <section className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-(--border-subtle) bg-(--bg-elevated) p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-(--text-subdued)">Scrobbles / day</p>
              <p className="mt-2 text-2xl font-bold">{formatDecimal(report.summary.averageScrobblesPerDay)}</p>
            </div>
            <div className="rounded-2xl border border-(--border-subtle) bg-(--bg-elevated) p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-(--text-subdued)">Listening / day</p>
              <p className="mt-2 text-2xl font-bold">{formatDuration(report.summary.averageListeningTimePerDayMs)}</p>
            </div>
            <div className="rounded-2xl border border-(--border-subtle) bg-(--bg-elevated) p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-(--text-subdued)">Most active day</p>
              <p className="mt-2 text-2xl font-bold">
                {report.summary.mostActiveDay ? formatCalendarDate(report.summary.mostActiveDay.date) : "No data"}
              </p>
            </div>
          </section>

          <ReportCharts
            listeningClock={report.patterns.listeningClock}
            weekdayActivity={report.patterns.weekdayActivity}
            byDecade={report.patterns.byDecade}
            releaseFormatMix={report.composition.releaseFormatMix}
            explicitMix={report.composition.explicitMix}
          />
        </div>
      ) : null}
    </Shell>
  );
}
