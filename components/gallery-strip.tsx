import Image from "next/image";

import { getGalleryPhotos } from "@/lib/content";
import { publicFileExists, withBasePath } from "@/lib/content/assets";

// The homepage's scrolling photo banner, directly below the hero (2026-11-23 meeting): edge to
// edge, rounded photos, the ends fading into the page. CSS-only animation (app/globals.css,
// .gallery-track): no client JS, pauses on hover, and stands still under
// prefers-reduced-motion. Renders nothing until there are photos — they are managed in Studio
// as GalleryPhoto records; a caption, when there is one, is the photo's alt text.
const SECONDS_PER_PHOTO = 6;

// A 740px copy for the strip (public/images/gallery/thumbs/<name>.jpg) when there is one,
// else the full photo. Photos added later through Studio have no copy until one is made.
function stripSrc(image: string): string {
  const thumb = image.replace(/\/gallery\/([^/]+)\.[a-z]+$/i, "/gallery/thumbs/$1.jpg");
  return thumb !== image && publicFileExists(thumb) ? thumb : image;
}

export function GalleryStrip() {
  const photos = getGalleryPhotos().filter((p) => publicFileExists(p.image));
  if (photos.length === 0) return null;

  // Twice over, so the loop has no seam; the second copy is hidden from assistive tech.
  const track = [...photos, ...photos];

  return (
    <section
      aria-label="Lab photos"
      className="gallery-strip overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]"
    >
      <ul
        className="gallery-track flex w-max gap-4"
        style={{ ["--gallery-duration" as string]: `${photos.length * SECONDS_PER_PHOTO}s` }}
      >
        {track.map((photo, i) => (
          <li key={`${photo.id}-${i}`} aria-hidden={i >= photos.length ? true : undefined} className="shrink-0">
            <figure className="relative h-[clamp(170px,24vh,250px)] w-[clamp(250px,34vh,370px)] overflow-hidden rounded-2xl bg-muted">
              {/* Eager: the strip moves by CSS transform, which never wakes the browser's lazy
                  loading, so lazy photos would slide in as empty grey tiles. */}
              <Image
                src={withBasePath(stripSrc(photo.image))}
                loading="eager"
                alt={photo.caption ?? "X-Lab group photo"}
                fill
                sizes="370px"
                className="object-cover"
              />
            </figure>
          </li>
        ))}
      </ul>
    </section>
  );
}
