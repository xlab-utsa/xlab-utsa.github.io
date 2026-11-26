import Link from "next/link";

import { Photo } from "@/components/preview/parts";
import { DESIGNS } from "@/components/preview/designs";
import { getHomeData } from "@/lib/home/data";

// The index of home-page design previews: one card per design, each with its own photo.
const COVERS = ["1a1a0056", "1a1a2622", "dsc01917", "1a1a0027", "0y1a8613", "1a1a9582", "cg1a9437-1"];

export default function PreviewIndex() {
  const { photos } = getHomeData();
  const photo = (id: string) => photos.find((p) => p.id === id) ?? photos[0];

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-14 sm:px-10">
      <p className="font-mono text-[11px] tracking-widest text-text-faint uppercase">Home page · design previews</p>
      <h1 className="font-display mt-3 text-5xl text-foreground sm:text-6xl">Seven ways to open the lab.</h1>
      <p className="mt-4 max-w-[60ch] text-[15px] leading-relaxed text-muted-foreground">
        Same content and real data in every one — only the design differs. Flip between them with the bar at the bottom of
        the screen; when you pick one, it becomes the home page.
      </p>
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {DESIGNS.map((d, i) => {
          const p = photo(COVERS[i]);
          return (
            <Link key={d.slug} href={`/preview/${d.slug}`} className="group overflow-hidden rounded-xl border border-border bg-background">
              <div className="relative aspect-[16/10] overflow-hidden bg-muted">
                <Photo src={p.src} alt="" sizes="(min-width: 1024px) 33vw, 100vw" className="transition-transform duration-500 group-hover:scale-[1.03]" />
                <span className="absolute top-3 left-3 rounded-full bg-black/70 px-2.5 py-1 font-mono text-[11px] text-white">{d.n}</span>
              </div>
              <div className="p-5">
                <h2 className="text-lg font-bold tracking-tight text-foreground group-hover:underline">{d.name}</h2>
                <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">{d.line}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
