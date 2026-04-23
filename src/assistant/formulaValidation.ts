import { GaussFormulaEngine } from "../lib/formulaEngine";
import { DEFAULT_CONFIDENCE_LEVEL } from "../utils/distribution/distributionUtils";
import { cellAddressFromA1 } from "./address";
import { type ValidateFormulaInput } from "./toolSchemas";
import {
  buildWorkbookSnapshot,
  type WorkbookCellSnapshot,
  type WorkbookDistributionSummary,
  type WorkbookSnapshot,
} from "./workbookSnapshot";

interface DistributionConstructor {
  normal?: (
    mean: number,
    variance: number,
    options?: Record<string, unknown>,
  ) => unknown;
  lognormal?: (
    mu: number,
    sigma: number,
    options?: Record<string, unknown>,
  ) => unknown;
  uniform?: (
    min: number,
    max: number,
    options?: Record<string, unknown>,
  ) => unknown;
  normalFromCI?: (
    lower: number,
    upper: number,
    confidenceLevel: number,
    options?: Record<string, unknown>,
  ) => unknown;
  lognormalFromCI?: (
    lower: number,
    upper: number,
    confidenceLevel: number,
    options?: Record<string, unknown>,
  ) => unknown;
}

const getDistributionConstructor = (): DistributionConstructor | undefined =>
  (GaussFormulaEngine as unknown as { DistributionNumber?: DistributionConstructor })
    .DistributionNumber;

const representativeDistributionValue = (
  distribution: WorkbookDistributionSummary,
): number | string => {
  switch (distribution.kind) {
    case "normal":
      return distribution.mean ??
        (distribution.lower !== undefined && distribution.upper !== undefined
          ? (distribution.lower + distribution.upper) / 2
          : "0");
    case "lognormal":
      if (distribution.mu !== undefined && distribution.sigma !== undefined) {
        return Math.exp(distribution.mu + (distribution.sigma ** 2) / 2);
      }
      if (distribution.lower !== undefined && distribution.upper !== undefined) {
        return Math.sqrt(distribution.lower * distribution.upper);
      }
      return "0";
    case "uniform":
      return distribution.min !== undefined && distribution.max !== undefined
        ? (distribution.min + distribution.max) / 2
        : "0";
  }
};

const reconstructDistributionValue = (
  distribution: WorkbookDistributionSummary,
): unknown => {
  const ctor = getDistributionConstructor();

  if (ctor) {
    if (
      distribution.kind === "normal" &&
      distribution.source === "ci" &&
      distribution.lower !== undefined &&
      distribution.upper !== undefined &&
      ctor.normalFromCI
    ) {
      return ctor.normalFromCI(
        distribution.lower,
        distribution.upper,
        distribution.confidenceLevel ?? DEFAULT_CONFIDENCE_LEVEL,
      );
    }

    if (
      distribution.kind === "lognormal" &&
      distribution.source === "ci" &&
      distribution.lower !== undefined &&
      distribution.upper !== undefined &&
      ctor.lognormalFromCI
    ) {
      return ctor.lognormalFromCI(
        distribution.lower,
        distribution.upper,
        distribution.confidenceLevel ?? DEFAULT_CONFIDENCE_LEVEL,
      );
    }

    if (
      distribution.kind === "normal" &&
      distribution.mean !== undefined &&
      distribution.variance !== undefined &&
      ctor.normal
    ) {
      return ctor.normal(distribution.mean, distribution.variance);
    }

    if (
      distribution.kind === "lognormal" &&
      distribution.mu !== undefined &&
      distribution.sigma !== undefined &&
      ctor.lognormal
    ) {
      return ctor.lognormal(distribution.mu, distribution.sigma);
    }

    if (
      distribution.kind === "uniform" &&
      distribution.min !== undefined &&
      distribution.max !== undefined &&
      ctor.uniform
    ) {
      return ctor.uniform(distribution.min, distribution.max);
    }
  }

  return representativeDistributionValue(distribution);
};

const reconstructCellValue = (cell: WorkbookCellSnapshot): unknown => {
  if (cell.formula) {
    return cell.formula;
  }

  if (cell.distribution) {
    return reconstructDistributionValue(cell.distribution);
  }

  return cell.displayValue;
};

const createFormulaEngineFromSnapshot = (snapshot: WorkbookSnapshot) => {
  const formulaEngine = GaussFormulaEngine.buildEmpty({
    licenseKey: "gpl-v3",
    language: "enGB",
    useColumnIndex: true,
    sampleSize: 10000,
  });

  formulaEngine.addSheet(snapshot.sheetName || "Sheet1");

  const rows = Math.max(1, snapshot.dimensions.height);
  const cols = Math.max(1, snapshot.dimensions.width);
  const sheetData: unknown[][] = Array.from(
    { length: rows },
    () => Array.from({ length: cols }, () => null),
  );

  for (const cell of snapshot.cells) {
    if (cell.row < 0 || cell.col < 0 || cell.row >= rows || cell.col >= cols) {
      continue;
    }

    sheetData[cell.row][cell.col] = reconstructCellValue(cell);
  }

  formulaEngine.setSheetContent(0, sheetData);
  return formulaEngine;
};

export const validateFormulaAgainstSnapshot = (
  snapshot: WorkbookSnapshot,
  input: ValidateFormulaInput,
) => {
  const normalizedCell = input.cell.trim().toUpperCase();
  const address = cellAddressFromA1(normalizedCell, snapshot.dimensions);

  if (!address) {
    return {
      cell: normalizedCell,
      formula: input.formula,
      valid: false,
      error: `${normalizedCell} is outside the current sheet.`,
    };
  }

  const formulaEngine = createFormulaEngineFromSnapshot(snapshot);

  try {
    formulaEngine.setCellContents(
      { sheet: 0, row: address.row, col: address.col },
      input.formula,
    );
    const validationSnapshot = buildWorkbookSnapshot({
      formulaEngine,
      selectedCell: { row: address.row, col: address.col },
      maxCells: snapshot.dimensions.width * snapshot.dimensions.height,
      minimumDimensions: snapshot.dimensions,
    });
    const targetCell = validationSnapshot.cells.find(
      (cell) => cell.address === normalizedCell,
    );
    const errorMessage =
      targetCell?.kind === "error" ? targetCell.displayValue : undefined;

    return {
      cell: normalizedCell,
      formula:
        formulaEngine.getCellFormula({
          sheet: 0,
          row: address.row,
          col: address.col,
        }) ?? input.formula,
      valid: targetCell !== undefined && targetCell.kind !== "error",
      displayValue: targetCell?.displayValue ?? "",
      kind: targetCell?.kind ?? "text",
      error: errorMessage,
    };
  } catch (error) {
    return {
      cell: normalizedCell,
      formula: input.formula,
      valid: false,
      error:
        error instanceof Error
          ? error.message
          : "Unable to validate this formula.",
    };
  } finally {
    formulaEngine.destroy();
  }
};
