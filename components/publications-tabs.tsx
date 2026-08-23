"use client";

import type { ReactNode } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Client-only shell around Radix Tabs' interactive state. Panel content is
// server-rendered JSX passed in from app/publications/page.tsx, not raw data — so
// switching tabs never re-fetches or re-serializes the underlying publication records.
export function PublicationsTabs({
  panels,
}: {
  panels: { key: string; label: string; content: ReactNode }[];
}) {
  return (
    <Tabs defaultValue={panels[0]?.key}>
      <TabsList>
        {panels.map((panel) => (
          <TabsTrigger key={panel.key} value={panel.key}>
            {panel.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {panels.map((panel) => (
        <TabsContent key={panel.key} value={panel.key}>
          {panel.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
