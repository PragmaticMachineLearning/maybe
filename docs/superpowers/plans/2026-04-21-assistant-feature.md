# Assistant Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first real Sage assistant: it reads the current workbook, streams OpenAI responses through a server-side `OPENAI_API_KEY`, previews proposed spreadsheet edits, and applies accepted changes.

**Architecture:** Keep the current Vite React app. Add pure assistant modules for workbook snapshots and proposal validation, a Vite middleware API route for `/api/assistant`, and a React Sage panel that uses AI SDK UI transport. Assistant proposals are embedded in assistant text as a hidden `maybe-proposal` fenced JSON block, parsed client-side, validated against the current snapshot, and rendered as the existing diff preview.

**Tech Stack:** React 19, TypeScript, Vite middleware, Vitest, Playwright, GaussFormula, Vercel AI SDK v6 (`ai`, `@ai-sdk/react`, `@ai-sdk/openai`), `zod`.

---

## Scope Check

This is one cohesive subsystem: the assistant feature. It has four internal boundaries that can be implemented independently and then wired together:

- Workbook context serialization.
- Proposal parsing and validation.
- Server-side AI streaming route.
- Sage panel UI integration and apply flow.

The plan intentionally excludes BYOK, auth, persisted chat, multi-sheet workbook support, and new GaussFormula math primitives.

## File Structure

- Create `src/assistant/address.ts`
  - Converts between zero-based coordinates and A1 addresses.
  - Validates A1 addresses against current sheet dimensions.
- Create `src/assistant/workbookSnapshot.ts`
  - Builds compact workbook snapshots from `FormulaEngine`.
  - Serializes formulas, values, uncertainty metadata, and selected cell.
- Create `src/assistant/workbookSnapshot.test.ts`
  - Tests snapshot content and truncation behavior.
- Create `src/assistant/proposals.ts`
  - Defines assistant proposal types.
  - Extracts hidden proposal JSON from assistant text.
  - Validates proposals against the current workbook snapshot.
- Create `src/assistant/proposals.test.ts`
  - Tests proposal parsing and validation.
- Create `src/assistant/messages.ts`
  - Defines shared AI SDK UI message type and request schema.
- Create `src/server/assistantRoute.ts`
  - Handles `POST /api/assistant`.
  - Validates request shape, checks `OPENAI_API_KEY`, calls OpenAI through AI SDK, and streams UI messages.
- Create `src/server/viteAssistantPlugin.ts`
  - Registers `/api/assistant` middleware for Vite dev and preview.
  - Converts Node requests/responses to Web `Request`/`Response`.
- Modify `vite.config.ts`
  - Adds the assistant middleware plugin.
- Modify `eslint.config.js`
  - Adds Node globals for `src/server/**/*.ts` and `vite.config.ts`.
- Modify `src/context/SpreadsheetContext.tsx`
  - Exposes `getWorkbookSnapshot` and `applyAssistantChanges`.
- Modify `src/app/AppLayout.tsx`
  - Passes `selectedCell` into `AICopilotPanel`.
- Replace `src/components/ai/AICopilotPanel.tsx`
  - Uses AI SDK `useChat`.
  - Sends workbook snapshot with each prompt.
  - Renders streamed assistant text and validated proposals.
  - Applies accepted changes.
- Modify `src/components/ai/AICopilotPanel.module.css`
  - Adds streaming, error, and message styles without changing the panel layout model.
- Modify `tests/e2e/spreadsheet-edit.spec.ts`
  - Replaces mock-only Sage test with a mocked AI SDK UI stream and apply-flow assertion.

---

### Task 1: Dependencies And Tooling

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `eslint.config.js`

- [ ] **Step 1: Install AI SDK dependencies**

Run:

```bash
pnpm add ai @ai-sdk/react @ai-sdk/openai zod
```

Expected: `package.json` includes the new dependencies and `pnpm-lock.yaml` is updated.

- [ ] **Step 2: Update ESLint Node globals**

Modify `eslint.config.js` so server and config files can use Node APIs while browser files keep browser globals:

```js
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-hooks/incompatible-library': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
  {
    files: ['vite.config.ts', 'src/server/**/*.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },
)
```

- [ ] **Step 3: Verify tooling config**

Run:

```bash
pnpm lint
```

Expected before later tasks: PASS, because only dependency and lint config changed.

- [ ] **Step 4: Commit dependency setup**

Run:

```bash
git add package.json pnpm-lock.yaml eslint.config.js
git commit -m "chore: add assistant ai dependencies"
```

Expected: one commit containing only dependency and ESLint config changes.

---

### Task 2: Workbook Snapshot

**Files:**
- Create: `src/assistant/address.ts`
- Create: `src/assistant/workbookSnapshot.ts`
- Create: `src/assistant/workbookSnapshot.test.ts`

- [ ] **Step 1: Write failing address and snapshot tests**

Create `src/assistant/workbookSnapshot.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { GaussFormulaEngine } from "../lib/formulaEngine";
import { cellAddressFromA1, cellAddressToA1 } from "./address";
import { buildWorkbookSnapshot } from "./workbookSnapshot";

describe("assistant workbook snapshot", () => {
  it("converts between zero-based coordinates and A1 addresses", () => {
    expect(cellAddressToA1(0, 0)).toBe("A1");
    expect(cellAddressToA1(9, 27)).toBe("AB10");
    expect(cellAddressFromA1("AB10", { width: 52, height: 20 })).toEqual({
      row: 9,
      col: 27,
    });
    expect(cellAddressFromA1("ZZ99", { width: 2, height: 2 })).toBeNull();
  });

  it("captures formulas, evaluated values, selected cell, and uncertainty metadata", () => {
    const engine = GaussFormulaEngine.buildEmpty({
      licenseKey: "gpl-v3",
      language: "enGB",
      useColumnIndex: true,
      sampleSize: 1000,
    });

    try {
      engine.addSheet("Sheet1");
      engine.setSheetContent(0, [
        ["Label", "CI[10, 20]", "=B1*2"],
        ["Plain", 42, null],
      ]);

      const snapshot = buildWorkbookSnapshot({
        formulaEngine: engine,
        selectedCell: { row: 0, col: 2 },
        maxCells: 20,
      });

      expect(snapshot.sheetName).toBe("Sheet1");
      expect(snapshot.selectedCell).toBe("C1");
      expect(snapshot.truncated).toBe(false);
      expect(snapshot.cells.map((cell) => cell.address)).toEqual([
        "A1",
        "B1",
        "C1",
        "A2",
        "B2",
      ]);
      expect(snapshot.cells.find((cell) => cell.address === "B1")).toMatchObject({
        address: "B1",
        formula: null,
        kind: "confidence_interval",
        confidenceInterval: {
          lower: 10,
          upper: 20,
          confidenceLevel: 95,
          interpretation: "normal",
        },
      });
      expect(snapshot.cells.find((cell) => cell.address === "C1")).toMatchObject({
        address: "C1",
        formula: "=B1*2",
        kind: "sampled_distribution",
      });
    } finally {
      engine.destroy();
    }
  });

  it("caps included cells and reports truncation", () => {
    const engine = GaussFormulaEngine.buildEmpty({
      licenseKey: "gpl-v3",
      language: "enGB",
    });

    try {
      engine.addSheet("Sheet1");
      engine.setSheetContent(0, [
        ["A", "B", "C"],
        ["D", "E", "F"],
      ]);

      const snapshot = buildWorkbookSnapshot({
        formulaEngine: engine,
        selectedCell: null,
        maxCells: 3,
      });

      expect(snapshot.truncated).toBe(true);
      expect(snapshot.includedCellCount).toBe(3);
      expect(snapshot.totalNonEmptyCellCount).toBe(6);
      expect(snapshot.cells).toHaveLength(3);
    } finally {
      engine.destroy();
    }
  });
});
```

- [ ] **Step 2: Run snapshot tests and verify they fail**

Run:

```bash
pnpm exec vitest run src/assistant/workbookSnapshot.test.ts
```

Expected: FAIL because `src/assistant/address.ts` and `src/assistant/workbookSnapshot.ts` do not exist.

- [ ] **Step 3: Implement address helpers**

Create `src/assistant/address.ts`:

```ts
export interface SheetDimensions {
  width: number;
  height: number;
}

export interface ZeroBasedCellAddress {
  row: number;
  col: number;
}

export const cellAddressToA1 = (row: number, col: number): string => {
  let columnName = "";
  let columnNumber = col + 1;

  while (columnNumber > 0) {
    const remainder = (columnNumber - 1) % 26;
    columnName = String.fromCharCode(65 + remainder) + columnName;
    columnNumber = Math.floor((columnNumber - 1) / 26);
  }

  return `${columnName}${row + 1}`;
};

export const cellAddressFromA1 = (
  address: string,
  dimensions: SheetDimensions,
): ZeroBasedCellAddress | null => {
  const match = address.trim().toUpperCase().match(/^([A-Z]+)([1-9]\d*)$/);
  if (!match) return null;

  const [, columnLetters, rowText] = match;
  let columnNumber = 0;

  for (const letter of columnLetters) {
    columnNumber = columnNumber * 26 + (letter.charCodeAt(0) - 64);
  }

  const row = Number(rowText) - 1;
  const col = columnNumber - 1;

  if (row < 0 || col < 0 || row >= dimensions.height || col >= dimensions.width) {
    return null;
  }

  return { row, col };
};
```

- [ ] **Step 4: Implement workbook snapshot builder**

Create `src/assistant/workbookSnapshot.ts`:

```ts
import type { FormulaEngine } from "../lib/formulaEngine";
import {
  getSamplesFromDistribution,
  isConfidenceIntervalValue,
  isSampledDistributionValue,
  parseConfidenceIntervalValue,
  parseSampledDistributionValue,
} from "../utils/distribution/distributionUtils";
import { percentileFromSorted } from "../utils/distribution/distributionMath";
import { cellAddressToA1 } from "./address";

export type WorkbookCellKind =
  | "scalar"
  | "text"
  | "boolean"
  | "confidence_interval"
  | "sampled_distribution"
  | "error"
  | "unknown_object";

export interface SelectedCell {
  row: number;
  col: number;
}

export interface AssistantConfidenceIntervalSummary {
  lower: number;
  upper: number;
  confidenceLevel: number;
  interpretation: string;
}

export interface AssistantSampleSummary {
  sampleCount: number;
  mean: number;
  standardDeviation: number;
  p10: number;
  p50: number;
  p90: number;
}

export interface WorkbookCellSnapshot {
  address: string;
  row: number;
  col: number;
  formula: string | null;
  displayValue: string;
  kind: WorkbookCellKind;
  confidenceInterval?: AssistantConfidenceIntervalSummary;
  sampleSummary?: AssistantSampleSummary;
}

export interface WorkbookSnapshot {
  sheetName: "Sheet1";
  dimensions: {
    width: number;
    height: number;
  };
  selectedCell: string | null;
  cells: WorkbookCellSnapshot[];
  includedCellCount: number;
  totalNonEmptyCellCount: number;
  truncated: boolean;
}

interface BuildWorkbookSnapshotInput {
  formulaEngine: FormulaEngine;
  selectedCell: SelectedCell | null;
  maxCells?: number;
}

const DEFAULT_MAX_CELLS = 200;

const isBlankCell = (value: unknown, formula: string | null): boolean =>
  formula == null &&
  (value === null || value === undefined || value === "");

const round = (value: number): number => Number(value.toFixed(6));

const summarizeSamples = (value: unknown): AssistantSampleSummary | undefined => {
  const parsed = parseSampledDistributionValue(value);
  const samples = parsed?.samples ?? getSamplesFromDistribution(value);
  if (!samples || samples.length === 0) return undefined;

  const sorted = [...samples].sort((a, b) => a - b);
  const mean = samples.reduce((sum, sample) => sum + sample, 0) / samples.length;
  const variance =
    samples.reduce((sum, sample) => sum + Math.pow(sample - mean, 2), 0) /
    samples.length;

  return {
    sampleCount: samples.length,
    mean: round(mean),
    standardDeviation: round(Math.sqrt(variance)),
    p10: round(percentileFromSorted(sorted, 10)),
    p50: round(percentileFromSorted(sorted, 50)),
    p90: round(percentileFromSorted(sorted, 90)),
  };
};

const getCellKind = (value: unknown): WorkbookCellKind => {
  if (isConfidenceIntervalValue(value)) return "confidence_interval";
  if (isSampledDistributionValue(value) || summarizeSamples(value)) {
    return "sampled_distribution";
  }
  if (typeof value === "number") return "scalar";
  if (typeof value === "string") return "text";
  if (typeof value === "boolean") return "boolean";
  if (value && typeof value === "object") {
    if ("type" in value && "message" in value) return "error";
    return "unknown_object";
  }
  return "text";
};

const serializeCellValue = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);

  const confidenceInterval = parseConfidenceIntervalValue(value);
  if (confidenceInterval) {
    return `CI[${confidenceInterval.lower}, ${confidenceInterval.upper}]`;
  }

  const sampleSummary = summarizeSamples(value);
  if (sampleSummary) {
    return `samples(mean=${sampleSummary.mean}, p10=${sampleSummary.p10}, p90=${sampleSummary.p90})`;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

export const buildWorkbookSnapshot = ({
  formulaEngine,
  selectedCell,
  maxCells = DEFAULT_MAX_CELLS,
}: BuildWorkbookSnapshotInput): WorkbookSnapshot => {
  const dimensions = formulaEngine.getSheetDimensions(0);
  const cells: WorkbookCellSnapshot[] = [];
  let totalNonEmptyCellCount = 0;

  for (let row = 0; row < dimensions.height; row += 1) {
    for (let col = 0; col < dimensions.width; col += 1) {
      const address = { sheet: 0, row, col };
      const formula = formulaEngine.getCellFormula(address);
      const value = formulaEngine.getCellValue(address);

      if (isBlankCell(value, formula)) continue;

      totalNonEmptyCellCount += 1;
      if (cells.length >= maxCells) continue;

      const confidenceInterval = parseConfidenceIntervalValue(value);
      const sampleSummary = summarizeSamples(value);

      cells.push({
        address: cellAddressToA1(row, col),
        row,
        col,
        formula,
        displayValue: serializeCellValue(value),
        kind: getCellKind(value),
        confidenceInterval: confidenceInterval
          ? {
              lower: confidenceInterval.lower,
              upper: confidenceInterval.upper,
              confidenceLevel: confidenceInterval.confidenceLevel,
              interpretation: confidenceInterval.interpretation ?? "normal",
            }
          : undefined,
        sampleSummary,
      });
    }
  }

  return {
    sheetName: "Sheet1",
    dimensions,
    selectedCell: selectedCell
      ? cellAddressToA1(selectedCell.row, selectedCell.col)
      : null,
    cells,
    includedCellCount: cells.length,
    totalNonEmptyCellCount,
    truncated: totalNonEmptyCellCount > cells.length,
  };
};
```

- [ ] **Step 5: Run snapshot tests and verify they pass**

Run:

```bash
pnpm exec vitest run src/assistant/workbookSnapshot.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit workbook snapshot module**

Run:

```bash
git add src/assistant/address.ts src/assistant/workbookSnapshot.ts src/assistant/workbookSnapshot.test.ts
git commit -m "feat: add assistant workbook snapshots"
```

Expected: one commit containing the snapshot implementation and tests.

---

### Task 3: Proposal Parsing And Validation

**Files:**
- Create: `src/assistant/proposals.ts`
- Create: `src/assistant/proposals.test.ts`

- [ ] **Step 1: Write failing proposal tests**

Create `src/assistant/proposals.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import type { WorkbookSnapshot } from "./workbookSnapshot";
import {
  extractAssistantProposalFromText,
  stripAssistantProposalFromText,
  validateAssistantProposal,
} from "./proposals";

const snapshot: WorkbookSnapshot = {
  sheetName: "Sheet1",
  dimensions: { width: 5, height: 5 },
  selectedCell: "C1",
  includedCellCount: 2,
  totalNonEmptyCellCount: 2,
  truncated: false,
  cells: [
    {
      address: "A1",
      row: 0,
      col: 0,
      formula: null,
      displayValue: "CI[10, 20]",
      kind: "confidence_interval",
    },
    {
      address: "B1",
      row: 0,
      col: 1,
      formula: "=A1*2",
      displayValue: "samples(mean=30, p10=24, p90=36)",
      kind: "sampled_distribution",
    },
  ],
};

describe("assistant proposals", () => {
  it("extracts and strips a hidden maybe proposal block", () => {
    const text = [
      "I suggest adding percentile review cells.",
      "```maybe-proposal",
      JSON.stringify({
        title: "Add percentile outputs",
        summary: "Adds low and high review points.",
        changes: [
          {
            cell: "C1",
            before: "",
            after: "=PERCENTILE(B1, 10)",
            reason: "Adds a lower-tail review value.",
            kind: "add",
          },
        ],
      }),
      "```",
    ].join("\n");

    expect(extractAssistantProposalFromText(text)?.title).toBe(
      "Add percentile outputs",
    );
    expect(stripAssistantProposalFromText(text)).toBe(
      "I suggest adding percentile review cells.",
    );
  });

  it("validates add, update, and review changes", () => {
    const result = validateAssistantProposal(
      {
        title: "Review model",
        summary: "Updates the multiplier and flags an output.",
        changes: [
          {
            cell: "C1",
            before: "",
            after: "=PERCENTILE(B1, 90)",
            reason: "Adds an upper-tail output.",
            kind: "add",
          },
          {
            cell: "B1",
            before: "=A1*2",
            after: "=A1*3",
            reason: "Uses the requested multiplier.",
            kind: "update",
          },
          {
            cell: "A1",
            before: "stale value is ignored for review",
            after: "",
            reason: "Input uncertainty drives the output.",
            kind: "review",
          },
        ],
      },
      snapshot,
    );

    expect(result.valid).toBe(true);
    expect(result.applyableChanges.map((change) => change.cell)).toEqual([
      "C1",
      "B1",
    ]);
  });

  it("rejects stale before values, out-of-bounds cells, and empty reasons", () => {
    const result = validateAssistantProposal(
      {
        title: "Bad proposal",
        summary: "Contains invalid changes.",
        changes: [
          {
            cell: "B1",
            before: "=A1*999",
            after: "=A1*3",
            reason: "Stale update.",
            kind: "update",
          },
          {
            cell: "Z99",
            before: "",
            after: "123",
            reason: "Outside the sheet.",
            kind: "add",
          },
          {
            cell: "C1",
            before: "",
            after: "123",
            reason: "",
            kind: "add",
          },
        ],
      },
      snapshot,
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([
      "B1 has changed since Sage prepared this proposal.",
      "Z99 is outside the current sheet.",
      "C1 needs a reason before it can be applied.",
    ]);
  });
});
```

- [ ] **Step 2: Run proposal tests and verify they fail**

Run:

```bash
pnpm exec vitest run src/assistant/proposals.test.ts
```

Expected: FAIL because `src/assistant/proposals.ts` does not exist.

- [ ] **Step 3: Implement proposal parsing and validation**

Create `src/assistant/proposals.ts`:

```ts
import { z } from "zod";

import { cellAddressFromA1 } from "./address";
import type { WorkbookSnapshot } from "./workbookSnapshot";

export const assistantChangeKindSchema = z.enum(["add", "update", "review"]);

export const assistantCellChangeSchema = z.object({
  cell: z.string().min(1),
  before: z.string(),
  after: z.string(),
  reason: z.string(),
  kind: assistantChangeKindSchema,
});

export const assistantProposalSchema = z.object({
  title: z.string().min(1),
  summary: z.string(),
  changes: z.array(assistantCellChangeSchema).min(1),
});

export type AssistantCellChange = z.infer<typeof assistantCellChangeSchema>;
export type AssistantProposal = z.infer<typeof assistantProposalSchema>;

export interface ProposalValidationResult {
  valid: boolean;
  proposal: AssistantProposal | null;
  applyableChanges: AssistantCellChange[];
  errors: string[];
}

const proposalBlockPattern = /```maybe-proposal\s*([\s\S]*?)```/m;

export const extractAssistantProposalFromText = (
  text: string,
): AssistantProposal | null => {
  const match = text.match(proposalBlockPattern);
  if (!match) return null;

  try {
    const parsedJson = JSON.parse(match[1]);
    const parsedProposal = assistantProposalSchema.safeParse(parsedJson);
    return parsedProposal.success ? parsedProposal.data : null;
  } catch {
    return null;
  }
};

export const stripAssistantProposalFromText = (text: string): string =>
  text.replace(proposalBlockPattern, "").trim();

const currentCellText = (
  cellAddress: string,
  snapshot: WorkbookSnapshot,
): string => {
  const cell = snapshot.cells.find((candidate) => candidate.address === cellAddress);
  if (!cell) return "";
  return cell.formula ?? cell.displayValue;
};

export const validateAssistantProposal = (
  proposal: AssistantProposal | null,
  snapshot: WorkbookSnapshot,
): ProposalValidationResult => {
  if (!proposal) {
    return {
      valid: false,
      proposal: null,
      applyableChanges: [],
      errors: ["Sage did not return a valid proposal."],
    };
  }

  const errors: string[] = [];
  const applyableChanges: AssistantCellChange[] = [];

  for (const change of proposal.changes) {
    const normalizedCell = change.cell.trim().toUpperCase();
    const address = cellAddressFromA1(normalizedCell, snapshot.dimensions);

    if (!address) {
      errors.push(`${change.cell} is outside the current sheet.`);
      continue;
    }

    if (!change.reason.trim()) {
      errors.push(`${normalizedCell} needs a reason before it can be applied.`);
      continue;
    }

    if (change.kind !== "review") {
      const currentBefore = currentCellText(normalizedCell, snapshot);
      if (change.before !== currentBefore) {
        errors.push(
          `${normalizedCell} has changed since Sage prepared this proposal.`,
        );
        continue;
      }
      applyableChanges.push({ ...change, cell: normalizedCell });
    }
  }

  return {
    valid: errors.length === 0,
    proposal: {
      ...proposal,
      changes: proposal.changes.map((change) => ({
        ...change,
        cell: change.cell.trim().toUpperCase(),
      })),
    },
    applyableChanges,
    errors,
  };
};
```

- [ ] **Step 4: Run proposal tests and verify they pass**

Run:

```bash
pnpm exec vitest run src/assistant/proposals.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit proposal module**

Run:

```bash
git add src/assistant/proposals.ts src/assistant/proposals.test.ts
git commit -m "feat: add assistant proposal validation"
```

Expected: one commit containing proposal parsing and validation.

---

### Task 4: Assistant Server Route And Vite Middleware

**Files:**
- Create: `src/assistant/messages.ts`
- Create: `src/server/assistantRoute.ts`
- Create: `src/server/viteAssistantPlugin.ts`
- Modify: `vite.config.ts`

- [ ] **Step 1: Write failing server route tests**

Create `src/server/assistantRoute.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { createAssistantHandler } from "./assistantRoute";

describe("assistant route", () => {
  it("returns a setup error when OPENAI_API_KEY is missing", async () => {
    const handler = createAssistantHandler({
      getApiKey: () => undefined,
    });

    const response = await handler(
      new Request("http://localhost/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: [],
          workbookSnapshot: {
            sheetName: "Sheet1",
            dimensions: { width: 1, height: 1 },
            selectedCell: null,
            cells: [],
            includedCellCount: 0,
            totalNonEmptyCellCount: 0,
            truncated: false,
          },
        }),
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "OPENAI_API_KEY is not configured for the assistant server.",
    });
  });

  it("returns a validation error for malformed requests", async () => {
    const handler = createAssistantHandler({
      getApiKey: () => "sk-test",
    });

    const response = await handler(
      new Request("http://localhost/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: "not an array" }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid assistant request.",
    });
  });
});
```

- [ ] **Step 2: Run server route tests and verify they fail**

Run:

```bash
pnpm exec vitest run src/server/assistantRoute.test.ts
```

Expected: FAIL because `src/server/assistantRoute.ts` does not exist.

- [ ] **Step 3: Add shared message/request types**

Create `src/assistant/messages.ts`:

```ts
import type { UIMessage } from "ai";
import { z } from "zod";

import type { WorkbookSnapshot } from "./workbookSnapshot";

export type MaybeAssistantMessage = UIMessage;

export const assistantRequestSchema = z.object({
  messages: z.array(z.unknown()),
  workbookSnapshot: z.object({
    sheetName: z.literal("Sheet1"),
    dimensions: z.object({
      width: z.number(),
      height: z.number(),
    }),
    selectedCell: z.string().nullable(),
    cells: z.array(z.record(z.string(), z.unknown())),
    includedCellCount: z.number(),
    totalNonEmptyCellCount: z.number(),
    truncated: z.boolean(),
  }),
});

export interface AssistantRequestBody {
  messages: MaybeAssistantMessage[];
  workbookSnapshot: WorkbookSnapshot;
}
```

- [ ] **Step 4: Implement assistant route**

Create `src/server/assistantRoute.ts`:

```ts
import { openai } from "@ai-sdk/openai";
import {
  convertToModelMessages,
  streamText,
  type StreamTextResult,
} from "ai";
import process from "node:process";

import {
  assistantRequestSchema,
  type AssistantRequestBody,
  type MaybeAssistantMessage,
} from "../assistant/messages";
import type { WorkbookSnapshot } from "../assistant/workbookSnapshot";

type StreamText = typeof streamText;

interface CreateAssistantHandlerOptions {
  getApiKey?: () => string | undefined;
  streamTextFn?: StreamText;
}

const createSystemPrompt = (snapshot: WorkbookSnapshot): string => {
  const context = JSON.stringify(snapshot, null, 2);

  return [
    "You are Sage, the assistant inside Maybe, a GaussFormula-backed spreadsheet for uncertain calculations.",
    "The user can enter confidence intervals such as CI[10, 20].",
    "Normal spreadsheet formulas can reference uncertain cells and should preserve uncertainty where possible.",
    "When proposing spreadsheet edits, include a concise explanation and exactly one hidden fenced JSON block marked maybe-proposal.",
    "The maybe-proposal block must match this shape: {\"title\": string, \"summary\": string, \"changes\": [{\"cell\": string, \"before\": string, \"after\": string, \"reason\": string, \"kind\": \"add\" | \"update\" | \"review\"}]}",
    "Use the exact current formula or display value for each before field. Use an empty string for empty cells.",
    "Do not claim a proposal was applied. The user must click Apply in the UI.",
    "If the workbook context is truncated, say what you can infer and ask for more context when needed.",
    "Current workbook snapshot:",
    context,
  ].join("\n\n");
};

const jsonError = (message: string, status: number): Response =>
  Response.json({ error: message }, { status });

export const createAssistantHandler = ({
  getApiKey = () => process.env.OPENAI_API_KEY,
  streamTextFn = streamText,
}: CreateAssistantHandlerOptions = {}) => {
  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST") {
      return jsonError("Assistant endpoint only supports POST.", 405);
    }

    const body = await request.json().catch(() => null);
    const parsed = assistantRequestSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError("Invalid assistant request.", 400);
    }

    const apiKey = getApiKey();
    if (!apiKey) {
      return jsonError(
        "OPENAI_API_KEY is not configured for the assistant server.",
        500,
      );
    }

    const { messages, workbookSnapshot } = parsed.data as AssistantRequestBody;

    const result = streamTextFn({
      model: openai(process.env.OPENAI_MODEL ?? "gpt-4o-mini"),
      system: createSystemPrompt(workbookSnapshot),
      messages: await convertToModelMessages(
        messages as MaybeAssistantMessage[],
      ),
    }) as StreamTextResult<Record<string, never>, never>;

    return result.toUIMessageStreamResponse({
      getErrorMessage: (error) =>
        error instanceof Error ? error.message : "Assistant request failed.",
    });
  };
};

export const handleAssistantRequest = createAssistantHandler();
```

- [ ] **Step 5: Run server route tests and verify they pass**

Run:

```bash
pnpm exec vitest run src/server/assistantRoute.test.ts
```

Expected: PASS.

- [ ] **Step 6: Implement Vite assistant middleware**

Create `src/server/viteAssistantPlugin.ts`:

```ts
import type { IncomingMessage, ServerResponse } from "node:http";
import { Buffer } from "node:buffer";
import { Readable } from "node:stream";
import type { Plugin, PreviewServer, ViteDevServer } from "vite";

import { handleAssistantRequest } from "./assistantRoute";

const requestOrigin = (request: IncomingMessage): string => {
  const host = request.headers.host ?? "localhost";
  const protocol = request.socket.encrypted ? "https" : "http";
  return `${protocol}://${host}`;
};

const nodeRequestToWebRequest = (request: IncomingMessage): Request => {
  const url = new URL(request.url ?? "/api/assistant", requestOrigin(request));
  const method = request.method ?? "GET";
  const hasBody = method !== "GET" && method !== "HEAD";

  return new Request(url, {
    method,
    headers: request.headers as HeadersInit,
    body: hasBody ? (Readable.toWeb(request) as ReadableStream) : undefined,
    duplex: hasBody ? "half" : undefined,
  } as RequestInit & { duplex?: "half" });
};

const writeWebResponseToNode = async (
  webResponse: Response,
  nodeResponse: ServerResponse,
): Promise<void> => {
  nodeResponse.statusCode = webResponse.status;
  webResponse.headers.forEach((value, key) => {
    nodeResponse.setHeader(key, value);
  });

  if (!webResponse.body) {
    nodeResponse.end();
    return;
  }

  for await (const chunk of webResponse.body) {
    nodeResponse.write(Buffer.from(chunk));
  }

  nodeResponse.end();
};

const attachAssistantMiddleware = (server: ViteDevServer | PreviewServer) => {
  server.middlewares.use("/api/assistant", async (request, response) => {
    try {
      const webRequest = nodeRequestToWebRequest(request);
      const webResponse = await handleAssistantRequest(webRequest);
      await writeWebResponseToNode(webResponse, response);
    } catch (error) {
      response.statusCode = 500;
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({
          error:
            error instanceof Error
              ? error.message
              : "Assistant middleware failed.",
        }),
      );
    }
  });
};

export const assistantApiPlugin = (): Plugin => ({
  name: "maybe-assistant-api",
  configureServer(server) {
    attachAssistantMiddleware(server);
  },
  configurePreviewServer(server) {
    attachAssistantMiddleware(server);
  },
});
```

- [ ] **Step 7: Register middleware in Vite**

Modify `vite.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import { assistantApiPlugin } from "./src/server/viteAssistantPlugin";

export default defineConfig({
  plugins: [assistantApiPlugin(), react()],
  build: {
    sourcemap: true,
  },
});
```

- [ ] **Step 8: Verify route and config**

Run:

```bash
pnpm exec vitest run src/server/assistantRoute.test.ts
pnpm build
```

Expected: tests PASS and build PASS.

- [ ] **Step 9: Commit server route**

Run:

```bash
git add src/assistant/messages.ts src/server/assistantRoute.ts src/server/assistantRoute.test.ts src/server/viteAssistantPlugin.ts vite.config.ts
git commit -m "feat: add assistant api route"
```

Expected: one commit containing the server route, middleware, and tests.

---

### Task 5: Spreadsheet Context Assistant Actions

**Files:**
- Modify: `src/context/SpreadsheetContext.tsx`
- Modify: `src/app/AppLayout.tsx`
- Modify: `src/components/ai/AICopilotPanel.tsx`

- [ ] **Step 1: Write failing context-facing tests in proposal module**

Extend `src/assistant/proposals.test.ts` with an apply helper expectation:

```ts
import { applyAssistantChangesToEngine } from "./proposals";
import { GaussFormulaEngine } from "../lib/formulaEngine";

it("applies only add and update changes to the formula engine", () => {
  const engine = GaussFormulaEngine.buildEmpty({
    licenseKey: "gpl-v3",
    language: "enGB",
  });

  try {
    engine.addSheet("Sheet1");
    engine.setSheetContent(0, [["CI[10, 20]", "=A1*2", null]]);

    applyAssistantChangesToEngine(engine, snapshot.dimensions, [
      {
        cell: "B1",
        before: "=A1*2",
        after: "=A1*3",
        reason: "Update multiplier.",
        kind: "update",
      },
      {
        cell: "C1",
        before: "",
        after: "=B1+1",
        reason: "Add output.",
        kind: "add",
      },
      {
        cell: "A1",
        before: "CI[10, 20]",
        after: "",
        reason: "Review only.",
        kind: "review",
      },
    ]);

    expect(engine.getCellFormula({ sheet: 0, row: 0, col: 1 })).toBe("=A1*3");
    expect(engine.getCellFormula({ sheet: 0, row: 0, col: 2 })).toBe("=B1+1");
    expect(engine.getCellFormula({ sheet: 0, row: 0, col: 0 })).toBeNull();
  } finally {
    engine.destroy();
  }
});
```

- [ ] **Step 2: Run proposal tests and verify they fail**

Run:

```bash
pnpm exec vitest run src/assistant/proposals.test.ts
```

Expected: FAIL because `applyAssistantChangesToEngine` is not exported.

- [ ] **Step 3: Add engine apply helper**

Append to `src/assistant/proposals.ts`:

```ts
import type { FormulaEngine } from "../lib/formulaEngine";

export const applyAssistantChangesToEngine = (
  formulaEngine: FormulaEngine,
  dimensions: WorkbookSnapshot["dimensions"],
  changes: AssistantCellChange[],
): void => {
  for (const change of changes) {
    if (change.kind === "review") continue;

    const address = cellAddressFromA1(change.cell, dimensions);
    if (!address) {
      throw new Error(`${change.cell} is outside the current sheet.`);
    }

    formulaEngine.setCellContents(
      { sheet: 0, row: address.row, col: address.col },
      change.after,
    );
  }
};
```

If this import placement violates local lint ordering, move the `FormulaEngine` import to the top of the file with the other imports.

- [ ] **Step 4: Run proposal tests and verify they pass**

Run:

```bash
pnpm exec vitest run src/assistant/proposals.test.ts
```

Expected: PASS.

- [ ] **Step 5: Expose snapshot and apply actions from spreadsheet context**

Modify `src/context/SpreadsheetContext.tsx`:

```ts
import {
  applyAssistantChangesToEngine,
  type AssistantCellChange,
} from "../assistant/proposals";
import {
  buildWorkbookSnapshot,
  type SelectedCell,
  type WorkbookSnapshot,
} from "../assistant/workbookSnapshot";
```

Extend `SpreadsheetContextValue`:

```ts
  getWorkbookSnapshot: (selectedCell: SelectedCell | null) => WorkbookSnapshot | null;
  applyAssistantChanges: (changes: AssistantCellChange[]) => void;
```

Add defaults:

```ts
  getWorkbookSnapshot: () => null,
  applyAssistantChanges: () => {},
```

Add callbacks in `SpreadsheetProvider`:

```ts
  const getWorkbookSnapshot = useCallback(
    (selectedCell: SelectedCell | null) => {
      if (!formulaEngine) return null;
      return buildWorkbookSnapshot({ formulaEngine, selectedCell });
    },
    [formulaEngine],
  );

  const applyAssistantChanges = useCallback(
    (changes: AssistantCellChange[]) => {
      if (!formulaEngine) return;
      const dimensions = formulaEngine.getSheetDimensions(0);
      applyAssistantChangesToEngine(formulaEngine, dimensions, changes);
    },
    [formulaEngine],
  );
```

Include both functions in the provider value.

- [ ] **Step 6: Pass selected cell into Sage panel**

Modify `src/app/AppLayout.tsx` where `AICopilotPanel` is rendered:

```tsx
              <AICopilotPanel
                onClose={onCloseAiPanel}
                compact={isCompactLayout}
                selectedCell={selectedCell}
              />
```

Temporarily update `src/components/ai/AICopilotPanel.tsx` props so TypeScript passes until the full panel rewrite:

```ts
interface AICopilotPanelProps {
  onClose: () => void;
  compact?: boolean;
  selectedCell?: { row: number; col: number } | null;
}
```

- [ ] **Step 7: Verify context changes**

Run:

```bash
pnpm exec vitest run src/assistant/proposals.test.ts
pnpm build
```

Expected: tests PASS and build PASS.

- [ ] **Step 8: Commit context actions**

Run:

```bash
git add src/assistant/proposals.ts src/assistant/proposals.test.ts src/context/SpreadsheetContext.tsx src/app/AppLayout.tsx src/components/ai/AICopilotPanel.tsx
git commit -m "feat: expose assistant spreadsheet actions"
```

Expected: one commit containing context wiring and apply helper.

---

### Task 6: Sage Panel AI SDK Integration

**Files:**
- Modify: `src/components/ai/AICopilotPanel.tsx`
- Modify: `src/components/ai/AICopilotPanel.module.css`
- Modify: `src/components/ai/aiCopilotMock.ts`
- Modify: `src/components/ai/aiCopilotMock.test.ts`

- [ ] **Step 1: Remove obsolete mock tests**

Delete `src/components/ai/aiCopilotMock.test.ts` or replace it with proposal tests already covered by `src/assistant/proposals.test.ts`.

Run:

```bash
pnpm exec vitest run src/components/ai/aiCopilotMock.test.ts
```

Expected if deleted: Vitest reports no test file when run directly. Do not keep this command in CI; this is only to confirm the old mock test is gone before removing the mock module.

- [ ] **Step 2: Remove obsolete mock module**

Delete `src/components/ai/aiCopilotMock.ts`.

Update `AICopilotPanel.tsx` imports so it no longer imports `createMockCopilotResult`, `MockCopilotResult`, or `CopilotDiffRow`.

- [ ] **Step 3: Replace Sage panel with AI SDK chat flow**

Replace `src/components/ai/AICopilotPanel.tsx` with this structure, preserving the existing `SageIcon` SVG:

```tsx
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import React, { useContext, useEffect, useMemo, useRef, useState } from "react";

import type { SelectedCell } from "../../app/analysisState";
import { SpreadsheetContext } from "../../context/SpreadsheetContext";
import {
  stripAssistantProposalFromText,
  extractAssistantProposalFromText,
  validateAssistantProposal,
  type AssistantCellChange,
} from "../../assistant/proposals";
import styles from "./AICopilotPanel.module.css";

interface AICopilotPanelProps {
  onClose: () => void;
  compact?: boolean;
  selectedCell?: SelectedCell | null;
}

const SageIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 3l1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4L12 3z" fill="currentColor" />
    <path d="M18 14l.8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8L18 14z" fill="currentColor" opacity="0.6" />
  </svg>
);

const toneLabels: Record<AssistantCellChange["kind"], string> = {
  update: "Update",
  add: "New",
  review: "Review",
};

const messageText = (message: { parts: Array<{ type: string; text?: string }> }) =>
  message.parts
    .map((part) => (part.type === "text" ? (part.text ?? "") : ""))
    .join("");

export const AICopilotPanel: React.FC<AICopilotPanelProps> = ({
  onClose,
  compact = false,
  selectedCell = null,
}) => {
  const [prompt, setPrompt] = useState("");
  const [proposalStatus, setProposalStatus] = useState<"preview" | "accepted" | "cancelled">("preview");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { getWorkbookSnapshot, applyAssistantChanges } = useContext(SpreadsheetContext);

  const currentSnapshot = useMemo(
    () => getWorkbookSnapshot(selectedCell ?? null),
    [getWorkbookSnapshot, selectedCell],
  );

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/assistant",
      body: () => ({
        workbookSnapshot: getWorkbookSnapshot(selectedCell ?? null),
      }),
    }),
  });

  const latestAssistantText = [...messages]
    .reverse()
    .find((message) => message.role === "assistant");

  const extractedProposal = latestAssistantText
    ? extractAssistantProposalFromText(messageText(latestAssistantText))
    : null;

  const proposalValidation = currentSnapshot
    ? validateAssistantProposal(extractedProposal, currentSnapshot)
    : null;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt || status === "streaming" || status === "submitted") return;

    setProposalStatus("preview");
    sendMessage({ text: trimmedPrompt });
    setPrompt("");
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (prompt.trim()) {
        handleSubmit(event);
      }
    }
  };

  const handleApply = () => {
    if (!proposalValidation?.valid) return;
    applyAssistantChanges(proposalValidation.applyableChanges);
    setProposalStatus("accepted");
  };

  const handleDismiss = () => {
    setProposalStatus("cancelled");
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, status, proposalStatus]);

  const showEmptyState = messages.length === 0 && !error;
  const isBusy = status === "submitted" || status === "streaming";

  return (
    <aside className={`${styles.panel} ${compact ? styles.panelCompact : ""}`} aria-label="Sage">
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.sageAvatar}>
            <SageIcon size={16} />
          </div>
          <span className={styles.title}>Sage</span>
        </div>
        <button type="button" onClick={onClose} className={styles.closeButton} title="Close Sage" aria-label="Close Sage">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6L6 18" />
            <path d="M6 6l12 12" />
          </svg>
        </button>
      </header>

      <div ref={scrollRef} className={styles.content}>
        {showEmptyState && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <SageIcon size={20} />
            </div>
            <p className={styles.emptyTitle}>What should Sage inspect?</p>
            <p className={styles.emptyHint}>Ask for formulas, uncertainty checks, or changes to this workbook.</p>
          </div>
        )}

        {messages.map((message) => {
          const text = messageText(message);
          const visibleText = message.role === "assistant" ? stripAssistantProposalFromText(text) : text;
          return (
            <div key={message.id} className={message.role === "user" ? styles.userPrompt : styles.assistantMessage}>
              <span className={styles.userPromptText}>{visibleText}</span>
            </div>
          );
        })}

        {isBusy && <div className={styles.statusRow}>Sage is thinking…</div>}

        {error && (
          <div className={styles.errorBox}>
            {error.message || "Assistant request failed."}
          </div>
        )}

        {proposalValidation?.proposal && proposalStatus === "preview" && (
          <div className={styles.results}>
            <div className={styles.changeList}>
              {proposalValidation.proposal.changes.map((row) => (
                <ChangeRow key={`${row.cell}:${row.kind}`} row={row} />
              ))}
            </div>
            {!proposalValidation.valid && (
              <div className={styles.errorBox}>{proposalValidation.errors.join(" ")}</div>
            )}
            <div className={styles.inlineActions}>
              <button type="button" className={styles.applyBtn} onClick={handleApply} disabled={!proposalValidation.valid}>
                Apply {proposalValidation.applyableChanges.length} change{proposalValidation.applyableChanges.length !== 1 ? "s" : ""}
              </button>
              <button type="button" className={styles.dismissBtn} onClick={handleDismiss}>
                Dismiss
              </button>
            </div>
          </div>
        )}

        {proposalStatus === "accepted" && (
          <div className={styles.statusRow}>
            <span className={styles.statusDot} />
            <span className={styles.statusText}>Applied</span>
          </div>
        )}

        {proposalStatus === "cancelled" && (
          <div className={styles.statusRow}>
            <span className={styles.statusText}>Dismissed</span>
          </div>
        )}
      </div>

      <form className={styles.inputBar} onSubmit={handleSubmit}>
        <textarea
          ref={inputRef}
          className={styles.input}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Sage about this workbook…"
          rows={1}
        />
        <button type="submit" className={styles.sendBtn} disabled={!prompt.trim() || isBusy} title="Send" aria-label="Send">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </form>
    </aside>
  );
};

const ChangeRow: React.FC<{ row: AssistantCellChange }> = ({ row }) => {
  const toneClass =
    row.kind === "add"
      ? styles.toneAdd
      : row.kind === "update"
        ? styles.toneChange
        : styles.toneReview;

  return (
    <div className={`${styles.changeRow} ${toneClass}`}>
      <div className={styles.changeTop}>
        <span className={styles.changeTone}>{toneLabels[row.kind]}</span>
        <span className={styles.changeCell}>{row.cell}</span>
        {row.before ? (
          <span className={styles.changeArrow}>
            <span className={styles.changeBefore}>{row.before}</span>
            <span className={styles.changeArrowIcon}>→</span>
            <span className={styles.changeAfter}>{row.after}</span>
          </span>
        ) : (
          <span className={styles.changeAfter}>{row.after}</span>
        )}
      </div>
      <p className={styles.changeReason}>{row.reason}</p>
    </div>
  );
};
```

If the installed AI SDK exposes `status` names that differ from `"submitted"` and `"streaming"`, run TypeScript and use the literal union shown by the compiler.

- [ ] **Step 4: Add panel styles for assistant messages and errors**

Append to `src/components/ai/AICopilotPanel.module.css`:

```css
.assistantMessage {
    padding: 8px 10px;
    border-radius: var(--radius-sm, 6px);
    font-size: 13px;
    line-height: 1.5;
    color: var(--text-secondary);
    white-space: pre-wrap;
}

.errorBox {
    padding: 8px 10px;
    border-radius: var(--radius-sm, 6px);
    background: color-mix(in srgb, var(--dist-lognormal-bg) 70%, transparent);
    color: var(--text-primary);
    font-size: 12px;
    line-height: 1.45;
}

.applyBtn:disabled {
    cursor: not-allowed;
    opacity: 0.45;
}
```

- [ ] **Step 5: Verify panel build**

Run:

```bash
pnpm build
```

Expected: PASS. Fix TypeScript errors by matching the installed AI SDK types, keeping the same behavior.

- [ ] **Step 6: Commit Sage panel integration**

Run:

```bash
git add src/components/ai/AICopilotPanel.tsx src/components/ai/AICopilotPanel.module.css src/components/ai/aiCopilotMock.ts src/components/ai/aiCopilotMock.test.ts
git commit -m "feat: connect sage to assistant api"
```

Expected: one commit replacing the local mock with AI SDK chat behavior.

---

### Task 7: Playwright Assistant Flow

**Files:**
- Modify: `tests/e2e/spreadsheet-edit.spec.ts`

- [ ] **Step 1: Replace the old mock Sage e2e test with an AI SDK stream mock**

In `tests/e2e/spreadsheet-edit.spec.ts`, replace the test named `"opens the local AI copilot and reviews a mock diff"` with:

```ts
test("opens Sage, receives a proposal, and applies it", async ({ page }) => {
  await page.route("**/api/assistant", async (route) => {
    const proposal = {
      title: "Add review output",
      summary: "Adds an output based on the selected input.",
      changes: [
        {
          cell: "B1",
          before: "",
          after: "=A1*2",
          reason: "Creates an uncertainty-preserving dependent output.",
          kind: "add",
        },
      ],
    };

    const text = [
      "I can add a dependent output that keeps the uncertainty from A1.",
      "```maybe-proposal",
      JSON.stringify(proposal),
      "```",
    ].join("\\n");

    const body = [
      'data: {"type":"start","messageId":"test-assistant-message"}',
      "",
      'data: {"type":"text-start","id":"text-1"}',
      "",
      `data: ${JSON.stringify({ type: "text-delta", id: "text-1", delta: text })}`,
      "",
      'data: {"type":"text-end","id":"text-1"}',
      "",
      'data: {"type":"finish"}',
      "",
      "data: [DONE]",
      "",
    ].join("\\n");

    await route.fulfill({
      status: 200,
      headers: {
        "content-type": "text/event-stream",
        "x-vercel-ai-ui-message-stream": "v1",
      },
      body,
    });
  });

  await page.goto("/");

  const firstCell = page.locator("tbody tr:first-child td:nth-child(2) > div");
  await firstCell.dblclick();

  const editor = page.getByLabel("Cell A1");
  await editor.fill("CI[10, 20]");
  await editor.press("Enter");

  await page.getByRole("button", { name: /Sage/i }).click();
  await expect(page.getByRole("complementary", { name: "Sage" })).toBeVisible();

  await page
    .getByPlaceholder("Ask Sage about this workbook…")
    .fill("Add an output that doubles the selected input");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByText("I can add a dependent output")).toBeVisible();
  await expect(page.getByText("=A1*2")).toBeVisible();
  await page.getByRole("button", { name: /Apply 1 change/ }).click();

  const secondCell = page.locator("tbody tr:first-child td:nth-child(3) > div");
  await expect(secondCell).not.toHaveText("");
  await expect(page.getByText("Applied")).toBeVisible();
});
```

- [ ] **Step 2: Run the focused e2e test and verify it fails if the UI is not wired correctly**

Run:

```bash
pnpm exec playwright test tests/e2e/spreadsheet-edit.spec.ts -g "opens Sage, receives a proposal, and applies it"
```

Expected after Task 6: PASS. If it FAILS, the failure should point to stream parsing, proposal extraction, or apply behavior.

- [ ] **Step 3: Add missing-key e2e coverage**

Add this test below the Sage proposal test:

```ts
test("shows a setup error when the assistant server has no OpenAI key", async ({
  page,
}) => {
  await page.route("**/api/assistant", async (route) => {
    await route.fulfill({
      status: 500,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        error: "OPENAI_API_KEY is not configured for the assistant server.",
      }),
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: /Sage/i }).click();

  await page
    .getByPlaceholder("Ask Sage about this workbook…")
    .fill("What formulas should I add?");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(
    page.getByText("OPENAI_API_KEY is not configured for the assistant server."),
  ).toBeVisible();
});
```

- [ ] **Step 4: Run focused e2e tests**

Run:

```bash
pnpm exec playwright test tests/e2e/spreadsheet-edit.spec.ts -g "Sage|assistant server"
```

Expected: PASS.

- [ ] **Step 5: Commit e2e coverage**

Run:

```bash
git add tests/e2e/spreadsheet-edit.spec.ts
git commit -m "test: cover sage assistant proposal flow"
```

Expected: one commit containing Playwright coverage.

---

### Task 8: Full Verification And Manual OpenAI Check

**Files:**
- Modify only if verification exposes a defect in files from earlier tasks.

- [ ] **Step 1: Run unit tests**

Run:

```bash
pnpm test
```

Expected: PASS.

- [ ] **Step 2: Run lint**

Run:

```bash
pnpm lint
```

Expected: PASS.

- [ ] **Step 3: Run build**

Run:

```bash
pnpm build
```

Expected: PASS. Existing Vite chunk warnings are acceptable if no new build failure appears.

- [ ] **Step 4: Run e2e tests**

Run:

```bash
pnpm test:e2e
```

Expected: PASS.

- [ ] **Step 5: Run dependency hygiene**

Run:

```bash
pnpm knip
```

Expected: PASS. If Knip flags AI SDK packages as unused, verify imports first; do not suppress real unused dependencies.

- [ ] **Step 6: Start the dev server with OpenAI configured**

Run:

```bash
OPENAI_API_KEY="$OPENAI_API_KEY" pnpm dev
```

Expected: Vite starts and prints a local URL.

- [ ] **Step 7: Manual browser verification**

Open the Vite URL and verify:

- Sage opens from the toolbar.
- Enter `CI[10, 20]` in `A1`.
- Ask Sage: `Add an output that doubles this uncertain input and show me a high percentile review point.`
- The assistant streams text.
- A proposal preview appears if the model returns the `maybe-proposal` block.
- Applying the proposal updates the grid.
- Browser devtools network request to `/api/assistant` contains workbook context but does not contain `OPENAI_API_KEY`.

- [ ] **Step 8: Commit verification fixes**

If verification required fixes, run:

```bash
git add package.json pnpm-lock.yaml eslint.config.js vite.config.ts src/assistant src/server src/context/SpreadsheetContext.tsx src/app/AppLayout.tsx src/components/ai tests/e2e/spreadsheet-edit.spec.ts
git commit -m "fix: stabilize assistant verification"
```

Expected: commit only files changed to fix verification failures. If no fixes were required, do not create an empty commit.

---

## Final Acceptance Criteria

- `pnpm test` passes.
- `pnpm lint` passes.
- `pnpm build` passes.
- `pnpm test:e2e` passes.
- `pnpm knip` passes.
- `/api/assistant` returns a setup error when `OPENAI_API_KEY` is missing.
- With `OPENAI_API_KEY` set, Sage can stream an OpenAI response through the server route.
- The browser never receives or stores the OpenAI API key.
- Sage sends a compact workbook snapshot containing formulas, evaluated values, selected cell, and uncertainty metadata.
- Valid proposals render as diff rows and Apply mutates the spreadsheet.
- Invalid proposals disable Apply and explain why.
