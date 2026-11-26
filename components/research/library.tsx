"use client";

// The publication library shared by the research-page designs: search, filters (research
// area, type, awarded), sort, and three layouts —
//   "list"    — one entry per row, the paper's figure on the right when it has one;
//   "years"   — the same entries grouped under sticky year headings;
//   "figures" — a grid of the papers' central figures (papers without one listed after).
// The chosen area lives in the URL (?theme=<id>), as on the live page, so the home page can
// deep-link into one area. Entries arrive as plain data (lib/research/data.ts).
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";

import { withBasePath } from "@/lib/base-path";
import type { LibPub } from "@/lib/research/data";
import { cn } from "@/lib/utils";

type Layout = "list" | "years" | "figures";
interface ThemeLite {
  id: string;
  title: string;
  label: string;
  count: number;
}
interface Cat {
  key: string;
  label: string;
  count: number;
}
interface Props {
  pubs: LibPub[];
  themes: ThemeLite[];
  categories: Cat[];
  layout: Layout;
  /** Filters in a sticky sidebar (lg+) instead of a bar above the list. */
  sidebar?: boolean;
  /** Offer a list/figures switch. */
  layoutSwitch?: boolean;
  /** Publication types as tabs above the list (as on the live page) instead of chips. */
  typeTabs?: boolean;
}

const PAGE = 50;

// ------------------------------------------------------------------ entries

function Authors({ authors }: { authors: LibPub["authors"] }) {
  return (
    <p className="text-[14.5px] leading-snug text-muted-foreground">
      {authors.map((a, i) => (
        <span key={`${a.name}-${i}`}>
          {a.href ? (
            <a href={a.href} target="_blank" rel="noopener noreferrer" className="text-foreground/80 underline-offset-2 hover:underline">
              {a.name}
            </a>
          ) : (
            a.name
          )}
          {i < authors.length - 1 ? ", " : ""}
        </span>
      ))}
    </p>
  );
}

function Awards({ awards, className }: { awards: string[]; className?: string }) {
  if (awards.length === 0) return null;
  return (
    <span className={cn("flex flex-wrap gap-1.5", className)}>
      {awards.map((a) => (
        <span key={a} className="inline-flex items-center gap-1 rounded-full bg-brand-orange-soft-bg px-2.5 py-0.5 text-[12px] font-semibold text-brand-orange-strong ring-1 ring-brand-orange-soft-border">
          <span aria-hidden="true">★</span> {a}
        </span>
      ))}
    </span>
  );
}

function Links({ p }: { p: LibPub }) {
  return (
    <span className="flex flex-wrap gap-3 text-[13px] font-semibold">
      {p.doi && (
        <a href={p.doi} target="_blank" rel="noopener noreferrer" className="text-brand underline-offset-2 hover:underline">
          DOI ↗
        </a>
      )}
      {p.url && (
        <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-brand underline-offset-2 hover:underline">
          Paper ↗
        </a>
      )}
    </span>
  );
}

function Entry({ p, themes }: { p: LibPub; themes: Map<string, ThemeLite> }) {
  return (
    <li className="flex flex-col gap-4 border-b border-hairline py-6 sm:flex-row-reverse sm:items-start">
      {p.thumbnail && (
        <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden rounded-lg border border-hairline bg-white sm:w-52">
          <Image src={withBasePath(p.thumbnail)} alt={`Central figure from “${p.title}”`} fill sizes="(min-width: 640px) 13rem, 100vw" className="object-contain p-1.5" />
        </div>
      )}
      <div className="min-w-0 flex-1 space-y-1.5">
        <Awards awards={p.awards} />
        <p className="text-[17px] leading-snug font-semibold tracking-tight text-foreground">{p.title}</p>
        <Authors authors={p.authors} />
        <p className="text-[14.5px] text-muted-foreground">
          {p.venue && <em>{p.venue}</em>}
          {p.date && <span className="font-mono text-[13px] text-text-faint"> · {p.date}</span>}
        </p>
        {p.meta && <p className="font-mono text-[12.5px] text-text-faint">{p.meta}</p>}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1">
          <span className="font-mono text-[11.5px] tracking-wide text-text-faint uppercase">
            {p.themeIds.map((id) => themes.get(id)?.label).filter(Boolean).join(" · ")}
          </span>
          {p.note && <span className="text-[12.5px] text-muted-foreground">{p.note}</span>}
          <Links p={p} />
        </div>
      </div>
    </li>
  );
}

function FigureCard({ p }: { p: LibPub }) {
  return (
    <li className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-background transition-shadow hover:shadow-lg">
      <div className="relative aspect-[16/10] border-b border-hairline bg-white">
        <Image src={withBasePath(p.thumbnail!)} alt={`Central figure from “${p.title}”`} fill sizes="(min-width: 1280px) 22rem, (min-width: 640px) 45vw, 100vw" className="object-contain p-3 transition-transform duration-500 group-hover:scale-[1.03]" />
        {p.awards.length > 0 && (
          <span className="absolute top-3 left-3 rounded-full bg-brand-orange px-2.5 py-1 text-[11.5px] font-bold text-white shadow">★ {p.awards[0]}</span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <p className="font-mono text-[12px] tracking-wide text-text-faint uppercase">
          {[p.venueShort ?? p.venue, p.year].filter(Boolean).join(" · ")}
        </p>
        <p className="text-[16px] leading-snug font-semibold tracking-tight text-foreground">{p.title}</p>
        <p className="line-clamp-2 text-[13.5px] text-muted-foreground">{p.authors.map((a) => a.name).join(", ")}</p>
        <div className="mt-auto pt-2">
          <Links p={p} />
        </div>
      </div>
    </li>
  );
}

// ------------------------------------------------------------------ the library

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-left text-[14px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
        on ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function Browser({ pubs, themes, categories, layout: initial, sidebar, layoutSwitch, typeTabs, theme, setTheme }: Props & { theme: string | null; setTheme: (id: string | null) => void }) {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [awarded, setAwarded] = useState(false);
  const [oldest, setOldest] = useState(false);
  const [layout, setLayout] = useState<Layout>(initial);
  const [limit, setLimit] = useState(PAGE);
  const themeMap = useMemo(() => new Map(themes.map((t) => [t.id, t])), [themes]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = pubs.filter(
      (p) =>
        (!theme || p.themeIds.includes(theme)) &&
        (!cat || p.category === cat) &&
        (!awarded || p.awards.length > 0) &&
        (!q || p.title.toLowerCase().includes(q) || p.venue?.toLowerCase().includes(q) || p.authors.some((a) => a.name.toLowerCase().includes(q)))
    );
    list = [...list].sort((a, b) => (oldest ? (a.year ?? 0) - (b.year ?? 0) : (b.year ?? 0) - (a.year ?? 0)));
    if (layout === "figures") list = [...list.filter((p) => p.thumbnail), ...list.filter((p) => !p.thumbnail)];
    return list;
  }, [pubs, theme, cat, awarded, query, oldest, layout]);

  const visible = shown.slice(0, limit);
  const typeCount = (key: string | null) => {
    const q = query.trim().toLowerCase();
    return pubs.filter(
      (p) =>
        (!theme || p.themeIds.includes(theme)) &&
        (!key || p.category === key) &&
        (!awarded || p.awards.length > 0) &&
        (!q || p.title.toLowerCase().includes(q) || p.venue?.toLowerCase().includes(q) || p.authors.some((a) => a.name.toLowerCase().includes(q)))
    ).length;
  };
  const tabs = typeTabs && (
    <div role="tablist" aria-label="Publication type" className="-mb-px flex gap-1 overflow-x-auto border-b border-border">
      {[{ key: null as string | null, label: "All" }, ...categories.filter((c) => c.count > 0)].map((c) => {
        const on = cat === c.key;
        return (
          <button
            key={c.key ?? "all"}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => (setCat(c.key), reset())}
            className={cn(
              "shrink-0 border-b-2 px-4 py-3 text-[15px] font-semibold whitespace-nowrap transition-colors",
              on ? "border-brand text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {c.label} <span className="font-mono text-[12.5px] font-normal opacity-60">{typeCount(c.key)}</span>
          </button>
        );
      })}
    </div>
  );
  const reset = () => setLimit(PAGE);

  const filters = (
    <div className={cn("space-y-5", sidebar && "lg:space-y-7")}>
      <label className="block">
        <span className="sr-only">Search publications</span>
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            reset();
          }}
          placeholder="Search titles, authors, venues…"
          className="w-full rounded-full border border-border bg-background px-5 py-3 text-[15px] text-foreground outline-none placeholder:text-text-faint focus:border-foreground"
        />
      </label>
      <div>
        <p className="mb-2 font-mono text-[12px] tracking-[0.16em] text-text-faint uppercase">Research area</p>
        <div role="group" aria-label="Filter by research area" className={cn("flex flex-wrap gap-2", sidebar && "lg:flex-col lg:items-start")}>
          <Chip on={!theme} onClick={() => (setTheme(null), reset())}>
            All areas <span className="font-mono text-[12px] opacity-60">{pubs.length}</span>
          </Chip>
          {themes.map((t) => (
            <Chip key={t.id} on={theme === t.id} onClick={() => (setTheme(t.id), reset())}>
              {t.title} <span className="font-mono text-[12px] opacity-60">{t.count}</span>
            </Chip>
          ))}
        </div>
      </div>
      <div className={cn(typeTabs && "hidden")}>
        <p className="mb-2 font-mono text-[12px] tracking-[0.16em] text-text-faint uppercase">Type</p>
        <div role="group" aria-label="Filter by type" className="flex flex-wrap gap-2">
          <Chip on={!cat} onClick={() => (setCat(null), reset())}>
            All
          </Chip>
          {categories
            .filter((c) => c.count > 0)
            .map((c) => (
              <Chip key={c.key} on={cat === c.key} onClick={() => (setCat(c.key), reset())}>
                {c.label} <span className="font-mono text-[12px] opacity-60">{c.count}</span>
              </Chip>
            ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Chip on={awarded} onClick={() => (setAwarded(!awarded), reset())}>
          ★ Award-winning only
        </Chip>
        <Chip on={oldest} onClick={() => setOldest(!oldest)}>
          {oldest ? "Oldest first" : "Newest first"}
        </Chip>
      </div>
    </div>
  );

  let body: React.ReactNode;
  if (shown.length === 0) {
    body = <p className="py-10 text-[16px] text-muted-foreground">No publications match. Try clearing a filter.</p>;
  } else if (layout === "figures") {
    const figs = visible.filter((p) => p.thumbnail);
    const rest = visible.filter((p) => !p.thumbnail);
    body = (
      <>
        {figs.length > 0 && (
          <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {figs.map((p) => (
              <FigureCard key={p.id} p={p} />
            ))}
          </ul>
        )}
        {rest.length > 0 && (
          <>
            <p className="mt-12 font-mono text-[12px] tracking-[0.16em] text-text-faint uppercase">Without a figure yet</p>
            <ol>
              {rest.map((p) => (
                <Entry key={p.id} p={p} themes={themeMap} />
              ))}
            </ol>
          </>
        )}
      </>
    );
  } else if (layout === "years") {
    const groups = new Map<string, LibPub[]>();
    for (const p of visible) {
      const k = p.year ? String(p.year) : "Undated";
      groups.set(k, [...(groups.get(k) ?? []), p]);
    }
    body = (
      <div>
        {[...groups.entries()].map(([year, list]) => (
          <section key={year} aria-label={year}>
            <h3 className="sticky top-[59px] z-10 flex items-baseline gap-3 border-b border-border bg-background/95 py-3 backdrop-blur">
              <span className="text-[28px] leading-none font-bold tracking-tight text-foreground">{year}</span>
              <span className="font-mono text-[13px] text-text-faint">{list.length}</span>
            </h3>
            <ol>
              {list.map((p) => (
                <Entry key={p.id} p={p} themes={themeMap} />
              ))}
            </ol>
          </section>
        ))}
      </div>
    );
  } else {
    body = (
      <ol>
        {visible.map((p) => (
          <Entry key={p.id} p={p} themes={themeMap} />
        ))}
      </ol>
    );
  }

  return (
    <div className={cn(sidebar && "lg:grid lg:grid-cols-[300px_1fr] lg:gap-14")}>
      <aside className={cn("mb-8", sidebar && "lg:sticky lg:top-[calc(59px+24px)] lg:mb-0 lg:max-h-[calc(100vh-59px-48px)] lg:self-start lg:overflow-y-auto lg:pr-2")}>{filters}</aside>
      <div className="min-w-0">
        {tabs}
        <div className={cn("flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4", typeTabs && "pt-4")}>
          <p aria-live="polite" className="text-[15px] text-muted-foreground">
            <span className="font-semibold text-foreground">{shown.length}</span> of {pubs.length} publications
            {theme ? ` in ${themeMap.get(theme)?.title}` : ""}
          </p>
          {layoutSwitch && (
            <div role="group" aria-label="Layout" className="flex rounded-full border border-border p-1">
              {(["figures", "list"] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  aria-pressed={layout === l}
                  onClick={() => setLayout(l)}
                  className={cn("rounded-full px-4 py-1.5 text-[13.5px] font-semibold capitalize", layout === l ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}
                >
                  {l}
                </button>
              ))}
            </div>
          )}
        </div>
        {body}
        {shown.length > limit && (
          <button
            type="button"
            onClick={() => setLimit(limit + PAGE)}
            className="mt-8 w-full rounded-full border border-border py-3.5 text-[15px] font-semibold text-foreground transition-colors hover:bg-muted"
          >
            Show {Math.min(PAGE, shown.length - limit)} more · {shown.length - limit} left
          </button>
        )}
      </div>
    </div>
  );
}

function WithUrl(props: Props) {
  const pathname = usePathname();
  const params = useSearchParams();
  const requested = params.get("theme");
  const theme = props.themes.some((t) => t.id === requested) ? requested : null;
  // replaceState keeps Next's router in sync, so useSearchParams (and `theme`) follow it.
  const setTheme = (id: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (id) next.set("theme", id);
    else next.delete("theme");
    const q = next.toString();
    window.history.replaceState(null, "", q ? `${pathname}?${q}` : pathname);
  };
  return <Browser {...props} theme={theme} setTheme={setTheme} />;
}

/** useSearchParams needs a Suspense boundary in a static export; the fallback is unfiltered. */
export function Library(props: Props) {
  return (
    <Suspense fallback={<Browser {...props} theme={null} setTheme={() => {}} />}>
      <WithUrl {...props} />
    </Suspense>
  );
}
