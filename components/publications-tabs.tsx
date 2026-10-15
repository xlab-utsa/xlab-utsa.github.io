"use client";

import { Suspense, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type Item = { id: string; themeIds: string[]; node: ReactNode };
type Panel = { key: string; label: string; items: Item[] };
type Theme = { id: string; title: string; count: number };
type Props = { panels: Panel[]; themes: Theme[]; total: number };

// Client-only shell around Radix Tabs' interactive state plus the research-area filter.
// Each entry is server-rendered JSX passed in from app/publications/page.tsx, not raw
// data — so switching tabs or areas never re-fetches or re-serializes the underlying
// publication records; it only chooses which pre-rendered entries to show.
function Browser({
  panels,
  themes,
  total,
  activeTheme,
  onSelectTheme,
}: Props & {
  activeTheme: string | null;
  onSelectTheme: (id: string | null) => void;
}) {
  const chip = (id: string | null, label: string, count: number) => {
    const active = activeTheme === id;
    return (
      <button
        key={id ?? "all"}
        type="button"
        aria-pressed={active}
        onClick={() => onSelectTheme(id)}
        className={cn(
          "border px-3 py-1 text-[13px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
          active
            ? "border-foreground bg-foreground text-background"
            : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
        )}
      >
        {label}{" "}
        <span className="font-mono text-[11.5px] opacity-70">{count}</span>
      </button>
    );
  };

  return (
    <>
      <div
        role="group"
        aria-label="Filter by research area"
        className="mb-6 flex flex-wrap gap-2"
      >
        {chip(null, "All areas", total)}
        {themes.map((theme) => chip(theme.id, theme.title, theme.count))}
      </div>
      <Tabs defaultValue={panels[0]?.key}>
        <TabsList className="h-auto">
          {panels.map((panel) => {
            const count = activeTheme
              ? panel.items.filter((item) => item.themeIds.includes(activeTheme)).length
              : panel.items.length;
            return (
              <TabsTrigger key={panel.key} value={panel.key}>
                {panel.label} ({count})
              </TabsTrigger>
            );
          })}
        </TabsList>
        {panels.map((panel) => {
          const items = activeTheme
            ? panel.items.filter((item) => item.themeIds.includes(activeTheme))
            : panel.items;
          return (
            <TabsContent key={panel.key} value={panel.key}>
              {items.length > 0 ? (
                <ol>{items.map((item) => item.node)}</ol>
              ) : (
                <p className="py-4 text-sm text-muted-foreground">
                  No {panel.label.toLowerCase()} in this research area.
                </p>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </>
  );
}

// The selected area lives in the URL (?theme=<id>) so the homepage research section can
// deep-link into one area, and so a filtered view can be shared.
function FilteredBrowser(props: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requested = searchParams.get("theme");
  const activeTheme = props.themes.some((t) => t.id === requested) ? requested : null;

  const selectTheme = (id: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set("theme", id);
    else params.delete("theme");
    const query = params.toString();
    window.history.replaceState(null, "", query ? `${pathname}?${query}` : pathname);
  };

  return <Browser {...props} activeTheme={activeTheme} onSelectTheme={selectTheme} />;
}

// useSearchParams needs a Suspense boundary in a statically exported page. The fallback
// is the unfiltered list, so the prerendered HTML still contains every publication.
export function PublicationsTabs(props: Props) {
  return (
    <Suspense fallback={<Browser {...props} activeTheme={null} onSelectTheme={() => {}} />}>
      <FilteredBrowser {...props} />
    </Suspense>
  );
}
