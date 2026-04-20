# Codebase Technical Layer Reorganization Design

## Goal

Reorganize the React app into clear technical layers so a developer can quickly tell what each file does, where new code belongs, and which files are safe to change together.

## Current Problems

The codebase is small, but responsibilities are scattered:

- `src/components/` contains unrelated UI areas: spreadsheet, charting, analysis, toolbar, theme, and flow diagram.
- `src/utils/` mixes domain math, formatting, ECharts setup, and visual graph adapters.
- `src/App.tsx` combines application composition, layout, and analysis state derivation.
- `src/SpreadsheetContext.tsx` lives at the source root even though it is application context.
- Larger files such as `DistributionPlot.tsx`, `CellRenderer.tsx`, and `App.tsx` are harder to scan because they combine UI orchestration with helper logic.

## Target Structure

Use technical layers as the organizing principle, with subfolders inside `components/` for UI areas.

```text
src/
  app/
    App.tsx
    AppLayout.tsx
    analysisState.ts
  components/
    analysis/
    charts/
    flow-diagram/
    formula-bar/
    spreadsheet/
    theme/
    toolbar/
  context/
    SpreadsheetContext.tsx
  examples/
    examples.ts
  hooks/
    useTheme.ts
  lib/
    echarts.ts
    formulaEngine.ts
  test/
    packageBoundary.test.ts
    setup.ts
  types/
    css-modules.d.ts
    echarts-for-react-core.d.ts
    gaussformula.d.ts
    visualDependencyGraph.ts
  utils/
    distribution/
    formatting/
    visual-dependency-graph/
  main.tsx
  index.css
```

## File Moves

Move files without changing behavior first:

- `src/App.tsx` -> `src/app/App.tsx`
- `src/SpreadsheetContext.tsx` -> `src/context/SpreadsheetContext.tsx`
- `src/formulaEngine.ts` -> `src/lib/formulaEngine.ts`
- `src/utils/echarts.ts` -> `src/lib/echarts.ts`
- `src/components/AnalysisPanel.tsx` -> `src/components/analysis/AnalysisPanel.tsx`
- `src/components/AnalysisPanel.module.css` -> `src/components/analysis/AnalysisPanel.module.css`
- `src/components/DistributionPlot.tsx` -> `src/components/charts/DistributionPlot.tsx`
- `src/components/DistributionPlot.module.css` -> `src/components/charts/DistributionPlot.module.css`
- `src/components/CellRenderer.tsx` -> `src/components/spreadsheet/CellRenderer.tsx`
- `src/components/CellRenderer.module.css` -> `src/components/spreadsheet/CellRenderer.module.css`
- `src/components/DistributionViewDropdown.tsx` -> `src/components/spreadsheet/DistributionViewDropdown.tsx`
- `src/components/Spreadsheet.tsx` -> `src/components/spreadsheet/Spreadsheet.tsx`
- `src/components/Spreadsheet.module.css` -> `src/components/spreadsheet/Spreadsheet.module.css`
- `src/components/FlowDiag.tsx` -> `src/components/flow-diagram/FlowDiag.tsx`
- `src/components/FlowDiag.module.css` -> `src/components/flow-diagram/FlowDiag.module.css`
- `src/components/useLayoutNodes.ts` -> `src/components/flow-diagram/useLayoutNodes.ts`
- `src/components/FormulaBar.tsx` -> `src/components/formula-bar/FormulaBar.tsx`
- `src/components/FormulaBar.module.css` -> `src/components/formula-bar/FormulaBar.module.css`
- `src/components/ThemeToggle.tsx` -> `src/components/theme/ThemeToggle.tsx`
- `src/components/ThemeToggle.module.css` -> `src/components/theme/ThemeToggle.module.css`
- `src/components/Toolbar.tsx` -> `src/components/toolbar/Toolbar.tsx`
- `src/components/Toolbar.module.css` -> `src/components/toolbar/Toolbar.module.css`
- `src/utils/distributionUtils.ts` -> `src/utils/distribution/distributionUtils.ts`
- `src/utils/distributionMath.ts` -> `src/utils/distribution/distributionMath.ts`
- `src/utils/formatUtils.ts` -> `src/utils/formatting/formatUtils.ts`
- `src/utils/visualDependencyGraphAdapter.ts` -> `src/utils/visual-dependency-graph/visualDependencyGraphAdapter.ts`
- `src/utils/visualDependencyGraphAdapter.test.ts` -> `src/utils/visual-dependency-graph/visualDependencyGraphAdapter.test.ts`
- `src/utils/visualDependencyGraphFormatter.ts` -> `src/utils/visual-dependency-graph/visualDependencyGraphFormatter.ts`
- `src/utils/visualDependencyGraphFormatter.test.ts` -> `src/utils/visual-dependency-graph/visualDependencyGraphFormatter.test.ts`

## Light Splits

After the mechanical moves compile, split only the files where the boundary is obvious.

### `src/app/analysisState.ts`

Move analysis state derivation out of the React component:

- `AnalysisState`
- `DistributionType`
- `getColumnName`
- function that derives the current analysis state from `formulaEngine`, `selectedCell`, and `getDistributionView`

`App.tsx` should remain responsible for UI state, event handlers, and composition.

### `src/app/AppLayout.tsx`

Move the layout JSX out of `App.tsx` if `App.tsx` remains hard to scan after extracting analysis state. `AppLayout.tsx` should receive already prepared props and render toolbar, formula bar, spreadsheet, analysis panel, and flow diagram overlay.

### `src/components/charts/distributionChartOptions.ts`

Move chart data and ECharts option construction out of `DistributionPlot.tsx`:

- distribution parameter calculation
- percentile and confidence interval mark calculations
- ECharts option object construction

`DistributionPlot.tsx` should keep query/settings UI state and render `ReactEChartsCore`.

### `src/components/spreadsheet/cellFormatting.tsx`

Move cell display helpers out of `CellRenderer.tsx`:

- boolean icon component
- micro sparkline component
- cell value formatting for primitive, confidence interval, and sampled distribution values

`CellRenderer.tsx` should keep editing, context menu, dropdown, and plot orchestration.

## Import Policy

Keep imports relative for now. Do not introduce path aliases in this reorg because aliases would add configuration churn to Vite, TypeScript, ESLint, Vitest, and Playwright. Once the folder structure is stable, aliases can be evaluated separately.

## Testing Strategy

Use a staged verification approach:

1. After mechanical moves, run `pnpm build`.
2. After each light split, run the most relevant targeted checks:
   - `pnpm test` for unit test import changes.
   - `pnpm build` for TypeScript and Vite import correctness.
3. At the end, run `pnpm check`.

The existing Playwright coverage must continue to pass, especially:

- editing a spreadsheet cell directly
- opening a confidence interval distribution chart

## Non-Goals

- Do not redesign UI.
- Do not change runtime behavior.
- Do not add path aliases.
- Do not rename domain concepts unless required by a file move.
- Do not refactor formulas, distribution math behavior, or ECharts rendering behavior beyond extraction.

## Success Criteria

- A developer can identify where spreadsheet UI, chart UI, analysis UI, flow diagram UI, context, library adapters, and utilities belong by looking at folders.
- `App.tsx`, `DistributionPlot.tsx`, and `CellRenderer.tsx` are smaller and easier to scan.
- Imports compile after the move.
- `pnpm check` exits successfully.
