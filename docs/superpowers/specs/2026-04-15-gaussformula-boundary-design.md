# Alea to GaussFormula Boundary Migration Design

## Summary

This change makes Alea consume `gaussformula` as a real package boundary instead of a partially vendored fork. The migration keeps the existing flow diagram feature, but replaces Alea's direct access to `gaussformula` internals with a new public engine API.

The key product constraint is to preserve the current whole-graph flow diagram behavior. Users added the flow diagram to understand how spreadsheet data flows through the model, so the feature remains in scope and must survive the boundary cleanup.

## Problem

Today Alea depends on `gaussformula` in two different ways:

- Through the public package import of `HyperFormula`
- Through direct access to local engine source and internals

This creates three concrete problems:

1. Alea imports a type from `hyperformula/src/...`, which ties the app to the local repo layout rather than the published package.
2. `FlowDiag` reads raw engine graph internals, which makes the UI fragile against internal engine refactors.
3. Alea has no dedicated test harness, so consumer-side integration changes are harder to verify with TDD.

## Goals

- Make Alea depend on the published `gaussformula` package as the only supported engine path.
- Preserve the current whole-graph flow diagram behavior.
- Replace raw engine graph access with a public `gaussformula` API.
- Remove Alea imports from `hyperformula/src/...`.
- Add Alea-side tests using `vitest`.
- Keep the change narrowly scoped to the engine boundary, graph feature, and tests.

## Non-Goals

- Redesign the flow diagram UX.
- Add speculative graph filtering options in v1.
- Export raw `gaussformula` graph internals as public API.
- Perform unrelated cleanup of Alea or `gaussformula`.

## Product Behavior

The flow diagram will keep its current behavior:

- It represents the whole dependency graph, not a selected-cell subgraph.
- It includes only cells that participate in at least one dependency edge.
- It includes deterministic numeric cells and uncertainty-related cells.
- It does not expose internal engine nodes such as range vertices, empty-cell placeholders, or parse-error nodes.

This matches the current user-facing purpose of the feature: visualizing spreadsheet data flow rather than engine implementation details.

## Public Engine API

`gaussformula` will expose a new public method on `HyperFormula`:

`getVisualDependencyGraph()`

This method returns a normalized, read-only, cell-level graph suitable for visual consumers like Alea.

### v1 method shape

The first version is intentionally narrow:

- zero-argument
- workbook-wide
- no fallback behavior
- no optional filters

If future consumers need filters such as per-sheet views or isolated-node inclusion, those can be added later without blocking this migration.

### v1 payload

The method returns:

- `nodes`: edge-participating cell nodes
- `edges`: directed cell-to-cell dependencies

Each node contains:

- `id`
- `sheet`
- `row`
- `col`
- `address`
- `formula`
- `value`

Each edge contains:

- `sourceId`
- `targetId`

### value payload

The node `value` field is raw structured metadata, not UI-formatted text.

Supported v1 forms:

- deterministic numeric scalar
- confidence interval
- sampled distribution summary

Sampled distributions expose summary statistics only, not the full sample vector. The flow diagram needs compact labels, not analysis-grade sample payloads.

Example conceptual shapes:

```ts
type VisualNodeValue =
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
```

The exact implementation may include other stable fields if needed, but the contract must stay consumer-oriented and must not leak raw engine vertex classes.

## Alea Architecture Changes

### 1. Remove local engine-source coupling

Alea will stop importing from `hyperformula/src/...`.

Any type or value that Alea still needs from the engine must be imported from the public `gaussformula` package or represented locally as an app-level contract.

### 2. Replace raw graph traversal in `FlowDiag`

`FlowDiag` will no longer read:

- `hfInstance.dependencyGraph.graph`
- vertex internals
- address mapping internals

Instead it will call `hfInstance.getVisualDependencyGraph()`.

### 3. Extract graph adapter

Alea will add a dedicated module that converts the `gaussformula` visual graph payload into React Flow nodes and edges.

This module owns:

- graph shape adaptation
- node IDs and edge IDs for the UI
- structural mapping from engine payload to render payload

It does not own label formatting.

### 4. Extract value formatter

A separate formatter module will convert raw structured node values into display strings for the flow diagram.

This keeps responsibilities clear:

- `gaussformula`: computation and normalized graph data
- adapter: graph-shape translation
- formatter: UI-facing labels
- `FlowDiag`: subscription, layout, and rendering

## Testing Strategy

The implementation follows TDD.

### Phase 1: `gaussformula`

Start with failing tests in `gaussformula` for `HyperFormula.getVisualDependencyGraph()`.

The first contract test uses a small sheet such as:

- `A1 = 1`
- `B1 = 2`
- `C1 = =A1+B1`
- `D1 = =C1*2`

Assertions:

- nodes for `A1`, `B1`, `C1`, `D1`
- edges `A1 -> C1`, `B1 -> C1`, `C1 -> D1`
- only edge-participating nodes are present
- deterministic numeric cells are included
- node values are structured metadata, not formatted labels

After the initial test, add a failing uncertainty-oriented test to lock confidence interval and sampled distribution payload shapes.

### Phase 2: Alea

Add `vitest` to Alea and create small unit tests for:

- graph adapter module
- formatter module

These tests verify:

- `gaussformula` graph payload maps correctly into React Flow structures
- labels for scalar, confidence interval, and sampled distribution nodes are rendered consistently
- Alea no longer depends on local engine source imports for these paths

The first Alea tests should avoid unnecessary DOM complexity. They should target the extracted modules directly.

## Versioning and Compatibility

There is no backward-compatibility layer for older `gaussformula` versions.

The new `gaussformula` version is the only supported path going forward. Alea will treat `getVisualDependencyGraph()` as a hard requirement and will pin to a package version that provides it.

This is intentional. Adding fallbacks would preserve the very coupling this migration is trying to remove.

## Error Handling

The new graph API should fail loudly for unexpected internal states rather than silently fabricate malformed graph data.

On the Alea side:

- if the engine method is missing, that is a versioning/configuration error
- if graph payload is malformed, the adapter should throw rather than silently render misleading data

This keeps failures visible during development and aligns with the clean-code requirement to avoid silent failure for unexpected states.

## Risks

### Public API scope creep

Risk:
The graph API could become a disguised export of internal engine structures.

Mitigation:
Keep the method narrowly named and return only cell-level normalized data.

### Alea formatting drift

Risk:
Labels in the flow diagram could diverge from other parts of the UI.

Mitigation:
Isolate formatting in a dedicated module and test the contract explicitly.

### TDD friction in Alea

Risk:
Alea currently lacks a test harness.

Mitigation:
Add `vitest` before the Alea-side migration work and keep the first tests module-level rather than DOM-heavy.

## Implementation Order

1. Add failing `gaussformula` tests for `getVisualDependencyGraph()`.
2. Implement the public engine method with the minimal v1 contract.
3. Verify all targeted `gaussformula` tests pass.
4. Add `vitest` to Alea.
5. Add failing Alea tests for the adapter and formatter modules.
6. Implement the Alea adapter and formatter.
7. Refactor `FlowDiag` to consume `getVisualDependencyGraph()`.
8. Remove local `hyperformula/src/...` coupling from Alea.
9. Run verification for both the engine and Alea consumer paths.

## Success Criteria

The migration is complete when all of the following are true:

- Alea no longer imports from `hyperformula/src/...`.
- `FlowDiag` no longer reads raw engine graph internals.
- `gaussformula` exposes `HyperFormula.getVisualDependencyGraph()`.
- Alea uses the public graph API and preserves whole-graph flow behavior.
- Alea has a working `vitest` setup with tests covering the adapter and formatter.
- The engine and app verification steps both pass in the intended development environment.
