export type VisualDependencyNodeValue =
  | { kind: 'scalar'; value: number }
  | {
      kind: 'confidence_interval'
      lower: number
      upper: number
      confidenceLevel: number
      interpretation: 'normal' | 'uniform' | 'lognormal' | 'auto'
    }
  | {
      kind: 'sampled_distribution'
      mean: number
      variance: number
    }

export interface VisualDependencyNode {
  id: string
  sheet: number
  row: number
  col: number
  address: string
  formula: string | undefined
  value: VisualDependencyNodeValue
}

export interface VisualDependencyEdge {
  sourceId: string
  targetId: string
}

export interface VisualDependencyGraph {
  nodes: VisualDependencyNode[]
  edges: VisualDependencyEdge[]
}
