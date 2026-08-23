import dagre from "@dagrejs/dagre";
import { entities, edges, CARD_WIDTH, estimateNodeHeight, type EntityDef, type EdgeDef } from "./schema-graph";

export type Position = { x: number; y: number };

/**
 * Real hierarchical layout, not hand-eyeballed coordinates. Ranks entities by FK
 * direction (an entity with a foreign key is placed before the entity it references),
 * so referenced "hub" entities (Person, Publication, Institution) naturally end up
 * downstream of the things that point at them. Uses each entity's ACTUAL rendered
 * dimensions (estimateNodeHeight mirrors EntityCard's real row math) so dagre can
 * guarantee no overlap, rather than guessing.
 */
export function computeHierarchicalLayout(
  entityList: EntityDef[] = entities,
  edgeList: EdgeDef[] = edges,
  direction: "LR" | "TB" = "LR",
): Record<string, Position> {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: direction,
    nodesep: 70, // gap between nodes in the same rank
    ranksep: 140, // gap between ranks (layers)
    marginx: 40,
    marginy: 40,
  });

  for (const entity of entityList) {
    g.setNode(entity.id, { width: CARD_WIDTH, height: estimateNodeHeight(entity) });
  }

  // Dedupe multi-edges between the same pair (e.g. Recognition -> Publication and
  // Recognition -> Person are distinct pairs, but a pair could repeat if an entity
  // had two FK fields to the same target) — dagre only needs one edge per pair to
  // rank correctly; the actual rendered connectors still draw every real FK field.
  const seenPairs = new Set<string>();
  for (const edge of edgeList) {
    const key = `${edge.source}->${edge.target}`;
    if (seenPairs.has(key)) continue;
    seenPairs.add(key);
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  const positions: Record<string, Position> = {};
  for (const entity of entityList) {
    const node = g.node(entity.id);
    // dagre positions are node-center-based; React Flow wants top-left.
    positions[entity.id] = { x: node.x - CARD_WIDTH / 2, y: node.y - estimateNodeHeight(entity) / 2 };
  }
  return positions;
}
