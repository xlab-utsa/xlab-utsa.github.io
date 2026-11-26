import { cn } from "@/lib/utils";

// The opening of the restyled section pages (News, Blog, Location & Lab Culture, Sponsors):
// a large title in the new style, an optional small mono line under it, and an intro. It
// sits at the page's own content width (`className` carries the max-width) so it lines up
// with the content below, as the old PageHeader did.
export function SectionIntro({
  title,
  meta,
  intro,
  className,
}: {
  title: string;
  /** Small mono line under the title, e.g. "4 stories". */
  meta?: React.ReactNode;
  intro?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mx-auto px-6 pt-14 pb-10 sm:px-10", className)}>
      <h1 className="text-[clamp(2.6rem,5vw,4.4rem)] leading-[1.02] font-bold tracking-tight text-foreground">{title}</h1>
      {meta && <p className="mt-3 font-mono text-[14px] text-text-faint">{meta}</p>}
      {intro && <p className="mt-4 max-w-[62ch] text-[18px] leading-relaxed text-muted-foreground">{intro}</p>}
    </header>
  );
}
