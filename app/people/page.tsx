import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { PeopleDirectory } from "@/components/people/people-directory";
import { getAlumniPeople, getCurrentPeople } from "@/lib/content";

export const metadata: Metadata = {
  title: "People",
};

export default function PeoplePage() {
  const current = getCurrentPeople().length;
  const alumni = getAlumniPeople().length;

  return (
    <div className="mx-auto max-w-[1600px] px-6 py-14 sm:px-10">
      <PageHeader
        title="People"
        meta={`${current} current members · ${alumni} alumni`}
        intro="The lab's principal investigator, its postdocs, visiting faculty and students — and the alumni who have gone on from here."
      />
      <div className="mt-10">
        <PeopleDirectory />
      </div>
    </div>
  );
}
