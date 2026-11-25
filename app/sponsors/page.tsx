import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { SponsorGrid } from "@/components/sponsor-grid";
import { getAllSponsors } from "@/lib/content";

export const metadata: Metadata = {
  title: "Sponsors",
};

// Logos only — the same grid as the homepage — until the PI asks for grant detail
// (SPEC.md decision #7).
export default function SponsorsPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-14 sm:px-10">
      <PageHeader
        title="Sponsors"
        intro="The organizations whose support makes the lab's research possible."
      />
      <div className="mt-10">
        <SponsorGrid sponsors={getAllSponsors()} />
      </div>
    </div>
  );
}
