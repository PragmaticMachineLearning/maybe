import type {
  LayoutNode,
  LayoutEdge,
} from "../../components/flow-diagram/useLayoutNodes";
import type { VisualDependencyGraph } from "../../types/visualDependencyGraph";
import { formatVisualDependencyValue } from "./visualDependencyGraphFormatter";

interface FlowDiagramNodeData extends Record<string, unknown> {
  address: string;
  value: string;
  type: "formula" | "value";
  formula: string;
}

interface FlowDiagramElements {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
}

export const toFlowDiagramElements = (
  graph: VisualDependencyGraph,
): FlowDiagramElements => {
  const nodes: LayoutNode[] = graph.nodes.map((node) => ({
    id: node.id,
    type: node.formula ? "formula" : "value",
    position: { x: 0, y: 0 },
    data: {
      address: node.address,
      value: formatVisualDependencyValue(node.value),
      type: node.formula ? "formula" : "value",
      formula: node.formula ?? "",
    } satisfies FlowDiagramNodeData,
  }));

  const edges: LayoutEdge[] = graph.edges.map((edge) => ({
    id: `${edge.sourceId}->${edge.targetId}`,
    source: edge.sourceId,
    target: edge.targetId,
    animated: true,
  }));

  return { nodes, edges };
};
