import { Position } from '@xyflow/react'
import type { Edge, Node } from '@xyflow/react'

import type { VisualDependencyGraph } from '../types/visualDependencyGraph'
import { formatVisualDependencyValue } from './visualDependencyGraphFormatter'

export interface FlowDiagramNodeData extends Record<string, unknown> {
  address: string
  value: string
  type: 'formula' | 'value'
  formula: string
}

interface FlowDiagramElements {
  nodes: Node<FlowDiagramNodeData>[]
  edges: Edge[]
}

export const toFlowDiagramElements = (graph: VisualDependencyGraph): FlowDiagramElements => {
  const nodes: Node<FlowDiagramNodeData>[] = graph.nodes.map((node) => ({
    id: node.id,
    type: node.formula ? 'formula' : 'value',
    position: { x: 0, y: 0 },
    data: {
      address: node.address,
      value: formatVisualDependencyValue(node.value),
      type: node.formula ? 'formula' : 'value',
      formula: node.formula ?? '',
    },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  }))

  const edges: Edge[] = graph.edges.map((edge) => ({
    id: `${edge.sourceId}->${edge.targetId}`,
    source: edge.sourceId,
    target: edge.targetId,
    animated: true,
  }))

  return { nodes, edges }
}
