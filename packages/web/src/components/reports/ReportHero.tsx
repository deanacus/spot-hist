import type { ReportResponse } from "../../lib/api";
import { formatDecimal, formatDuration } from "../../lib/reports";

function HeroStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-white/6 bg-black/10 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-(--text-subdued)">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-(--text-primary)">{value}</p>
      <p className="mt-1 text-sm text-(--text-secondary)">{hint}</p>
    </div>
  );
}

export function ReportHero({ report }: { report: ReportResponse }) {
  const { summary } = report;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-(--border-subtle) bg-[linear-gradient(135deg,rgba(29,185,84,0.18),rgba(11,18,13,0.96)_40%,rgba(13,16,18,0.98))] p-5 shadow-[0_20px_50px_rgba(0,0,0,0.22)]">
      <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(29,185,84,0.32),transparent_70%)]" />
      <div className="relative grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-(--accent-highlight)">Listening report</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-(--text-primary)">Your {report.label} in music</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-(--text-secondary)">
            {summary.totalScrobbles.toLocaleString()} scrobbles across {formatDuration(summary.totalListeningTimeMs)} of
            listening.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <HeroStat
            label="Scrobbles"
            value={summary.totalScrobbles.toLocaleString()}
            hint={`${formatDecimal(summary.averageScrobblesPerDay)} per day`}
          />
          <HeroStat
            label="Listening time"
            value={formatDuration(summary.totalListeningTimeMs)}
            hint={`${formatDuration(summary.averageListeningTimePerDayMs)} per day`}
          />
          <HeroStat
            label="Most active day"
            value={summary.mostActiveDay ? summary.mostActiveDay.date : "No data"}
            hint={
              summary.mostActiveDay
                ? `${summary.mostActiveDay.playCount.toLocaleString()} scrobbles`
                : "No scrobbles in this period"
            }
          />
          <HeroStat
            label="Longest streak"
            value={`${summary.longestStreakDays} day${summary.longestStreakDays === 1 ? "" : "s"}`}
            hint="Consecutive listening days"
          />
        </div>
      </div>
    </section>
  );
}
