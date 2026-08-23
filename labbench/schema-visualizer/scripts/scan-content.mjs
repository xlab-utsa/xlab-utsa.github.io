// Scans the real content/ directory (repo root, two levels up) and produces a live
// record-count snapshot the visualizer displays on each entity card. Run automatically
// before `dev`/`build` via the predev/prebuild npm scripts — always fresh, never
// hand-maintained. Missing files/dirs are treated as 0, not an error, since several
// entities are intentionally unpopulated so far (see content/README.md).

import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = join(__dirname, "..", "..", "..", "content");
const OUT_FILE = join(__dirname, "..", "src", "content-status.generated.json");

function readYaml(path) {
  if (!existsSync(path)) return null;
  try {
    return yaml.load(readFileSync(path, "utf8"));
  } catch (err) {
    console.warn(`[scan-content] failed to parse ${path}: ${err.message}`);
    return null;
  }
}

function countFilesInDir(dir, ext) {
  if (!existsSync(dir)) return 0;
  return readdirSync(dir).filter((f) => f.endsWith(ext) && statSync(join(dir, f)).isFile()).length;
}

function sumArrayLengthsInDir(dir) {
  if (!existsSync(dir)) return 0;
  return readdirSync(dir)
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
    .reduce((total, f) => {
      const doc = readYaml(join(dir, f));
      return total + (Array.isArray(doc) ? doc.length : 0);
    }, 0);
}

function arrayLengthOfFile(path) {
  const doc = readYaml(path);
  return Array.isArray(doc) ? doc.length : 0;
}

const status = {
  generatedAt: new Date().toISOString(),
  contentDirFound: existsSync(CONTENT_DIR),
  counts: {
    institution: arrayLengthOfFile(join(CONTENT_DIR, "institutions.yaml")),
    person: countFilesInDir(join(CONTENT_DIR, "people"), ".yaml"),
    "research-theme": arrayLengthOfFile(join(CONTENT_DIR, "research", "themes.yaml")),
    project: countFilesInDir(join(CONTENT_DIR, "projects"), ".yaml"),
    publication: sumArrayLengthsInDir(join(CONTENT_DIR, "publications")),
    post: countFilesInDir(join(CONTENT_DIR, "posts"), ".mdx"),
    "site-meta": existsSync(join(CONTENT_DIR, "site-meta.yaml")) ? 1 : 0,
    recognition: sumArrayLengthsInDir(join(CONTENT_DIR, "recognitions")),
    "service-record": arrayLengthOfFile(join(CONTENT_DIR, "service.yaml")),
    course: arrayLengthOfFile(join(CONTENT_DIR, "teaching.yaml")),
    sponsor: arrayLengthOfFile(join(CONTENT_DIR, "sponsors.yaml")),
  },
};

const fs = await import("node:fs");
fs.writeFileSync(OUT_FILE, JSON.stringify(status, null, 2) + "\n");
console.log(`[scan-content] wrote ${OUT_FILE}`);
console.log(status.counts);
