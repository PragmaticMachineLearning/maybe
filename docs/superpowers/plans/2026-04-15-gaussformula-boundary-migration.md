# GaussFormula Boundary Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Alea consume `gaussformula` through a stable public graph API, preserve whole-graph flow-diagram behavior, and add Alea-side tests with `vitest`.

**Architecture:** Add a new `HyperFormula.getVisualDependencyGraph()` public method in `gaussformula`, backed by normalized cell-level nodes and edges. Then add an Alea adapter module and a separate formatter module so `FlowDiag` can render the new payload without touching engine internals or importing from `hyperformula/src/...`.

**Tech Stack:** TypeScript, React, Vite, React Flow, Vitest, Jest/ts-jest in `hyperformula`

---

## File Structure

### Engine files

- Modify: `hyperformula/src/HyperFormula.ts`
- Modify: `hyperformula/src/index.ts`
- Modify: `hyperformula/src/DependencyGraph/DependencyGraph.ts` only if the public method needs a helper instead of inline traversal
- Create: `hyperformula/test/visual-dependency-graph.spec.ts`

### Alea files

- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/types/visualDependencyGraph.ts`
- Create: `src/utils/visualDependencyGraphFormatter.ts`
- Create: `src/utils/visualDependencyGraphAdapter.ts`
- Create: `src/utils/visualDependencyGraphFormatter.test.ts`
- Create: `src/utils/visualDependencyGraphAdapter.test.ts`
- Modify: `src/types/gaussformula.d.ts`
- Modify: `src/components/FlowDiag.tsx`
- Modify: `src/utils/distributionUtils.ts`

### Notes

- Keep `FlowDiag` responsible only for subscription, layout, and rendering.
- Keep the engine payload raw and structured.
- Keep label formatting in Alea, not in `gaussformula`.
- Do not add fallback logic for older `gaussformula` versions.

---

### Task 1: Add `gaussformula` visual graph API with TDD

**Files:**
- Create: `hyperformula/test/visual-dependency-graph.spec.ts`
- Modify: `hyperformula/src/HyperFormula.ts`
- Modify: `hyperformula/src/index.ts`

- [ ] **Step 1: Write the failing whole-graph contract test**

```ts
import {HyperFormula} from '../src'

describe('HyperFormula.getVisualDependencyGraph', () => {
  it('returns whole-graph cell nodes and directed cell edges for numeric dependencies', () => {
    const engine = HyperFormula.buildEmpty({licenseKey: 'gpl-v3'})
    engine.addSheet('Sheet1')
    engine.setSheetContent(0, [['1', '2', '=A1+B1', '=C1*2']])

    expect((engine as any).getVisualDependencyGraph()).toEqual({
      nodes: expect.arrayContaining([
        expect.objectContaining({
          id: '0:0:0',
          sheet: 0,
          row: 0,
          col: 0,
          address: 'A1',
          formula: undefined,
          value: {kind: 'scalar', value: 1},
        }),
        expect.objectContaining({
          id: '0:0:1',
          sheet: 0,
          row: 0,
          col: 1,
          address: 'B1',
          formula: undefined,
          value: {kind: 'scalar', value: 2},
        }),
        expect.objectContaining({
          id: '0:0:2',
          sheet: 0,
          row: 0,
          col: 2,
          address: 'C1',
          formula: '=A1+B1',
          value: {kind: 'scalar', value: 3},
        }),
        expect.objectContaining({
          id: '0:0:3',
          sheet: 0,
          row: 0,
          col: 3,
          address: 'D1',
          formula: '=C1*2',
          value: {kind: 'scalar', value: 6},
        }),
      ]),
      edges: expect.arrayContaining([
        {sourceId: '0:0:0', targetId: '0:0:2'},
        {sourceId: '0:0:1', targetId: '0:0:2'},
        {sourceId: '0:0:2', targetId: '0:0:3'},
      ]),
    })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /home/chief/alea/hyperformula && npm run test:unit -- --runInBand test/visual-dependency-graph.spec.ts`

Expected: FAIL because `getVisualDependencyGraph` does not exist yet.

- [ ] **Step 3: Add the uncertainty contract test**

```ts
it('returns structured confidence interval and sampled distribution summaries', () => {
  const engine = HyperFormula.buildEmpty({licenseKey: 'gpl-v3', sampleSize: 1000})
  engine.addSheet('Sheet1')
  engine.setSheetContent(0, [['CI[10, 20]', '=A1*2']])

  const graph = (engine as any).getVisualDependencyGraph()

  expect(graph.nodes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        address: 'A1',
        value: expect.objectContaining({
          kind: 'confidence_interval',
          lower: 10,
          upper: 20,
          confidenceLevel: 95,
          interpretation: 'normal',
        }),
      }),
      expect.objectContaining({
        address: 'B1',
        value: expect.objectContaining({
          kind: 'sampled_distribution',
          mean: expect.any(Number),
          variance: expect.any(Number),
        }),
      }),
    ]),
  )
})
```

- [ ] **Step 4: Run the test file again to verify both tests fail for the right reason**

Run: `cd /home/chief/alea/hyperformula && npm run test:unit -- --runInBand test/visual-dependency-graph.spec.ts`

Expected: FAIL because the method and payload do not exist yet, not because of syntax or import errors.

- [ ] **Step 5: Implement the minimal public types and method in `HyperFormula.ts`**

```ts
export type VisualDependencyNodeValue =
  | {kind: 'scalar'; value: number}
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

public getVisualDependencyGraph(): VisualDependencyGraph {
  const graphNodes = this._dependencyGraph.graph.getNodes()
  const nodesById = new Map<string, VisualDependencyNode>()
  const edges: VisualDependencyEdge[] = []

  for (const vertex of graphNodes) {
    const sourceAddress = this.findAddressForVertex(vertex)
    if (!sourceAddress) {
      continue
    }

    const sourceNode = this.buildVisualDependencyNode(sourceAddress)
    if (!sourceNode) {
      continue
    }
    nodesById.set(sourceNode.id, sourceNode)

    for (const adjacentVertex of this._dependencyGraph.graph.adjacentNodes(vertex)) {
      const targetAddress = this.findAddressForVertex(adjacentVertex)
      if (!targetAddress) {
        continue
      }

      const targetNode = this.buildVisualDependencyNode(targetAddress)
      if (!targetNode) {
        continue
      }

      nodesById.set(targetNode.id, targetNode)
      edges.push({sourceId: sourceNode.id, targetId: targetNode.id})
    }
  }

  const uniqueEdges = edges.filter((edge, index) => {
    return edges.findIndex((candidate) => (
      candidate.sourceId === edge.sourceId && candidate.targetId === edge.targetId
    )) === index
  })

  const nodeIdsInEdges = new Set(
    uniqueEdges.flatMap((edge) => [edge.sourceId, edge.targetId]),
  )

  return {
    nodes: [...nodesById.values()].filter((node) => nodeIdsInEdges.has(node.id)),
    edges: uniqueEdges,
  }
}
```

- [ ] **Step 6: Implement focused private helpers in `HyperFormula.ts`**

```ts
private findAddressForVertex(vertex: unknown): SimpleCellAddress | undefined {
  for (const [address, candidate] of this.addressMapping.entries()) {
    if (candidate === vertex && 'col' in address && 'row' in address && 'sheet' in address) {
      return address
    }
  }
  return undefined
}

private buildVisualDependencyNode(address: SimpleCellAddress): VisualDependencyNode | undefined {
  const value = this.getCellValue(address)
  const normalizedValue = this.normalizeVisualDependencyValue(value)
  if (!normalizedValue) {
    return undefined
  }

  return {
    id: `${address.sheet}:${address.row}:${address.col}`,
    sheet: address.sheet,
    row: address.row,
    col: address.col,
    address: this.simpleCellAddressToString(address, address.sheet),
    formula: this.getCellFormula(address),
    value: normalizedValue,
  }
}

private normalizeVisualDependencyValue(value: CellValue): VisualDependencyNodeValue | undefined {
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return {kind: 'scalar', value}
  }

  if (value instanceof ConfidenceIntervalNumber) {
    return {
      kind: 'confidence_interval',
      lower: value.getLower(),
      upper: value.getUpper(),
      confidenceLevel: value.getConfidenceLevel(),
      interpretation: value.interpretation,
    }
  }

  if (value instanceof SampledDistribution) {
    return {
      kind: 'sampled_distribution',
      mean: value.getMean(),
      variance: value.getVariance(),
    }
  }

  return undefined
}
```

- [ ] **Step 7: Export the new public types from `hyperformula/src/index.ts`**

```ts
export type {
  VisualDependencyNodeValue,
  VisualDependencyNode,
  VisualDependencyEdge,
  VisualDependencyGraph,
} from './HyperFormula'
```

- [ ] **Step 8: Run the targeted test to verify it passes**

Run: `cd /home/chief/alea/hyperformula && npm run test:unit -- --runInBand test/visual-dependency-graph.spec.ts`

Expected: PASS

- [ ] **Step 9: Run the nearest related engine tests**

Run: `cd /home/chief/alea/hyperformula && npm run test:unit -- --runInBand test/graph-dependencies-queries.spec.ts test/interpreter/distribution-arithmetic.spec.ts`

Expected: PASS

- [ ] **Step 10: Commit**

```bash
git -C /home/chief/alea add \
  hyperformula/src/HyperFormula.ts \
  hyperformula/src/index.ts \
  hyperformula/test/visual-dependency-graph.spec.ts
git -C /home/chief/alea commit -m "feat: add visual dependency graph API"
```

---

### Task 2: Add Alea Vitest harness with TDD

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`

- [ ] **Step 1: Write a failing smoke test file for Vitest wiring**

```ts
import {describe, expect, it} from 'vitest'

describe('vitest setup', () => {
  it('runs Alea unit tests', () => {
    expect(true).toBe(true)
  })
})
```

Save it temporarily as `src/test/setup.test.ts`.

- [ ] **Step 2: Run the test command to verify it fails before setup**

Run: `cd /home/chief/alea && npx vitest run src/test/setup.test.ts`

Expected: FAIL because `vitest` is not installed/configured yet.

- [ ] **Step 3: Add `vitest` and root test scripts**

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "vitest": "^3.2.4"
  }
}
```

- [ ] **Step 4: Add the minimal Vite-aligned config**

```ts
import {defineConfig} from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
```

- [ ] **Step 5: Run the smoke test to verify the harness passes**

Run: `cd /home/chief/alea && npx vitest run src/test/setup.test.ts`

Expected: PASS

- [ ] **Step 6: Remove the temporary smoke test file if it is no longer needed**

```bash
rm /home/chief/alea/src/test/setup.test.ts
```

- [ ] **Step 7: Commit**

```bash
git -C /home/chief/alea add package.json vitest.config.ts
git -C /home/chief/alea commit -m "test: add vitest to alea"
```

---

### Task 3: Add Alea graph adapter and formatter with TDD

**Files:**
- Create: `src/types/visualDependencyGraph.ts`
- Create: `src/utils/visualDependencyGraphFormatter.ts`
- Create: `src/utils/visualDependencyGraphAdapter.ts`
- Create: `src/utils/visualDependencyGraphFormatter.test.ts`
- Create: `src/utils/visualDependencyGraphAdapter.test.ts`
- Modify: `src/types/gaussformula.d.ts`

- [ ] **Step 1: Define the Alea-side graph types**

```ts
export type VisualDependencyNodeValue =
  | {kind: 'scalar'; value: number}
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
  formula?: string
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
```

- [ ] **Step 2: Write the failing formatter tests**

```ts
import {describe, expect, it} from 'vitest'
import {formatVisualDependencyValue} from './visualDependencyGraphFormatter'

describe('formatVisualDependencyValue', () => {
  it('formats scalar values', () => {
    expect(formatVisualDependencyValue({kind: 'scalar', value: 42})).toBe('42')
  })

  it('formats confidence intervals', () => {
    expect(formatVisualDependencyValue({
      kind: 'confidence_interval',
      lower: 10,
      upper: 20,
      confidenceLevel: 95,
      interpretation: 'normal',
    })).toBe('CI[10.00, 20.00]')
  })

  it('formats sampled distributions from summary stats', () => {
    expect(formatVisualDependencyValue({
      kind: 'sampled_distribution',
      mean: 5,
      variance: 4,
    })).toBe('S(μ=5.00, σ²=4.00)')
  })
})
```

- [ ] **Step 3: Run the formatter tests to verify they fail**

Run: `cd /home/chief/alea && npx vitest run src/utils/visualDependencyGraphFormatter.test.ts`

Expected: FAIL because the formatter module does not exist yet.

- [ ] **Step 4: Implement the minimal formatter**

```ts
import type {VisualDependencyNodeValue} from '../types/visualDependencyGraph'

const formatNumber = (value: number): string => value.toFixed(2)

export const formatVisualDependencyValue = (
  value: VisualDependencyNodeValue,
): string => {
  switch (value.kind) {
    case 'scalar':
      return Number.isInteger(value.value) ? `${value.value}` : formatNumber(value.value)
    case 'confidence_interval':
      return `CI[${formatNumber(value.lower)}, ${formatNumber(value.upper)}]`
    case 'sampled_distribution':
      return `S(μ=${formatNumber(value.mean)}, σ²=${formatNumber(value.variance)})`
  }
}
```

- [ ] **Step 5: Run the formatter tests to verify they pass**

Run: `cd /home/chief/alea && npx vitest run src/utils/visualDependencyGraphFormatter.test.ts`

Expected: PASS

- [ ] **Step 6: Write the failing adapter test**

```ts
import {describe, expect, it} from 'vitest'
import {toFlowDiagramElements} from './visualDependencyGraphAdapter'

describe('toFlowDiagramElements', () => {
  it('maps graph payload into React Flow nodes and edges', () => {
    const graph = {
      nodes: [
        {
          id: '0:0:0',
          sheet: 0,
          row: 0,
          col: 0,
          address: 'A1',
          formula: undefined,
          value: {kind: 'scalar', value: 1},
        },
        {
          id: '0:0:2',
          sheet: 0,
          row: 0,
          col: 2,
          address: 'C1',
          formula: '=A1+1',
          value: {kind: 'scalar', value: 2},
        },
      ],
      edges: [{sourceId: '0:0:0', targetId: '0:0:2'}],
    }

    const result = toFlowDiagramElements(graph)

    expect(result.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: '0:0:0',
          data: expect.objectContaining({
            address: 'A1',
            valueLabel: '1',
            formula: '',
          }),
        }),
        expect.objectContaining({
          id: '0:0:2',
          data: expect.objectContaining({
            address: 'C1',
            valueLabel: '2',
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
```

- [ ] **Step 7: Run the adapter test to verify it fails**

Run: `cd /home/chief/alea && npx vitest run src/utils/visualDependencyGraphAdapter.test.ts`

Expected: FAIL because the adapter module does not exist yet.

- [ ] **Step 8: Implement the minimal adapter**

```ts
import {Position} from '@xyflow/react'
import type {Edge, Node} from '@xyflow/react'
import type {VisualDependencyGraph} from '../types/visualDependencyGraph'
import {formatVisualDependencyValue} from './visualDependencyGraphFormatter'

export interface FlowDiagramElements {
  nodes: Node[]
  edges: Edge[]
}

export const toFlowDiagramElements = (
  graph: VisualDependencyGraph,
): FlowDiagramElements => {
  const nodes = graph.nodes.map((node) => ({
    id: node.id,
    type: node.formula ? 'formula' : 'value',
    position: {x: 0, y: 0},
    data: {
      address: node.address,
      valueLabel: formatVisualDependencyValue(node.value),
      formula: node.formula ?? '',
    },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  }))

  const edges = graph.edges.map((edge) => ({
    id: `${edge.sourceId}->${edge.targetId}`,
    source: edge.sourceId,
    target: edge.targetId,
    animated: true,
  }))

  return {nodes, edges}
}
```

- [ ] **Step 9: Extend the Alea `gaussformula` type declaration**

```ts
import type {VisualDependencyGraph} from './visualDependencyGraph'

declare module 'gaussformula' {
  export class HyperFormula {
    getVisualDependencyGraph(): VisualDependencyGraph
  }
}
```

- [ ] **Step 10: Run both Alea unit test files to verify they pass**

Run: `cd /home/chief/alea && npx vitest run src/utils/visualDependencyGraphFormatter.test.ts src/utils/visualDependencyGraphAdapter.test.ts`

Expected: PASS

- [ ] **Step 11: Commit**

```bash
git -C /home/chief/alea add \
  src/types/visualDependencyGraph.ts \
  src/utils/visualDependencyGraphFormatter.ts \
  src/utils/visualDependencyGraphFormatter.test.ts \
  src/utils/visualDependencyGraphAdapter.ts \
  src/utils/visualDependencyGraphAdapter.test.ts \
  src/types/gaussformula.d.ts
git -C /home/chief/alea commit -m "refactor: add flow graph adapter and formatter"
```

---

### Task 4: Migrate `FlowDiag` and remove local engine-source imports with TDD

**Files:**
- Modify: `src/components/FlowDiag.tsx`
- Modify: `src/utils/distributionUtils.ts`
- Test: `src/utils/visualDependencyGraphAdapter.test.ts`

- [ ] **Step 1: Add the failing adapter assertion that encodes current whole-graph expectations**

```ts
it('keeps every edge-participating node from the visual graph payload', () => {
  const result = toFlowDiagramElements({
    nodes: [
      {
        id: '0:0:0',
        sheet: 0,
        row: 0,
        col: 0,
        address: 'A1',
        formula: undefined,
        value: {kind: 'scalar', value: 1},
      },
      {
        id: '0:0:1',
        sheet: 0,
        row: 0,
        col: 1,
        address: 'B1',
        formula: undefined,
        value: {kind: 'scalar', value: 2},
      },
    ],
    edges: [{sourceId: '0:0:0', targetId: '0:0:1'}],
  })

  expect(result.nodes).toHaveLength(2)
  expect(result.edges).toHaveLength(1)
})
```

- [ ] **Step 2: Run the adapter test to verify it still passes before the component refactor**

Run: `cd /home/chief/alea && npx vitest run src/utils/visualDependencyGraphAdapter.test.ts`

Expected: PASS

- [ ] **Step 3: Replace `FlowDiag` internal graph access with the new public API**

```ts
import {toFlowDiagramElements} from '../utils/visualDependencyGraphAdapter'

const updateGraphData = useCallback(async () => {
  if (!hfInstance) return

  const visualGraph = hfInstance.getVisualDependencyGraph()
  const flowElements = toFlowDiagramElements(visualGraph)

  if (flowElements.nodes.length === 0 || flowElements.edges.length === 0) {
    setNodes([])
    setEdges([])
    return
  }

  const layoutedNodes = await getLayoutedNodes(flowElements.nodes, flowElements.edges)
  setNodes(layoutedNodes)
  setEdges(flowElements.edges)
}, [hfInstance, setEdges, setNodes])
```

- [ ] **Step 4: Delete the old vertex-inspection helpers from `FlowDiag.tsx`**

Remove functions that depend on:

- `hfInstance.dependencyGraph.graph`
- `hfInstance.addressMapping`
- `cachedCellValue`
- `parsedValue`
- `rawValue`
- `adjacentNodes`

The file should no longer reconstruct graph semantics from engine internals.

- [ ] **Step 5: Remove the local engine-source type import from `distributionUtils.ts`**

Replace:

```ts
import type { CIInterpretation } from '../../hyperformula/src/interpreter/InterpreterValue'
```

With:

```ts
export type ConfidenceIntervalInterpretation = 'normal' | 'uniform' | 'lognormal' | 'auto'
```

And update local references in the file:

```ts
interpretation?: ConfidenceIntervalInterpretation
```

- [ ] **Step 6: Run the Alea unit tests**

Run: `cd /home/chief/alea && npx vitest run src/utils/visualDependencyGraphFormatter.test.ts src/utils/visualDependencyGraphAdapter.test.ts`

Expected: PASS

- [ ] **Step 7: Run the root build verification**

Run: `cd /home/chief/alea && npm run build`

Expected: PASS in the configured development environment. If the local machine uses Corepack/Yarn 4 for dependency resolution, rerun with the project-standard package-manager path before declaring success.

- [ ] **Step 8: Commit**

```bash
git -C /home/chief/alea add \
  src/components/FlowDiag.tsx \
  src/utils/distributionUtils.ts \
  src/utils/visualDependencyGraphAdapter.test.ts
git -C /home/chief/alea commit -m "refactor: migrate flow diagram to public graph API"
```

---

## Self-Review

### Spec coverage

- Public `getVisualDependencyGraph()` API: covered in Task 1
- Whole-graph, edge-participating behavior: covered in Tasks 1 and 4
- Structured value metadata with sampled summaries: covered in Task 1
- Alea `vitest` setup: covered in Task 2
- Extracted adapter and separate formatter: covered in Task 3
- Removal of `hyperformula/src/...` imports and raw engine internals: covered in Task 4
- No fallback to older `gaussformula`: enforced in Task 4 and by omission of compatibility code elsewhere

### Placeholder scan

- No `TODO`, `TBD`, or “implement later” placeholders remain.
- Every test and command step includes concrete code or a concrete command.

### Type consistency

- Public method name is consistently `getVisualDependencyGraph()`.
- Graph payload names are consistently `nodes`, `edges`, `sourceId`, `targetId`.
- Alea-side types mirror the engine contract intentionally.

