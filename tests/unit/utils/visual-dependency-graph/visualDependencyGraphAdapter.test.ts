import { describe, expect, it } from 'vitest'

import type { VisualDependencyGraph } from '../../../../src/types/visualDependencyGraph'
import { toFlowDiagramElements } from '../../../../src/utils/visual-dependency-graph/visualDependencyGraphAdapter'

describe('toFlowDiagramElements', () => {
  it('maps graph payload into React Flow nodes and edges', () => {
    const graph: VisualDependencyGraph = {
      nodes: [
        {
          id: '0:0:0',
          sheet: 0,
          row: 0,
          col: 0,
          address: 'A1',
          formula: undefined,
          value: { kind: 'scalar', value: 1 },
        },
        {
          id: '0:0:2',
          sheet: 0,
          row: 0,
          col: 2,
          address: 'C1',
          formula: '=A1+1',
          value: { kind: 'scalar', value: 2 },
        },
      ],
      edges: [{ sourceId: '0:0:0', targetId: '0:0:2' }],
    }

    const result = toFlowDiagramElements(graph)

    expect(result.nodes).toHaveLength(2)
    expect(result.nodes.map((node) => node.type)).toEqual(['value', 'formula'])

    expect(result.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: '0:0:0',
          type: 'value',
          data: expect.objectContaining({
            address: 'A1',
            value: '1',
            type: 'value',
            formula: '',
          }),
        }),
        expect.objectContaining({
          id: '0:0:2',
          type: 'formula',
          data: expect.objectContaining({
            address: 'C1',
            value: '2',
            type: 'formula',
            formula: '=A1+1',
          }),
        }),
      ]),
    )

    expect(result.edges).toEqual([
      {
        id: '0:0:0->0:0:2',
        source: '0:0:0',
        target: '0:0:2',
        animated: true,
      },
    ])
  })
})
