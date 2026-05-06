import { describe, expect, it, mock } from "bun:test";

import {
  cellAddressFromA1,
  cellAddressToA1,
} from "../../../src/assistant/address";
import { buildWorkbookSnapshot } from "../../../src/assistant/workbookSnapshot";
import { MAYBE_SAMPLE_SIZE } from "../../../src/config/simulation";
import { GaussFormulaEngine } from "../../../src/lib/formulaEngine";
import type { FormulaEngine } from "../../../src/lib/formulaEngine";

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

  it("throws for negative zero-based coordinates", () => {
    expect(() => cellAddressToA1(-1, 0)).toThrow(RangeError);
    expect(() => cellAddressToA1(0, -1)).toThrow(RangeError);
  });

  it("captures formulas, evaluated values, selected cell, and uncertainty metadata", () => {
    const values = [
      [
        "Label",
        {
          kind: "normal",
          source: "ci",
          lower: 10,
          upper: 20,
          confidenceLevel: 95,
          mean: 15,
          variance: 6.508682,
          toSamples: () => [10, 15, 20],
        },
        {
          samples: [20, 30, 40],
        },
      ],
      ["Plain", 42, null],
    ];
    const formulas = [
      [null, null, "=B1*2"],
      [null, null, null],
    ];
    const engine = {
      getSheetName: () => "Sheet1",
      getSheetDimensions: () => ({ width: 3, height: 2 }),
      getSheetSerialized: () => [
        ["Label", "N.CI(10.00, 20.00)", "=B1*2"],
        ["Plain", 42, null],
      ],
      getCellFormula: ({ row, col }: { row: number; col: number }) =>
        formulas[row]?.[col] ?? null,
      getCellValue: ({ row, col }: { row: number; col: number }) =>
        values[row]?.[col] ?? null,
    };

    const snapshot = buildWorkbookSnapshot({
      formulaEngine: engine as unknown as FormulaEngine,
      selectedCell: { row: 0, col: 2 },
      maxCells: 20,
    });

    expect(snapshot.sheetName).toBe("Sheet1");
    expect(snapshot.selectedCell).toBe("C1");
    expect(snapshot.serializedContent).toEqual([
      ["Label", "N.CI(10.00, 20.00)", "=B1*2"],
      ["Plain", 42, null],
    ]);
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
      displayValue: "N.CI(10, 20)",
      kind: "distribution",
      distribution: {
        kind: "normal",
        source: "ci",
        lower: 10,
        upper: 20,
        confidenceLevel: 95,
      },
    });
    expect(snapshot.cells.find((cell) => cell.address === "C1")).toMatchObject({
      address: "C1",
      formula: "=B1*2",
      kind: "sampled_distribution",
    });
  });

  it("uses sampled distribution summary methods in cell snapshots", () => {
    const engine = {
      getSheetName: () => "Sheet1",
      getSheetDimensions: () => ({ width: 1, height: 1 }),
      getCellFormula: () => null,
      getCellValue: () => ({
        samples: [1, 2, 100],
        getSamples: () => [1, 2, 100],
        getMean: () => 42,
        getVariance: () => 9,
      }),
    };

    const snapshot = buildWorkbookSnapshot({
      formulaEngine: engine as unknown as FormulaEngine,
      selectedCell: null,
      maxCells: 20,
    });

    expect(snapshot.cells[0]).toMatchObject({
      address: "A1",
      kind: "sampled_distribution",
      sampleSummary: {
        sampleCount: 3,
        mean: 42,
        standardDeviation: 3,
      },
    });
  });

  it("uses the configured Maybe sample size when summarizing explicit distributions", () => {
    const toSamples = mock(() => [1, 2, 3]);
    const engine = {
      getSheetName: () => "Sheet1",
      getSheetDimensions: () => ({ width: 1, height: 1 }),
      getCellFormula: () => null,
      getCellValue: () => ({
        kind: "normal",
        source: "ci",
        lower: 1,
        upper: 2,
        confidenceLevel: 95,
        mean: 1.5,
        variance: 0.065,
        toSamples,
      }),
    };

    buildWorkbookSnapshot({
      formulaEngine: engine as unknown as FormulaEngine,
      selectedCell: null,
      maxCells: 20,
    });

    expect(toSamples).toHaveBeenCalledWith({ sampleSize: MAYBE_SAMPLE_SIZE });
  });

  it("returns null for an out-of-bounds selected cell and uses the engine sheet name", () => {
    const engine = GaussFormulaEngine.buildEmpty({
      licenseKey: "gpl-v3",
      language: "enGB",
      useColumnIndex: true,
    });

    try {
      engine.addSheet("Budget");
      engine.setSheetContent(0, [["Only cell"]]);

      const snapshot = buildWorkbookSnapshot({
        formulaEngine: engine,
        selectedCell: { row: 9, col: 9 },
        maxCells: 20,
      });

      expect(snapshot.selectedCell).toBeNull();
      expect(snapshot.sheetName).toBe("Budget");
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
