import type { ReactNode } from "react";
import type { ReportBucket } from "../../lib/api";
import { formatShare, getBucketMax } from "../../lib/reports";

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-(--border-subtle) bg-(--bg-elevated) p-5">
      <div className="mb-4">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="mt-1 text-sm text-(--text-secondary)">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function HorizontalBars({ buckets }: { buckets: ReportBucket[] }) {
  const max = getBucketMax(buckets);

  return (
    <div className="space-y-3">
      {buckets.map((bucket) => (
        <div key={bucket.key} className="grid grid-cols-[56px_minmax(0,1fr)_48px] items-center gap-3">
          <span className="text-sm text-(--text-secondary)">{bucket.label}</span>
          <div className="h-2.5 rounded-full bg-(--bg)">
            <div
              className="h-full rounded-full bg-(--accent)"
              style={{ width: `${max > 0 ? (bucket.count / max) * 100 : 0}%` }}
            />
          </div>
          <span className="text-right text-sm font-medium text-(--text-primary)">{bucket.count}</span>
        </div>
      ))}
    </div>
  );
}

function DonutChart({ buckets }: { buckets: ReportBucket[] }) {
  const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0);
  let current = 0;
  const colors = ["#1db954", "#63d98d", "#2c6e49", "#a4f1bf"];
  const segments = buckets.map((bucket, index) => {
    const start = total > 0 ? (current / total) * 100 : 0;
    current += bucket.count;
    const end = total > 0 ? (current / total) * 100 : 0;
    return `${colors[index % colors.length]} ${start}% ${end}%`;
  });

  return (
    <div className="grid gap-4 sm:grid-cols-[120px_minmax(0,1fr)] sm:items-center">
      <div
        className="mx-auto h-28 w-28 rounded-full"
        style={{
          background:
            total > 0
              ? `conic-gradient(${segments.join(", ")})`
              : "conic-gradient(rgba(255,255,255,0.08) 0 100%)",
          mask: "radial-gradient(circle at center, transparent 45%, black 46%)",
          WebkitMask: "radial-gradient(circle at center, transparent 45%, black 46%)",
        }}
      />
      <div className="space-y-2">
        {buckets.map((bucket, index) => (
          <div key={bucket.key} className="flex items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />
              <span className="text-(--text-secondary)">{bucket.label}</span>
            </div>
            <span className="font-medium text-(--text-primary)">
              {bucket.count} · {formatShare(bucket.share)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatClockHour(hour: number) {
  const normalizedHour = ((hour % 24) + 24) % 24;
  const meridiem = normalizedHour < 12 ? "AM" : "PM";
  const hourOnTwelveClock = normalizedHour % 12 === 0 ? 12 : normalizedHour % 12;
  return `${hourOnTwelveClock}${meridiem}`;
}

function getPeakBucket(buckets: ReportBucket[]) {
  return buckets.reduce<ReportBucket | null>((peak, bucket) => {
    if (!peak || bucket.count > peak.count) {
      return bucket;
    }

    return peak;
  }, null);
}

function ClockChart({ buckets }: { buckets: ReportBucket[] }) {
  const max = getBucketMax(buckets);
  const peak = getPeakBucket(buckets);
  const peakHour = peak ? Number(peak.key) : 0;
  const hasData = max > 0;
  const center = 140;
  const innerRadius = 58;
  const guideRadius = 104;
  const minimumBarLength = 12;
  const maximumBarLength = 36;
  const guideStroke = 8;
  const activeStroke = 10;
  const cardinalHours = [0, 6, 12, 18];

  const describeClock = hasData
    ? `Listening clock, peak hour ${formatClockHour(peakHour)} with ${peak?.count ?? 0} scrobbles`
    : "Listening clock, no scrobbles recorded in this period";

  function pointAt(radius: number, angle: number) {
    return {
      x: center + Math.cos(angle) * radius,
      y: center + Math.sin(angle) * radius,
    };
  }

  return (
    <div className="space-y-4">
      <div className="mx-auto w-full max-w-[320px]">
        <svg viewBox="0 0 280 280" role="img" aria-label={describeClock} className="h-auto w-full overflow-visible">
          <defs>
            <radialGradient id="clockGlow" cx="50%" cy="50%" r="55%">
              <stop offset="0%" stopColor="rgba(29, 185, 84, 0.24)" />
              <stop offset="100%" stopColor="rgba(29, 185, 84, 0)" />
            </radialGradient>
            <linearGradient id="clockBar" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#8CF3B5" />
              <stop offset="100%" stopColor="#1DB954" />
            </linearGradient>
          </defs>

          <circle cx={center} cy={center} r="70" fill="url(#clockGlow)" />
          <circle cx={center} cy={center} r="54" fill="rgba(8, 12, 10, 0.82)" stroke="rgba(255,255,255,0.06)" />

          {buckets.map((bucket, index) => {
            const angle = (index / buckets.length) * Math.PI * 2 - Math.PI / 2;
            const guideStart = pointAt(innerRadius, angle);
            const guideEnd = pointAt(guideRadius, angle);
            const activeLength = hasData ? minimumBarLength + (bucket.count / max) * maximumBarLength : 0;
            const activeEnd = pointAt(innerRadius + activeLength, angle);
            const isPeakHour = hasData && bucket.key === peak?.key;

            return (
              <g key={bucket.key}>
                <line
                  x1={guideStart.x}
                  y1={guideStart.y}
                  x2={guideEnd.x}
                  y2={guideEnd.y}
                  stroke="rgba(255,255,255,0.09)"
                  strokeWidth={guideStroke}
                  strokeLinecap="round"
                />
                {activeLength > 0 ? (
                  <line
                    x1={guideStart.x}
                    y1={guideStart.y}
                    x2={activeEnd.x}
                    y2={activeEnd.y}
                    stroke={isPeakHour ? "#D9FFE6" : "url(#clockBar)"}
                    strokeWidth={activeStroke}
                    strokeLinecap="round"
                  />
                ) : null}
              </g>
            );
          })}

          {cardinalHours.map((hour) => {
            const angle = (hour / 24) * Math.PI * 2 - Math.PI / 2;
            const labelPoint = pointAt(122, angle);

            return (
              <text
                key={hour}
                x={labelPoint.x}
                y={labelPoint.y}
                fill="currentColor"
                fontSize="11"
                fontWeight="600"
                textAnchor="middle"
                dominantBaseline="middle"
                className="text-(--text-subdued)"
              >
                {formatClockHour(hour)}
              </text>
            );
          })}
        </svg>
      </div>
      <p className="text-center text-sm text-(--text-secondary)">
        Peak hour: <span className="font-semibold text-(--text-primary)">{hasData ? formatClockHour(peakHour) : "No data"}</span>
      </p>
    </div>
  );
}

export function ReportCharts({
  listeningClock,
  weekdayActivity,
  byDecade,
  releaseFormatMix,
  explicitMix,
}: {
  listeningClock: ReportBucket[];
  weekdayActivity: ReportBucket[];
  byDecade: ReportBucket[];
  releaseFormatMix: ReportBucket[];
  explicitMix: ReportBucket[];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard title="Listening clock" subtitle="How your scrobbles landed across the day">
        <ClockChart buckets={listeningClock} />
      </ChartCard>
      <ChartCard title="Weekday activity" subtitle="The shape of your listening week">
        <HorizontalBars buckets={weekdayActivity} />
      </ChartCard>
      <ChartCard title="Music by decade" subtitle="Release eras behind this period">
        <HorizontalBars buckets={byDecade} />
      </ChartCard>
      <ChartCard title="Format mix" subtitle="Albums, singles, and everything else">
        <DonutChart buckets={releaseFormatMix} />
      </ChartCard>
      <ChartCard title="Explicit vs clean" subtitle="How much of the period was marked explicit">
        <DonutChart buckets={explicitMix} />
      </ChartCard>
    </div>
  );
}
