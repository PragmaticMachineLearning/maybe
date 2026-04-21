// ── Layout types (no external dependencies) ─────────────────────────────────

export interface LayoutNode {
  id: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
  type?: string;
}

export interface LayoutEdge {
  id: string;
  source: string;
  target: string;
  animated?: boolean;
}

// Layout constants
const NODE_WIDTH = 220;
const NODE_HEIGHT = 100;
const HORIZONTAL_GAP = 80;
const VERTICAL_GAP = 40;

export { NODE_WIDTH, NODE_HEIGHT };

export const preserveExistingNodePositions = <T extends LayoutNode>(
  nextNodes: T[],
  previousNodes: LayoutNode[],
): T[] => {
  const previousPositionById = new Map(
    previousNodes.map((node) => [node.id, node.position]),
  );

  return nextNodes.map((node) => {
    const previousPosition = previousPositionById.get(node.id);
    if (!previousPosition) return node;

    return {
      ...node,
      position: { ...previousPosition },
    };
  });
};

export const shouldAutoFitAfterGraphRefresh = (
  previousNodeCount: number,
  nextNodeCount: number,
): boolean => previousNodeCount === 0 && nextNodeCount > 0;

/**
 * Synchronous DAG layout using Kahn's algorithm for topological layering.
 * Nodes are arranged left-to-right in layers, vertically centered.
 */
export const getLayoutedNodes = <T extends LayoutNode>(
  nodes: T[],
  edges: LayoutEdge[],
): T[] => {
  if (nodes.length === 0) return nodes;

  const inDegree = new Map<string, number>();
  const outgoing = new Map<string, string[]>();
  const nodeIds = new Set(nodes.map((n) => n.id));

  for (const node of nodes) {
    inDegree.set(node.id, 0);
    outgoing.set(node.id, []);
  }

  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;
    outgoing.get(edge.source)!.push(edge.target);
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
  }

  // Kahn's algorithm — assign layers
  const layerOf = new Map<string, number>();
  const queue: string[] = [];

  for (const node of nodes) {
    if ((inDegree.get(node.id) ?? 0) === 0) {
      queue.push(node.id);
      layerOf.set(node.id, 0);
    }
  }

  let maxLayer = 0;

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentLayer = layerOf.get(current)!;

    for (const target of outgoing.get(current) ?? []) {
      const candidate = currentLayer + 1;
      if (candidate > (layerOf.get(target) ?? -1)) {
        layerOf.set(target, candidate);
        if (candidate > maxLayer) maxLayer = candidate;
      }

      const newDeg = (inDegree.get(target) ?? 1) - 1;
      inDegree.set(target, newDeg);
      if (newDeg === 0) queue.push(target);
    }
  }

  // Cycle safety — unassigned nodes go to maxLayer + 1
  for (const node of nodes) {
    if (!layerOf.has(node.id)) {
      layerOf.set(node.id, maxLayer + 1);
    }
  }
  for (const l of layerOf.values()) {
    if (l > maxLayer) maxLayer = l;
  }

  // Group by layer
  const layers = new Map<number, T[]>();
  for (const node of nodes) {
    const l = layerOf.get(node.id) ?? 0;
    if (!layers.has(l)) layers.set(l, []);
    layers.get(l)!.push(node);
  }

  // Compute vertical centering
  let maxInLayer = 0;
  for (const ln of layers.values()) {
    if (ln.length > maxInLayer) maxInLayer = ln.length;
  }
  const totalMaxH = maxInLayer * NODE_HEIGHT + (maxInLayer - 1) * VERTICAL_GAP;

  // Assign positions
  return nodes.map((node) => {
    const layer = layerOf.get(node.id)!;
    const layerNodes = layers.get(layer)!;
    const idx = layerNodes.indexOf(node);
    const layerH =
      layerNodes.length * NODE_HEIGHT + (layerNodes.length - 1) * VERTICAL_GAP;
    const yOffset = (totalMaxH - layerH) / 2;

    return {
      ...node,
      position: {
        x: layer * (NODE_WIDTH + HORIZONTAL_GAP),
        y: yOffset + idx * (NODE_HEIGHT + VERTICAL_GAP),
      },
    };
  });
};
