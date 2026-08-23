import { PublicationEntry } from "@/components/publication-entry";
import { getFeaturedPublications } from "@/lib/content";

export function FeaturedPublicationsSection() {
  const publications = getFeaturedPublications();
  if (publications.length === 0) return null;

  return (
    <section
      aria-labelledby="featured-publications-heading"
      className="border-t border-border bg-muted/30"
    >
      <div className="mx-auto max-w-[1600px] px-6 py-16">
        <h2
          id="featured-publications-heading"
          className="text-3xl font-bold tracking-tight text-foreground"
        >
          Featured Publications
        </h2>
        <ol className="mt-10">
          {publications.map((pub) => (
            <PublicationEntry key={pub.id} publication={pub} />
          ))}
        </ol>
      </div>
    </section>
  );
}
