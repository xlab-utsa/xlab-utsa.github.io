// Top publication venues as a ranked bar list (SPEC.md §5 — chosen over a word cloud: it
// reads at a glance and works with a screen reader). Counts come only from publications
// linked to a Venue record; until Phase 5 links them, this shows a placeholder rather than
// guessing from the free-text venue strings.
export interface VenueDatum {
  id: string;
  label: string;
  name: string;
  value: number;
}

export function VenueBars({ data, title }: { data: VenueDatum[]; title: string }) {
  if (data.length === 0) {
    return (
      <div className="flex h-full min-h-[260px] flex-col items-center justify-center gap-2 border border-dashed border-border p-6 text-center">
        <span className="font-mono text-[11px] font-bold tracking-wider text-text-faint uppercase">{title}</span>
        <p className="max-w-[36ch] text-[13.5px] leading-relaxed text-muted-foreground">
          Coming soon — this chart fills in once each paper is linked to its conference or journal.
        </p>
      </div>
    );
  }

  const max = Math.max(...data.map((d) => d.value));
  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="font-mono text-[11px] tracking-wide text-text-faint uppercase">{title}</figcaption>
      <ol className="flex flex-col gap-2">
        {data.map((d) => (
          <li key={d.id} title={`${d.name}: ${d.value} publications`} className="grid grid-cols-[88px_1fr_36px] items-center gap-3">
            <span className="truncate font-mono text-[12px] font-bold text-foreground">{d.label}</span>
            <span aria-hidden="true" className="h-3 rounded-r-[4px] bg-foreground" style={{ width: `${(d.value / max) * 100}%` }} />
            <span className="text-right font-mono text-[12px] text-muted-foreground">{d.value}</span>
          </li>
        ))}
      </ol>
    </figure>
  );
}
