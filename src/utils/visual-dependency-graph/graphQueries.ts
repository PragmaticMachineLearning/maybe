import type { VisualDependencyEdge } from "../../types/visualDependencyGraph";

export type GraphFocusMode = "lineage" | "impact" | "both" | "full";
export type GraphFocusScope = "direct" | "all";

export type GraphFocusState =
  | "selected"
  | "upstream"
  | "downstream"
  | "unrelated"
  | "neutral";

export interface VisualGraphIndex {
  nodeIds: Set<string>;
  incomingByNodeId: Map<string, Set<string>>;
  outgoingByNodeId: Map<string, Set<string>>;
  getAncestors: (nodeId: string) => Set<string>;
  getDescendants: (nodeId: string) => Set<string>;
}

interface VisualGraphShape {
  nodes: Array<{ id: string }>;
  edges: VisualDependencyEdge[];
}

const createEmptyAdjacency = (
  nodeIds: Set<string>,
): Map<string, Set<string>> => {
  const adjacency = new Map<string, Set<string>>();
  for (const nodeId of nodeIds) {
    adjacency.set(nodeId, new Set());
  }
  return adjacency;
};

const addEdgeToAdjacency = (
  edge: VisualDependencyEdge,
  incomingByNodeId: Map<string, Set<string>>,
  outgoingByNodeId: Map<string, Set<string>>,
): void => {
  outgoingByNodeId.get(edge.sourceId)?.add(edge.targetId);
  incomingByNodeId.get(edge.targetId)?.add(edge.sourceId);
};

const collectReachableNodeIds = (
  startNodeId: string,
  adjacency: Map<string, Set<string>>,
): Set<string> => {
  const visited = new Set<string>();
  const pending = [...(adjacency.get(startNodeId) ?? [])];

  while (pending.length > 0) {
    const nodeId = pending.pop();
    if (!nodeId || visited.has(nodeId)) {
      continue;
    }

    visited.add(nodeId);
    pending.push(...(adjacency.get(nodeId) ?? []));
  }

  return visited;
};

const getScopedRelatedNodeIds = (
  index: VisualGraphIndex,
  selectedNodeId: string,
  direction: "incoming" | "outgoing",
  scope: GraphFocusScope,
): Set<string> => {
  if (scope === "direct") {
    const adjacency =
      direction === "incoming" ? index.incomingByNodeId : index.outgoingByNodeId;
    return new Set(adjacency.get(selectedNodeId) ?? []);
  }

  return direction === "incoming"
    ? index.getAncestors(selectedNodeId)
    : index.getDescendants(selectedNodeId);
};

export const buildVisualGraphIndex = (
  graph: VisualGraphShape,
): VisualGraphIndex => {
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  const incomingByNodeId = createEmptyAdjacency(nodeIds);
  const outgoingByNodeId = createEmptyAdjacency(nodeIds);

  for (const edge of graph.edges) {
    addEdgeToAdjacency(edge, incomingByNodeId, outgoingByNodeId);
  }

  return {
    nodeIds,
    incomingByNodeId,
    outgoingByNodeId,
    getAncestors: (nodeId: string) =>
      collectReachableNodeIds(nodeId, incomingByNodeId),
    getDescendants: (nodeId: string) =>
      collectReachableNodeIds(nodeId, outgoingByNodeId),
  };
};

export const getFocusState = (
  index: VisualGraphIndex,
  nodeId: string,
  selectedNodeId: string | undefined,
  mode: GraphFocusMode,
  scope: GraphFocusScope = "all",
): GraphFocusState => {
  if (!selectedNodeId || !index.nodeIds.has(selectedNodeId)) {
    return "neutral";
  }

  if (nodeId === selectedNodeId) {
    return "selected";
  }

  if (mode === "full") {
    return "neutral";
  }

  const ancestors = getScopedRelatedNodeIds(
    index,
    selectedNodeId,
    "incoming",
    scope,
  );
  const descendants = getScopedRelatedNodeIds(
    index,
    selectedNodeId,
    "outgoing",
    scope,
  );

  if ((mode === "lineage" || mode === "both") && ancestors.has(nodeId)) {
    return "upstream";
  }

  if ((mode === "impact" || mode === "both") && descendants.has(nodeId)) {
    return "downstream";
  }

  return "unrelated";
};

export const getEdgeFocusState = (
  index: VisualGraphIndex,
  sourceNodeId: string,
  targetNodeId: string,
  selectedNodeId: string | undefined,
  mode: GraphFocusMode,
  scope: GraphFocusScope = "all",
): GraphFocusState => {
  if (!selectedNodeId || !index.nodeIds.has(selectedNodeId)) {
    return "neutral";
  }

  if (mode === "full") {
    return "neutral";
  }

  const sourceState = getFocusState(
    index,
    sourceNodeId,
    selectedNodeId,
    mode,
    scope,
  );
  const targetState = getFocusState(
    index,
    targetNodeId,
    selectedNodeId,
    mode,
    scope,
  );

  const isUpstreamEdge =
    (mode === "lineage" || mode === "both") &&
    sourceState === "upstream" &&
    (targetState === "upstream" || targetState === "selected");

  if (isUpstreamEdge) {
    return "upstream";
  }

  const isDownstreamEdge =
    (mode === "impact" || mode === "both") &&
    (sourceState === "selected" || sourceState === "downstream") &&
    targetState === "downstream";

  if (isDownstreamEdge) {
    return "downstream";
  }

  return "unrelated";
};

export const getFocusCounts = (
  index: VisualGraphIndex,
  selectedNodeId: string | undefined,
  scope: GraphFocusScope = "all",
): { upstream: number; downstream: number } => {
  if (!selectedNodeId || !index.nodeIds.has(selectedNodeId)) {
    return { upstream: 0, downstream: 0 };
  }

  return {
    upstream: getScopedRelatedNodeIds(
      index,
      selectedNodeId,
      "incoming",
      scope,
    ).size,
    downstream: getScopedRelatedNodeIds(
      index,
      selectedNodeId,
      "outgoing",
      scope,
    ).size,
  };
};

export const getDefaultFocusMode = (
  index: VisualGraphIndex,
  selectedNodeId: string | undefined,
): GraphFocusMode => {
  if (!selectedNodeId || !index.nodeIds.has(selectedNodeId)) {
    return "full";
  }

  const hasUpstream = (index.incomingByNodeId.get(selectedNodeId)?.size ?? 0) > 0;
  const hasDownstream =
    (index.outgoingByNodeId.get(selectedNodeId)?.size ?? 0) > 0;

  if (hasUpstream && hasDownstream) {
    return "both";
  }

  if (hasDownstream) {
    return "impact";
  }

  if (hasUpstream) {
    return "lineage";
  }

  return "full";
};
