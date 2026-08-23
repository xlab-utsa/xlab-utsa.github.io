"use client";

import type { ReactNode } from "react";
import { Tabs as TabsPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

type Panel = {
  id: string;
  num: string;
  title: string;
  itemLabel: string;
  description: ReactNode;
  content: ReactNode;
};

// Raw radix-ui primitives (not the pill-styled components/ui/tabs.tsx) — this needs a
// completely different visual (vertical sidebar list, not horizontal pills), so
// building on the unstyled primitive directly is simpler than fighting the other
// component's baked-in styling. Still gets full keyboard/ARIA tab behavior from Radix
// (orientation="vertical" gives up/down arrow-key navigation instead of left/right).
export function ResearchBrowser({ panels }: { panels: Panel[] }) {
  if (panels.length === 0) return null;

  return (
    <TabsPrimitive.Root
      defaultValue={panels[0].id}
      orientation="vertical"
      className="mt-6 flex flex-col border-t border-border lg:flex-row"
    >
      <TabsPrimitive.List className="flex flex-col lg:w-[250px] lg:flex-none lg:border-r lg:border-border">
        {panels.map((panel) => (
          <TabsPrimitive.Trigger
            key={panel.id}
            value={panel.id}
            className={cn(
              "group flex flex-col gap-1 border-b border-l-[3px] border-border border-l-transparent px-5 py-3.5 text-left outline-none",
              "data-[state=active]:border-l-brand data-[state=active]:bg-background",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            )}
          >
            <span className="font-mono text-[11px] text-text-faint group-data-[state=active]:text-brand">
              {panel.num}
            </span>
            <span className="text-sm font-semibold text-muted-foreground group-data-[state=active]:text-[15px] group-data-[state=active]:font-bold group-data-[state=active]:text-foreground">
              {panel.title}
            </span>
            <span className="font-mono text-[10px] tracking-wide text-text-faint uppercase">
              {panel.itemLabel}
            </span>
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>

      {panels.map((panel) => (
        <TabsPrimitive.Content
          key={panel.id}
          value={panel.id}
          className="flex-1 px-6 py-7 outline-none sm:px-9"
        >
          <div className="mb-5 flex flex-col gap-1.5 border-b-2 border-foreground pb-4">
            <span className="font-mono text-[11.5px] text-text-faint">
              Thrust {panel.num} / {String(panels.length).padStart(2, "0")}
            </span>
            <span className="text-2xl leading-tight font-bold tracking-tight text-foreground">
              {panel.title}
            </span>
            {panel.description}
          </div>
          {panel.content ?? (
            <p className="text-sm text-muted-foreground">
              No projects or publications tagged to this thrust yet.
            </p>
          )}
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  );
}
