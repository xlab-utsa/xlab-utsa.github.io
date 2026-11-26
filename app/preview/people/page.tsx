import Link from "next/link";

import { getPeoplePreviewData } from "@/lib/people-directory";
import { PEOPLE_DESIGNS, PeoplePreviewBar, PersonPhoto } from "@/components/preview/people/nav";

// Index of the People-page options. Temporary, like the rest of /preview.
export default function PeoplePreviewIndex() {
  const d = getPeoplePreviewData();
  const faces = [d.pi, ...d.members, ...d.alumni];
  return (
    <div>
      <PeoplePreviewBar />
      <div className="mx-auto max-w-[1300px] px-6 py-14 sm:px-10">
        <p className="font-mono text-[13px] tracking-[0.22em] text-brand uppercase">Preview · People page</p>
        <h1 className="mt-3 text-[clamp(2.4rem,4.4vw,3.6rem)] leading-tight font-bold tracking-tight text-foreground">Two options for People</h1>
        <p className="mt-4 max-w-[64ch] text-[17px] leading-relaxed text-muted-foreground">
          Both keep the live page&apos;s layout (the director&apos;s three-column block, then the groups) and use the same data:{" "}
          {d.members.length + 1} current members and {d.alumni.length} alumni, with each person&apos;s papers and research areas from the
          author links. The live page at{" "}
          <Link href="/people" className="underline">
            /people
          </Link>{" "}
          is unchanged.
        </p>
        <ul className="mt-10 grid gap-5 sm:grid-cols-2">
          {PEOPLE_DESIGNS.map((g, i) => (
            <li key={g.slug}>
              <Link href={`/preview/people/${g.slug}`} className="group block overflow-hidden rounded-[22px] border border-border transition-colors hover:border-foreground">
                <div className="flex h-36 border-b border-border">
                  {faces.slice(i * 5, i * 5 + 5).map((f) => (
                    <PersonPhoto key={f.id} name={f.name} photo={f.photo} sizes="20vw" className="h-full flex-1" />
                  ))}
                </div>
                <div className="p-6">
                  <p className="font-mono text-[12px] tracking-[0.18em] text-brand uppercase">{g.n}</p>
                  <p className="mt-1 text-[24px] font-bold tracking-tight text-foreground group-hover:underline">{g.name}</p>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">{g.line}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
