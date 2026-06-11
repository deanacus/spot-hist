function MetricTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-(--border-subtle) bg-(--bg-elevated) p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-(--text-subdued)">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
      <p className="mt-1 text-sm text-(--text-secondary)">{hint}</p>
    </div>
  );
}

export function ReportMetricStrip({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; value: string; hint: string }>;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {items.map((item) => (
          <MetricTile key={item.label} {...item} />
        ))}
      </div>
    </section>
  );
}
