import Link from "next/link";

// The heading block every section page starts with, so the seven pages read as one site.
export function PageHeader({
  title,
  intro,
  meta,
}: {
  title: string;
  /** One or two sentences under the title. */
  intro?: React.ReactNode;
  /** Small mono line, e.g. "405 works across 7 research areas". */
  meta?: React.ReactNode;
}) {
  return (
    <div className="border-b border-border pb-6">
      <h1 className="text-4xl font-bold tracking-tight text-foreground">{title}</h1>
      {meta && <p className="mt-2 font-mono text-[13px] text-text-faint">{meta}</p>}
      {intro && (
        <p className="mt-4 max-w-[70ch] text-[15px] leading-relaxed text-muted-foreground">
          {intro}
        </p>
      )}
    </div>
  );
}

/** "Section title ... See all ›" row used by the homepage summaries. */
export function SummaryHeading({
  id,
  title,
  href,
  linkLabel,
}: {
  id: string;
  title: string;
  href: string;
  linkLabel: string;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
      <h2
        id={id}
        className="font-mono text-[15px] font-bold tracking-widest text-foreground uppercase"
      >
        {title}
      </h2>
      <Link
        href={href}
        className="text-[13.5px] font-semibold text-foreground hover:underline"
      >
        {linkLabel} ›
      </Link>
    </div>
  );
}
