import { describe, expect, it } from "vitest";

import { validateFormulaAgainstSnapshot } from "../../../src/assistant/formulaValidation";
import type { WorkbookSnapshot } from "../../../src/assistant/workbookSnapshot";

const baseSnapshot: WorkbookSnapshot = {
  sheetName: "Sheet1",
  dimensions: { width: 2, height: 1 },
  selectedCell: null,
  serializedContent: [["N.CI(10, 20)", null]],
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

describe("validateFormulaAgainstSnapshot", () => {
  it("replays serialized workbook content when validating formulas", () => {
    expect(
      validateFormulaAgainstSnapshot(baseSnapshot, {
        cell: "B1",
        formula: "=A1*2",
      }),
    ).toMatchObject({
      cell: "B1",
      valid: true,
      formula: "=A1*2",
      kind: "sampled_distribution",
    });
  });

  it("does not reconstruct distributions from summary metadata when serialized content differs", () => {
    const snapshot: WorkbookSnapshot = {
      ...baseSnapshot,
      serializedContent: [["not uncertainty", null]],
    };

    expect(
      validateFormulaAgainstSnapshot(snapshot, {
        cell: "B1",
        formula: "=A1*2",
      }),
    ).toMatchObject({
      cell: "B1",
      valid: false,
      formula: "=A1*2",
    });
  });
});
