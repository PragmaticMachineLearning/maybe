import { describe, expect, it } from "vitest";

import { spreadsheetExamples } from "../../../src/examples/examples";
import { formatFormulaBarCellValue } from "../../../src/hooks/useFormulaBar";
import { GaussFormulaEngine } from "../../../src/lib/formulaEngine";
import { parseSampledDistributionValue } from "../../../src/utils/distribution/distributionUtils";

const a1ToAddress = (address: string) => {
  const match = address.match(/^([A-Z]+)(\d+)$/);
  if (!match) {
    throw new Error(`Invalid cell address: ${address}`);
  }

  let col = 0;
  for (const char of match[1]) {
    col = col * 26 + (char.charCodeAt(0) - 64);
  }

  return { sheet: 0, row: Number(match[2]) - 1, col: col - 1 };
};

const meanOfSampledValue = (value: unknown): number => {
  const sampled = parseSampledDistributionValue(value);

  if (!sampled) {
    throw new Error("Expected a sampled distribution value.");
  }

  return sampled.mean;
};

describe("spreadsheet examples", () => {
  const supportsExplicitDistributions = Boolean(
    (GaussFormulaEngine as unknown as { DistributionNumber?: unknown })
      .DistributionNumber,
  );

  it.skipIf(!supportsExplicitDistributions)(
    "keeps the prompt-cost example mean aligned with the deterministic workbook total",
    () => {
      const promptCostExample = spreadsheetExamples.find(
        (example) => example.id === "prompt-cost-uncertainty",
      );
      expect(promptCostExample).toBeDefined();

      const engine = GaussFormulaEngine.buildEmpty({
        licenseKey: "gpl-v3",
        language: "enGB",
        useColumnIndex: true,
        sampleSize: 10000,
      });

      engine.addSheet("Sheet1");
      engine.setSheetContent(0, promptCostExample!.data);

      try {
        expect(meanOfSampledValue(engine.getCellValue(a1ToAddress("E6"))))
          .toBeCloseTo(10, 0);
        expect(engine.getCellValue(a1ToAddress("E7"))).toBe(2);
        expect(meanOfSampledValue(engine.getCellValue(a1ToAddress("E15"))))
          .toBeCloseTo(146, 0);
      } finally {
        engine.destroy();
      }
    },
  );

  it.skipIf(!supportsExplicitDistributions)(
    "keeps aggregate formulas sampled when inputs are uncertain",
    () => {
      const engine = GaussFormulaEngine.buildEmpty({
        licenseKey: "gpl-v3",
        language: "enGB",
        useColumnIndex: true,
        sampleSize: 1000,
      });

      engine.addSheet("Sheet1");
      engine.setSheetContent(0, [
        ["N(10, 0)", "N(20, 0)", "=SUM(A1:B1)", "=AVERAGE(A1:B1)"],
      ]);

      try {
        expect(meanOfSampledValue(engine.getCellValue(a1ToAddress("C1"))))
          .toBe(30);
        expect(meanOfSampledValue(engine.getCellValue(a1ToAddress("D1"))))
          .toBe(15);
      } finally {
        engine.destroy();
      }
    },
  );

  it.skipIf(!supportsExplicitDistributions)(
    "keeps prompt-cost pricing inputs parseable after formula bar formatting",
    () => {
      const promptCostExample = spreadsheetExamples.find(
        (example) => example.id === "prompt-cost-uncertainty",
      );
      expect(promptCostExample).toBeDefined();

      const engine = GaussFormulaEngine.buildEmpty({
        licenseKey: "gpl-v3",
        language: "enGB",
        useColumnIndex: true,
        sampleSize: 1000,
      });

      engine.addSheet("Sheet1");
      engine.setSheetContent(0, promptCostExample!.data);

      try {
        for (const cell of ["B11", "B12"]) {
          const address = a1ToAddress(cell);
          engine.setCellContents(
            address,
            formatFormulaBarCellValue(engine.getCellValue(address)),
          );
        }

        expect(meanOfSampledValue(engine.getCellValue(a1ToAddress("E13"))))
          .toBeGreaterThan(0);
      } finally {
        engine.destroy();
      }
    },
  );
});
