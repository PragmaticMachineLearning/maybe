import { describe, expect, it } from "bun:test";

import {
  assistantProposalSchema,
  assistantRequestSchema,
  saveWorkbookRequestSchema,
  serializedCellContentSchema,
  workbookSnapshotSchema,
} from "../../../src/schemas";
import {
  validateFormulaInputSchema,
  workbookContextInputSchema,
} from "../../../src/schemas/tools";

describe("shared schemas", () => {
  it("validates assistant, workbook, persistence, and tool contracts from one import", () => {
    const workbookSnapshot = {
      sheetName: "Sheet1",
      dimensions: { width: 2, height: 2 },
      selectedCell: null,
      serializedContent: [
        ["N.CI(10, 20)", null],
        [null, "=A1*2"],
      ],
      cells: [
        {
          address: "A1",
          row: 0,
          col: 0,
          formula: null,
          displayValue: "N.CI(10, 20)",
          kind: "distribution",
          distribution: {
            kind: "normal",
            source: "ci",
            lower: 10,
            upper: 20,
            confidenceLevel: 95,
          },
        },
      ],
      includedCellCount: 1,
      totalNonEmptyCellCount: 1,
      truncated: false,
    };

    expect(workbookSnapshotSchema.safeParse(workbookSnapshot).success).toBe(
      true,
    );
    expect(
      assistantRequestSchema.safeParse({
        messages: [{ role: "user", parts: [{ type: "text", text: "Help" }] }],
        workbookSnapshot,
      }).success,
    ).toBe(true);
    expect(
      assistantProposalSchema.safeParse({
        title: "Add output",
        summary: "Adds one output.",
        changes: [
          {
            cell: "B1",
            before: "",
            after: "=A1*2",
            reason: "Double the uncertain input.",
            kind: "add",
          },
        ],
      }).success,
    ).toBe(true);
    expect(
      workbookContextInputSchema.safeParse({
        include: { cells: true, dependencyGraph: true },
      }).success,
    ).toBe(true);
    expect(
      validateFormulaInputSchema.safeParse({ cell: "B1", formula: "=A1*2" })
        .success,
    ).toBe(true);
    expect(serializedCellContentSchema.safeParse(null).success).toBe(true);
    expect(
      saveWorkbookRequestSchema.safeParse({
        serializedContent: workbookSnapshot.serializedContent,
      }).success,
    ).toBe(true);
  });
});
