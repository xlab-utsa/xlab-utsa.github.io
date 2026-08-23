import { getSiteMeta } from "@/lib/content";

// The mockup's "We are hiring" inverted CTA panel — lives inside #sponsors now (see
// sections/sponsors-section.tsx), not next to #team as in the earlier structure.
// --invert-bg/--invert-fg flip per light/dark mode so this always reads as "the loud
// panel" regardless of theme, rather than a hardcoded black box.
export function RecruitingBanner() {
  const site = getSiteMeta();
  if (!site.recruitingNotice) return null;

  return (
    <div className="flex h-full flex-col gap-3 bg-invert-bg p-6 text-invert-fg">
      <span className="font-mono text-[11.5px] font-bold tracking-widest text-invert-brand uppercase">
        We are hiring
      </span>
      <p className="text-[15px] leading-relaxed">{site.recruitingNotice}</p>
      {site.contact?.email && (
        <a
          href={`mailto:${site.contact.email}`}
          className="mt-1 w-fit border-b border-invert-brand text-sm font-semibold"
        >
          How to apply ›
        </a>
      )}
    </div>
  );
}
