import type { Metadata } from "next";
import Link from "next/link";

import { withBasePath } from "@/lib/base-path";

import { PublicationsRedirect } from "./redirect";

// /publications moved to /research (SPEC.md decision #3). A static export has no server to
// answer with a 301, so this page does the job three ways: a canonical link for search
// engines, a meta refresh for browsers without JS, and a client-side replace that keeps
// any ?theme= filter from an old link.
export const metadata: Metadata = {
  title: "Publications",
  alternates: { canonical: "/research/" },
  robots: { index: false },
};

export default function PublicationsMovedPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-14 sm:px-10">
      <meta httpEquiv="refresh" content={`0; url=${withBasePath("/research/#publications")}`} />
      <PublicationsRedirect />
      <p className="text-muted-foreground">
        Publications now live on{" "}
        <Link href="/research#publications" className="font-semibold text-foreground underline">
          Research &amp; Publications
        </Link>
        .
      </p>
    </div>
  );
}
