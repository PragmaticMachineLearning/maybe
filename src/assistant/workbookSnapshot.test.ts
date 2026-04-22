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

  it("throws for negative zero-based coordinates", () => {
    expect(() => cellAddressToA1(-1, 0)).toThrow(RangeError);
    expect(() => cellAddressToA1(0, -1)).toThrow(RangeError);
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
