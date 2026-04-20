import ELK from "elkjs/lib/elk.bundled.js";
import { type Edge, type Node } from "@xyflow/react";

// Type definitions for ELK
type ElkProperties = Record<string, unknown>;

interface ElkNode {
  id: string;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  properties?: ElkProperties;
  ports?: Array<{
    id: string;
    properties?: ElkProperties;
  }>;
}

interface ElkEdge {
  id: string;
  sources: string[];
  targets: string[];
}

interface ElkGraph {
  id: string;
  layoutOptions: Record<string, string>;
  children: ElkNode[];
  edges: ElkEdge[];
}

// elk layouting options can be found here:
// https://www.eclipse.org/elk/reference/algorithms/org-eclipse-elk-layered.html
const layoutOptions = {
  "elk.algorithm": "layered",
  "elk.direction": "RIGHT",
  "elk.layered.spacing.edgeNodeBetweenLayers": "80",
  "elk.spacing.nodeNode": "60",
  "elk.layered.nodePlacement.strategy": "SIMPLE",
  "elk.layered.spacing.nodeNodeBetweenLayers": "40",
};

const elk = new ELK();

// uses elkjs to give each node a layouted position
export const getLayoutedNodes = async (
  nodes: Node[],
  edges: Edge[]
): Promise<Node[]> => {
  if (nodes.length === 0) {
    return nodes;
  }

  const graph: ElkGraph = {
    id: "root",
    layoutOptions,
    children: nodes.map((n) => {
      return {
        id: n.id,
        width: n.width ?? 200, // Default width for our nodes
        height: n.height ?? 120, // Default height for our nodes
        // we are also passing the id, so we can also handle edges without a sourceHandle or targetHandle option
        ports: [
          { id: n.id, properties: { side: "EAST" } },
          { id: `${n.id}-target`, properties: { side: "WEST" } },
        ],
      };
    }),
    edges: edges.map((e) => ({
      id: e.id,
      sources: [e.source],
      targets: [e.target],
    })),
  };

  const layoutedGraph = await elk.layout(graph);

  const layoutedNodes = nodes.map((node) => {
    const layoutedNode = layoutedGraph.children?.find(
      (lgNode) => lgNode.id === node.id
    );

    return {
      ...node,
      position: {
        x: layoutedNode?.x ?? 0,
        y: layoutedNode?.y ?? 0,
      },
    };
  });

  return layoutedNodes;
};
