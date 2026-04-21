import { type Edge, type Node } from "@xyflow/react";

// Layout constants
const NODE_WIDTH = 220;
const NODE_HEIGHT = 100;
const HORIZONTAL_GAP = 80;
const VERTICAL_GAP = 40;

/**
 * Synchronous DAG (directed acyclic graph) layout algorithm.
 *
 * 1. Builds an adjacency list from the edges.
 * 2. Performs a topological-sort–style layering: source nodes (no incoming
 *    edges) start at layer 0; every other node is placed one layer after the
 *    maximum layer of its predecessors.
 * 3. Nodes within the same layer are stacked vertically.
 * 4. Disconnected nodes (no edges at all) are placed in layer 0.
 * 5. If a cycle is detected (remaining nodes that can't be resolved),
 *    those nodes are placed in lastLayer + 1.
 */
export const getLayoutedNodes = (nodes: Node[], edges: Edge[]): Node[] => {
  if (nodes.length === 0) {
    return nodes;
  }

  // Build adjacency structures
  const incomingEdges = new Map<string, string[]>(); // nodeId -> list of source node ids
  const outgoingEdges = new Map<string, string[]>(); // nodeId -> list of target node ids
  const inDegree = new Map<string, number>();

  // Initialise maps for every node
  for (const node of nodes) {
    incomingEdges.set(node.id, []);
    outgoingEdges.set(node.id, []);
    inDegree.set(node.id, 0);
  }

  // Only consider edges whose source AND target exist in the node set
  const nodeIds = new Set(nodes.map((n) => n.id));

  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      continue;
    }
    outgoingEdges.get(edge.source)!.push(edge.target);
    incomingEdges.get(edge.target)!.push(edge.source);
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
  }

  // --- Topological layering (Kahn's algorithm variant) ---
  const layerOf = new Map<string, number>();

  // Seed: all nodes with in-degree 0
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

    for (const target of outgoingEdges.get(current) ?? []) {
      // The target's layer is at least one more than the current node's layer.
      const existingLayer = layerOf.get(target) ?? -1;
      const candidateLayer = currentLayer + 1;
      if (candidateLayer > existingLayer) {
        layerOf.set(target, candidateLayer);
        if (candidateLayer > maxLayer) {
          maxLayer = candidateLayer;
        }
      }

      // Decrease in-degree; when it reaches 0 the node is ready.
      const newDeg = (inDegree.get(target) ?? 1) - 1;
      inDegree.set(target, newDeg);
      if (newDeg === 0) {
        queue.push(target);
      }
    }
  }

  // --- Handle cycles (safety net) ---
  // Any node not yet assigned a layer is part of a cycle.
  for (const node of nodes) {
    if (!layerOf.has(node.id)) {
      layerOf.set(node.id, maxLayer + 1);
    }
  }

  // Update maxLayer after potential cycle placement
  for (const layer of layerOf.values()) {
    if (layer > maxLayer) {
      maxLayer = layer;
    }
  }

  // --- Group nodes by layer ---
  const layers = new Map<number, Node[]>();
  for (const node of nodes) {
    const layer = layerOf.get(node.id) ?? 0;
    if (!layers.has(layer)) {
      layers.set(layer, []);
    }
    layers.get(layer)!.push(node);
  }

  // --- Assign positions ---
  // Compute the maximum number of nodes in any single layer so we can
  // centre each layer's column vertically relative to the tallest one.
  let maxNodesInLayer = 0;
  for (const layerNodes of layers.values()) {
    if (layerNodes.length > maxNodesInLayer) {
      maxNodesInLayer = layerNodes.length;
    }
  }
  const totalMaxHeight =
    maxNodesInLayer * NODE_HEIGHT + (maxNodesInLayer - 1) * VERTICAL_GAP;

  const layoutedNodes: Node[] = [];

  for (const node of nodes) {
    const layer = layerOf.get(node.id)!;
    const layerNodes = layers.get(layer)!;
    const indexInLayer = layerNodes.indexOf(node);

    const x = layer * (NODE_WIDTH + HORIZONTAL_GAP);

    // Stack nodes vertically within the layer, centred around the midpoint
    const layerHeight =
      layerNodes.length * NODE_HEIGHT + (layerNodes.length - 1) * VERTICAL_GAP;
    const yOffset = (totalMaxHeight - layerHeight) / 2;
    const y = yOffset + indexInLayer * (NODE_HEIGHT + VERTICAL_GAP);

    layoutedNodes.push({
      ...node,
      position: { x, y },
    });
  }

  return layoutedNodes;
};
