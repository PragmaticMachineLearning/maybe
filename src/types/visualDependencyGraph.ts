export type VisualDependencyNodeValue =
  | { kind: 'scalar'; value: number }
  | {
      kind: 'distribution'
      distribution: 'normal' | 'uniform' | 'lognormal'
      source: 'parameters' | 'ci'
      mean?: number
      variance?: number
      mu?: number
      sigma?: number
      min?: number
      max?: number
      lower?: number
      upper?: number
      confidenceLevel?: number
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
