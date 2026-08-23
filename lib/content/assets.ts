// Build-time-only asset check. Every image path in content/ is a hand-written YAML
// string (Person.photo, Project.thumbnail, Sponsor.logo, Post.image) with no guarantee
// the file actually exists in public/ — several currently don't (all 3 project
// thumbnails, the sponsor logo). Components call this at render time (Server
// Components, evaluated during static export) to decide whether to render the real
// image or a graceful placeholder, instead of shipping a broken <img>.
import fs from "fs";
import path from "path";

export { withBasePath } from "@/lib/base-path";

const PUBLIC_ROOT = path.join(process.cwd(), "public");

export function publicFileExists(relativePath: string | undefined | null): boolean {
  if (!relativePath) return false;
  const cleaned = relativePath.replace(/^\/+/, "");
  return fs.existsSync(path.join(PUBLIC_ROOT, cleaned));
}
