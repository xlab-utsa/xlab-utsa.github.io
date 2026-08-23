import Image from "next/image";
import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";
import { getInstitutionById, getSiteMeta } from "@/lib/content";
import { publicFileExists, withBasePath } from "@/lib/content/assets";

// Sticky, single-row-that-wraps nav. Deliberately not a hamburger/drawer — the real
// responsive/mobile pass is a separate concern from this visual pass; flex-wrap keeps
// it usable on narrow viewports with zero client JS.
export function SiteHeader() {
  const site = getSiteMeta();
  const logo = site.logo;
  const hasLogo =
    !!logo && publicFileExists(logo.light) && publicFileExists(logo.dark);
  const institution = site.primaryInstitutionId
    ? getInstitutionById(site.primaryInstitutionId)
    : undefined;

  const [, ...rest] = site.title.split("-");
  const wordmark = rest.length > 0 ? rest.join("-").toUpperCase() : site.title.toUpperCase();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/92 backdrop-blur-sm supports-[backdrop-filter]:bg-background/85">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-x-6 gap-y-3 px-6 py-3.5 sm:px-10">
        <div className="flex items-center gap-2.5">
          <Link href="/" className="flex items-center gap-2">
            {hasLogo && logo ? (
              <>
                <Image
                  src={withBasePath(logo!.light)}
                  alt=""
                  width={30}
                  height={30}
                  className="size-[30px] dark:hidden"
                  priority
                />
                <Image
                  src={withBasePath(logo!.dark)}
                  alt=""
                  width={30}
                  height={30}
                  className="hidden size-[30px] dark:block"
                  priority
                />
              </>
            ) : null}
            <span className="text-lg font-bold tracking-tight text-foreground">
              {wordmark}
            </span>
          </Link>
          {institution && (
            <div className="hidden items-center gap-2.5 md:flex">
              <span aria-hidden="true" className="h-[13px] w-px bg-border" />
              <span className="font-mono text-[10px] tracking-wider text-text-faint uppercase">
                {institution.name}
              </span>
            </div>
          )}
        </div>
        <nav
          aria-label="Primary"
          className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13.5px] text-foreground/75"
        >
          {site.nav.map((item) => (
            <Link
              key={item.label}
              href={item.path}
              className="transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
          <span aria-hidden="true" className="h-4 w-px bg-border" />
          <span className="flex items-center gap-x-5 font-mono text-[12px] tracking-wide uppercase">
            {site.socialLinks?.github ? (
              <a
                href={site.socialLinks.github}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-foreground"
              >
                GitHub
                <span className="sr-only"> (opens in new tab)</span>
              </a>
            ) : (
              <span
                aria-disabled="true"
                title="No lab-org GitHub yet"
                className="cursor-not-allowed text-text-faint/60"
              >
                GitHub
              </span>
            )}
          </span>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
