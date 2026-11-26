import { getProjectsPreviewData } from "@/components/preview/projects/data";
import { ProjectExplorer } from "@/components/preview/projects/explorer";
import { ProjectsIntro } from "@/components/preview/projects/intro";
import { ProjectsPreviewBar } from "@/components/preview/projects/nav";

// P4 · Explorer — one project at a time: the list stays put on the left, the chosen project
// fills the panel on the right with its illustration, papers, people and links.
export default function ExplorerPreview() {
  const { projects } = getProjectsPreviewData();
  return (
    <div>
      <ProjectsPreviewBar current="explorer" />
      <ProjectsIntro projects={projects} />
      <div className="mx-auto max-w-[1500px] px-6 pb-20 sm:px-10">
        <ProjectExplorer projects={projects} />
      </div>
    </div>
  );
}
