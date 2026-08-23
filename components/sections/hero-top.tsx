import { BookOpen, GitBranch, Globe2, Star, Trophy, Users } from "lucide-react";
import Image from "next/image";

import { AnimatedCounter } from "@/components/animated-counter";
import { getAllRecognitions, getSiteMeta, getStats, type RecognitionCategory } from "@/lib/content";
import { publicFileExists, withBasePath } from "@/lib/content/assets";
import { cn } from "@/lib/utils";

function countRecognitions(category: RecognitionCategory): number {
  return getAllRecognitions().filter((r) => r.category === category).length;
}

// Headline + stat grid: logo/wordmark, tagline, description, and the 6-cell stat
// row. All 6 stat cells are real data — none of the mockup's invented figures
// ($10M grant, "40 faculty grown") carried over, since we have no stored field
// backing those.
export function HeroTop() {
  const site = getSiteMeta();
  const stats = getStats();

  const [, ...rest] = site.title.split("-");
  const wordmark = rest.length > 0 ? rest.join("-").toUpperCase() : site.title.toUpperCase();
  const hasLogo =
    !!site.logo && publicFileExists(site.logo.light) && publicFileExists(site.logo.dark);

  const statCells = [
    { n: stats.publicationCount, label: "Publications", icon: BookOpen },
    { n: stats.currentPeopleCount, label: "Lab members", icon: Users },
    { n: countRecognitions("best-paper-award"), label: "Best Paper Awards", icon: Trophy },
    {
      n: countRecognitions("best-paper-nomination"),
      label: "Best Paper nominations",
      icon: Star,
    },
    {
      n: countRecognitions("international-competition-award"),
      label: "International competition awards",
      icon: Globe2,
    },
    { n: stats.projectCount, label: "Open-source projects", icon: GitBranch },
  ];

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-3 px-6 py-6 sm:px-10 sm:py-6">
      <div className="flex flex-col items-center gap-6 text-center">
        <div className="flex items-center gap-3">
          {hasLogo && site.logo && (
            <>
              <Image
                src={withBasePath(site.logo!.light)}
                alt=""
                width={110}
                height={110}
                className="size-24 dark:hidden"
                priority
              />
              <Image
                src={withBasePath(site.logo!.dark)}
                alt=""
                width={110}
                height={110}
                className="hidden size-24 dark:block"
                priority
              />
            </>
          )}
          <span className="text-3xl font-bold tracking-tight text-foreground">{wordmark}</span>
        </div>
        <h1
          id="hero-heading"
          className="max-w-[26ch] text-[clamp(1rem,1.45vw,1.22rem)] leading-tight font-bold tracking-tight text-foreground"
        >
          {site.tagline}
        </h1>
      </div>

      <div className="flex w-full justify-center">
        <p className="max-w-[75ch] text-[17px] leading-relaxed text-muted-foreground text-center">
          {site.description}
        </p>
      </div>

      {/* STATS */}

      <div className="flex justify-center py-5">
        <div className="w-3/4 grid grid-cols-2 gap-x-2 gap-y-5 sm:grid-cols-3 lg:grid-cols-6 lg:gap-x-3">
          {statCells.map((cell, i) => {
            const Icon = cell.icon;
            const accent = i % 2 === 0 ? "text-brand" : "text-brand-orange";
            return (
              <div key={cell.label} className="flex flex-col items-center gap-1 text-center">
                <div className="flex items-center gap-1">
                  <Icon aria-hidden="true" strokeWidth={2} className={cn("size-6 shrink-0", accent)} />
                  <span className={cn("font-mono text-xl font-bold tracking-tight", accent)}>
                    <AnimatedCounter value={cell.n} />
                  </span>
                </div>
                <span className="text-sm leading-snug text-muted-foreground">{cell.label}</span>
              </div>
            );
          })}
        </div>
      </div>
 
    </div>
  );
}
