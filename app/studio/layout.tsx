import type { Metadata } from "next";

// Studio is a private tool that happens to be served from the public site's static export.
// It holds no secrets — the gate authorizes every request server-side — but it has no
// business in search results either.
export const metadata: Metadata = {
  title: "Studio",
  description: "Content management for X-Lab.",
  robots: { index: false, follow: false, nocache: true },
};

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-background">{children}</div>;
}
