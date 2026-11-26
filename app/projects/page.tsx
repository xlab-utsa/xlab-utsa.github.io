import type { Metadata } from "next";

import { getProjectsData } from "@/components/projects/data";
import { ProjectExplorer } from "@/components/projects/explorer";
import { ProjectsIntro } from "@/components/projects/intro";

export const metadata: Metadata = {
  title: "Projects",
};

// Projects (SPEC.md §5–§6): one project at a time — the list stays put on the left, the chosen
// project fills the panel on the right with its illustration, the papers behind it, the lab
// members on those papers and its links. No per-project detail page; /projects#<id> opens the
// page on that project. Chosen from the designs at /preview/projects ("P4 · Explorer").
export default function ProjectsPage() {
  const { projects } = getProjectsData();
  return (
    <div>
      <ProjectsIntro projects={projects} />
      <div className="mx-auto max-w-[1500px] px-6 pb-20 sm:px-10">
        <ProjectExplorer projects={projects} />
      </div>
    </div>
  );
}
