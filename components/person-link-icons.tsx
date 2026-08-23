import {
  Briefcase,
  Code2,
  GraduationCap,
  Globe,
  Landmark,
  Mail,
} from "lucide-react";

import { ExternalLink } from "@/components/external-link";
import type { Person } from "@/lib/content";
import { cn } from "@/lib/utils";

// lucide-react dropped brand/logo marks — LinkedIn/GitHub use generic stand-ins
// (Briefcase/Code2), same convention used elsewhere on the site.
const LINK_ICONS = [
  { key: "email", icon: Mail, label: "Email" },
  { key: "scholar", icon: GraduationCap, label: "Google Scholar" },
  { key: "website", icon: Globe, label: "Personal website" },
  { key: "universityProfile", icon: Landmark, label: "University profile" },
  { key: "linkedin", icon: Briefcase, label: "LinkedIn" },
] as const;

// Always renders all 6 possible link icons for every person, for visual consistency
// across cards — icons with no data for this person render as inert, greyed-out
// placeholders (no href, not a link, not in tab order) rather than being omitted.
export function PersonLinkIcons({
  person,
  size = "default",
}: {
  person: Person;
  size?: "sm" | "default";
}) {
  const links = person.links ?? {};
  const dim = size === "sm" ? "size-6" : "size-8";
  const iconDim = size === "sm" ? "size-3.5" : "size-4";

  return (
    <div className="flex flex-wrap gap-1.5">
      {LINK_ICONS.map(({ key, icon: Icon, label }) => {
        const href = key === "email" ? links.email && `mailto:${links.email}` : links[key];
        const className = cn(
          "flex items-center justify-center border transition-colors",
          dim,
          href
            ? "border-border text-muted-foreground hover:bg-foreground hover:text-background"
            : "border-hairline text-text-placeholder"
        );

        if (!href) {
          return (
            <span key={key} aria-hidden="true" className={className}>
              <Icon className={iconDim} aria-hidden="true" />
            </span>
          );
        }

        return key === "email" ? (
          <a key={key} href={href} aria-label={label} className={className}>
            <Icon className={iconDim} aria-hidden="true" />
          </a>
        ) : (
          <ExternalLink key={key} href={href} ariaLabel={label} className={className}>
            <Icon className={iconDim} aria-hidden="true" />
          </ExternalLink>
        );
      })}
    </div>
  );
}
