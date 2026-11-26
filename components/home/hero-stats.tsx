import { AnimatedCounter } from "@/components/animated-counter";
import { cn } from "@/lib/utils";

// Three even ways to show the home hero's six figures — every figure gets the same treatment
// (compared at /preview/stats). Every figure comes from content via lib/home/data.ts.
export type Stat = { key: string; n: number; label: string };

/** A — Divided grid: a 3×2 grid split by hairlines, like a spec sheet. */
export function StatsDivided({ stats, className }: { stats: Stat[]; className?: string }) {
  // Hairlines between cells only: every cell draws a top and left rule, the grid sits 1px up
  // and left, and the wrapper clips that outer row and column of rules away.
  return (
    <div className={cn("overflow-hidden", className)}>
      <dl className="-mt-px -ml-px grid grid-cols-2 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.key} className="border-t border-l border-border px-6 py-6">
            <dd className="text-[clamp(2.1rem,2.8vw,2.8rem)] leading-none font-bold tracking-tight text-foreground">
              <AnimatedCounter value={s.n} />
            </dd>
            <dt className="mt-2 text-[14px] leading-snug text-muted-foreground">{s.label}</dt>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** B — Soft tiles: six equal rounded tiles, figures in the lab's blue. */
export function StatsTiles({ stats, className }: { stats: Stat[]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3", className)}>
      {stats.map((s) => (
        <div key={s.key} className="rounded-[18px] bg-bg-alt px-5 py-5">
          <dd className="text-[clamp(2rem,2.6vw,2.6rem)] leading-none font-bold tracking-tight text-brand">
            <AnimatedCounter value={s.n} />
          </dd>
          <dt className="mt-2 text-[14px] leading-snug text-muted-foreground">{s.label}</dt>
        </div>
      ))}
    </dl>
  );
}

/** C — Side by side: figure and label on one line, two columns, ruled underneath. */
export function StatsInline({ stats, className }: { stats: Stat[]; className?: string }) {
  return (
    <dl className={cn("grid gap-x-10 sm:grid-cols-2", className)}>
      {stats.map((s) => (
        <div key={s.key} className="flex items-center gap-4 border-b border-border py-4">
          <dd className="w-[3.2ch] shrink-0 text-[clamp(2rem,2.6vw,2.6rem)] leading-none font-bold tracking-tight text-foreground tabular-nums">
            <AnimatedCounter value={s.n} />
          </dd>
          <dt className="text-[15px] leading-snug text-muted-foreground">{s.label}</dt>
        </div>
      ))}
    </dl>
  );
}
