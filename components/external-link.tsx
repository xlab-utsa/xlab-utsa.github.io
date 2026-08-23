import * as React from "react";

import { cn } from "@/lib/utils";

type ExternalLinkProps = React.ComponentProps<"a"> & {
  ariaLabel?: string;
};

// Every outbound link on the site (team redirects, project/publication links, social
// icons, Post.sourceUrl) goes through this so target/rel/opens-in-new-tab handling
// isn't repeated — and isn't forgotten — per component.
export function ExternalLink({
  children,
  className,
  ariaLabel,
  ...props
}: ExternalLinkProps) {
  // aria-label, when set, fully replaces the accessible name (child text is ignored
  // by assistive tech), so the "opens in new tab" cue has to be folded into it instead
  // of relying on the sr-only span below.
  const label = ariaLabel ? `${ariaLabel} (opens in new tab)` : undefined;

  return (
    <a
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className={cn(className)}
      {...props}
    >
      {children}
      {!ariaLabel && <span className="sr-only"> (opens in new tab)</span>}
    </a>
  );
}
