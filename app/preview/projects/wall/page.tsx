import { getProjectsPreviewData } from "@/components/projects/data";
import { ProjectsIntro } from "@/components/projects/intro";
import { ProjectsPreviewBar } from "@/components/preview/projects/nav";
import { ProjectWall } from "@/components/preview/projects/wall";

// P2 · Card wall — every project as a tall card in a grid, filterable by research area. The
// layout that keeps working when there are twelve projects instead of three.
export default function WallPreview() {
  const { projects, areas } = getProjectsPreviewData();
  return (
    <div>
      <ProjectsPreviewBar current="wall" />
      <ProjectsIntro projects={projects} />
      <div className="mx-auto max-w-[1500px] px-6 pb-20 sm:px-10">
        <ProjectWall projects={projects} areas={areas} />
      </div>
    </div>
  );
}
