import { describe, expect, it } from "bun:test";

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
    "keeps each example workbook parseable and sampled",
    () => {
      const outputCellsByExampleId = new Map([
        ["event-budget", "E4"],
        ["project-timeline", "E3"],
        ["sales-forecast", "E4"],
      ]);

      expect(spreadsheetExamples.map((example) => example.id)).toEqual([
        "event-budget",
        "project-timeline",
        "sales-forecast",
      ]);

      for (const example of spreadsheetExamples) {
        const outputCell = outputCellsByExampleId.get(example.id);
        expect(outputCell).toBeDefined();

        const engine = GaussFormulaEngine.buildEmpty({
          licenseKey: "gpl-v3",
          language: "enGB",
          useColumnIndex: true,
          sampleSize: 1000,
        });

        engine.addSheet("Sheet1");
        engine.setSheetContent(0, example.data);

        try {
          const sampledMean = meanOfSampledValue(
            engine.getCellValue(a1ToAddress(outputCell!)),
          );

          expect(Number.isFinite(sampledMean)).toBe(true);
        } finally {
          engine.destroy();
        }
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
    "keeps example uncertainty inputs parseable after formula bar formatting",
    () => {
      for (const example of spreadsheetExamples) {
        const engine = GaussFormulaEngine.buildEmpty({
          licenseKey: "gpl-v3",
          language: "enGB",
          useColumnIndex: true,
          sampleSize: 1000,
        });

        engine.addSheet("Sheet1");
        engine.setSheetContent(0, example.data);

        try {
          for (const cell of ["B2", "B3", "B4", "B5"]) {
            const address = a1ToAddress(cell);
            const cellValue = engine.getCellValue(address);

            if (parseSampledDistributionValue(cellValue)) {
              engine.setCellContents(
                address,
                formatFormulaBarCellValue(cellValue),
              );
            }
          }

          const sampledValues = ["E2", "E3", "E4"]
            .map((cell) => engine.getCellValue(a1ToAddress(cell)))
            .filter((cellValue) => parseSampledDistributionValue(cellValue));

          expect(sampledValues.length).toBeGreaterThan(0);
        } finally {
          engine.destroy();
        }
      }
    },
  );
});
