import Link from "next/link";

import { getProjectsPreviewData } from "@/components/preview/projects/data";
import { Art, PROJECT_DESIGNS, ProjectsPreviewBar } from "@/components/preview/projects/nav";

// Index of the four Projects-page designs. Temporary, like the rest of /preview.
export default function ProjectsPreviewIndex() {
  const { projects } = getProjectsPreviewData();
  return (
    <div>
      <ProjectsPreviewBar />
      <div className="mx-auto max-w-[1300px] px-6 py-14 sm:px-10">
        <p className="font-mono text-[13px] tracking-[0.22em] text-brand uppercase">Preview · Projects page</p>
        <h1 className="mt-3 text-[clamp(2.4rem,4.4vw,3.6rem)] leading-tight font-bold tracking-tight text-foreground">Four designs for Projects</h1>
        <p className="mt-4 max-w-[64ch] text-[17px] leading-relaxed text-muted-foreground">
          Same data in all four — the {projects.length} projects, the papers behind each, the lab members on those papers and the
          links. The live page at <Link href="/projects" className="underline">/projects</Link> is unchanged.
        </p>
        <ul className="mt-10 grid gap-5 sm:grid-cols-2">
          {PROJECT_DESIGNS.map((d, i) => (
            <li key={d.slug}>
              <Link href={`/preview/projects/${d.slug}`} className="group block overflow-hidden rounded-[22px] border border-border transition-colors hover:border-foreground">
                <Art project={projects[i % projects.length]} sizes="50vw" className="aspect-[16/7] border-b border-border" />
                <div className="p-6">
                  <p className="font-mono text-[12px] tracking-[0.18em] text-brand uppercase">{d.n}</p>
                  <p className="mt-1 text-[24px] font-bold tracking-tight text-foreground group-hover:underline">{d.name}</p>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">{d.line}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
