import Image from "next/image";

import { getGalleryPhotos } from "@/lib/content";
import { publicFileExists, withBasePath } from "@/lib/content/assets";

// The homepage's scrolling photo banner, directly below the stats (2026-11-23 meeting).
// CSS-only animation (app/globals.css, .gallery-track): no client JS, pauses on hover, and
// stands still under prefers-reduced-motion. Renders nothing until there are photos —
// they are managed in Studio as GalleryPhoto records.
const SECONDS_PER_PHOTO = 6;

export function GalleryStrip() {
  const photos = getGalleryPhotos().filter((p) => publicFileExists(p.image));
  if (photos.length === 0) return null;

  // Twice over, so the loop has no seam; the second copy is hidden from assistive tech.
  const track = [...photos, ...photos];

  return (
    <section aria-label="Lab photos" className="gallery-strip overflow-hidden border-b border-border bg-bg-alt py-4">
      <ul
        className="gallery-track flex w-max gap-3"
        style={{ ["--gallery-duration" as string]: `${photos.length * SECONDS_PER_PHOTO}s` }}
      >
        {track.map((photo, i) => (
          <li key={`${photo.id}-${i}`} aria-hidden={i >= photos.length ? true : undefined} className="shrink-0">
            <figure className="relative h-44 w-64 overflow-hidden border border-border bg-muted sm:h-52 sm:w-80">
              <Image
                src={withBasePath(photo.image)}
                alt={photo.caption ?? "X-Lab group photo"}
                fill
                sizes="320px"
                className="object-cover"
              />
              {photo.caption && (
                <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pt-6 pb-2 text-[12px] text-white">
                  {photo.caption}
                </figcaption>
              )}
            </figure>
          </li>
        ))}
      </ul>
    </section>
  );
}
