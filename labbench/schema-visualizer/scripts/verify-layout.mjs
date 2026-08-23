// Throwaway verification script — not part of the app, just checks dagre's actual
// output numerically since there's no way to visually render a browser here.
import dagre from "@dagrejs/dagre";

// field counts per entity, mirrored from src/lib/schema-graph.ts
const fieldCounts = {
  institution: 8,
  person: 12,
  "research-theme": 6,
  project: 11,
  publication: 18,
  post: 10,
  "site-meta": 8,
  recognition: 9,
  "service-record": 8,
  course: 7,
  sponsor: 5,
};

const edgeList = [
  ["person", "institution"],
  ["project", "research-theme"],
  ["project", "publication"],
  ["post", "person"],
  ["post", "publication"],
  ["site-meta", "institution"],
  ["recognition", "person"],
  ["recognition", "publication"],
  ["service-record", "person"],
  ["course", "person"],
  ["course", "institution"],
];

const HEADER = 40,
  ROW = 28,
  WIDTH = 320;

const g = new dagre.graphlib.Graph();
g.setDefaultEdgeLabel(() => ({}));
g.setGraph({ rankdir: "LR", nodesep: 70, ranksep: 140, marginx: 40, marginy: 40 });

for (const [id, count] of Object.entries(fieldCounts)) {
  g.setNode(id, { width: WIDTH, height: HEADER + count * ROW });
}
for (const [s, t] of edgeList) g.setEdge(s, t);

dagre.layout(g);

const boxes = Object.keys(fieldCounts).map((id) => {
  const n = g.node(id);
  const w = WIDTH,
    h = HEADER + fieldCounts[id] * ROW;
  return { id, x: n.x - w / 2, y: n.y - h / 2, w, h };
});

console.log("Positions (top-left, width x height):");
for (const b of boxes) {
  console.log(
    `  ${b.id.padEnd(16)} x=${Math.round(b.x)}, y=${Math.round(b.y)}, ${b.w}x${Math.round(b.h)}`,
  );
}

function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + b.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

let overlapCount = 0;
for (let i = 0; i < boxes.length; i++) {
  for (let j = i + 1; j < boxes.length; j++) {
    if (overlaps(boxes[i], boxes[j])) {
      overlapCount++;
      console.log(`  OVERLAP: ${boxes[i].id} <-> ${boxes[j].id}`);
    }
  }
}
console.log(overlapCount === 0 ? "\nNo overlaps." : `\n${overlapCount} overlaps found.`);

const ranksSeen = [...new Set(boxes.map((b) => Math.round(b.x)))].sort((a, b) => a - b);
console.log(`\nDistinct X columns (ranks): ${ranksSeen.length} -> ${ranksSeen.join(", ")}`);
