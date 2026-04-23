import type { FormulaEngine } from "../lib/formulaEngine";
import {
  formatConfidenceFormulaSuffix,
  getSamplesFromDistribution,
  isSampledDistributionValue,
  parseDistributionValue,
  parseSampledDistributionValue,
} from "../utils/distribution/distributionUtils";
import { percentileFromSorted } from "../utils/distribution/distributionMath";
import { cellAddressToA1 } from "./address";
import type { SheetDimensions, ZeroBasedCellAddress } from "./address";

export type { SheetDimensions, ZeroBasedCellAddress };

export type SelectedCell = ZeroBasedCellAddress;

export type WorkbookCellKind =
  | "scalar"
  | "text"
  | "boolean"
  | "distribution"
  | "sampled_distribution"
  | "error"
  | "unknown_object";

export interface WorkbookDistributionSummary {
  kind: "normal" | "lognormal" | "uniform";
  source: "parameters" | "ci";
  mean?: number;
  variance?: number;
  mu?: number;
  sigma?: number;
  min?: number;
  max?: number;
  lower?: number;
  upper?: number;
  confidenceLevel?: number;
}

export interface WorkbookSampleSummary {
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
  distribution?: WorkbookDistributionSummary;
  sampleSummary?: WorkbookSampleSummary;
}

export interface WorkbookSnapshot {
  sheetName: string;
  dimensions: SheetDimensions;
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
  minimumDimensions?: SheetDimensions;
}

const DEFAULT_MAX_CELLS = 200;

const isBlankCell = (value: unknown, formula: string | null): boolean =>
  formula == null && (value === null || value === undefined || value === "");

const round6 = (value: number): number => Number(value.toFixed(6));

const resolveSheetName = (formulaEngine: FormulaEngine): string => {
  const engineWithSheetName = formulaEngine as FormulaEngine & {
    getSheetName?: (sheetId: number) => string | undefined;
  };

  const sheetName = engineWithSheetName.getSheetName?.(0);
  if (typeof sheetName === "string" && sheetName.length > 0) {
    return sheetName;
  }

  // The current app initializes a single default sheet named Sheet1 when the
  // engine does not expose sheet-name lookup.
  return "Sheet1";
};

const isSelectedCellInBounds = (
  selectedCell: SelectedCell,
  dimensions: SheetDimensions,
): boolean =>
  Number.isInteger(selectedCell.row) &&
  Number.isInteger(selectedCell.col) &&
  selectedCell.row >= 0 &&
  selectedCell.col >= 0 &&
  selectedCell.row < dimensions.height &&
  selectedCell.col < dimensions.width;

const summarizeSamples = (value: unknown): WorkbookSampleSummary | undefined => {
  const parsed = parseSampledDistributionValue(value);
  const samples = parsed?.samples ?? getSamplesFromDistribution(value);

  if (!samples || samples.length === 0) {
    return undefined;
  }

  const sorted = [...samples].sort((a, b) => a - b);
  const mean =
    parsed?.mean ??
    samples.reduce((sum, sample) => sum + sample, 0) / samples.length;
  const standardDeviation =
    parsed?.std ??
    Math.sqrt(
      samples.reduce((sum, sample) => sum + Math.pow(sample - mean, 2), 0) /
        samples.length,
    );

  return {
    sampleCount: samples.length,
    mean: round6(mean),
    standardDeviation: round6(standardDeviation),
    p10: round6(percentileFromSorted(sorted, 10)),
    p50: round6(percentileFromSorted(sorted, 50)),
    p90: round6(percentileFromSorted(sorted, 90)),
  };
};

const getCellKind = (
  value: unknown,
  distribution: ReturnType<typeof parseDistributionValue>,
  sampleSummary: WorkbookSampleSummary | undefined,
): WorkbookCellKind => {
  if (distribution) {
    return "distribution";
  }
  if (isSampledDistributionValue(value) || sampleSummary) {
    return "sampled_distribution";
  }
  if (typeof value === "number") {
    return "scalar";
  }
  if (typeof value === "string") {
    return "text";
  }
  if (typeof value === "boolean") {
    return "boolean";
  }
  if (value instanceof Error) {
    return "error";
  }
  if (value && typeof value === "object") {
    if (
      "message" in value &&
      typeof (value as { message?: unknown }).message === "string"
    ) {
      return "error";
    }
    return "unknown_object";
  }
  return "text";
};

const serializeCellValue = (
  value: unknown,
  distribution: ReturnType<typeof parseDistributionValue>,
  sampleSummary: WorkbookSampleSummary | undefined,
): string => {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (distribution) {
    switch (distribution.kind) {
      case "normal":
        return distribution.source === "ci"
          ? `N.CI(${distribution.lower}, ${distribution.upper}${formatConfidenceFormulaSuffix(distribution.confidenceLevel)})`
          : `N(${distribution.mean}, ${distribution.variance})`;
      case "lognormal":
        return distribution.source === "ci"
          ? `LN.CI(${distribution.lower}, ${distribution.upper}${formatConfidenceFormulaSuffix(distribution.confidenceLevel)})`
          : `LN(${distribution.mu}, ${distribution.sigma})`;
      case "uniform":
        return `U(${distribution.min}, ${distribution.max})`;
    }
  }
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
  minimumDimensions,
}: BuildWorkbookSnapshotInput): WorkbookSnapshot => {
  const engineDimensions = formulaEngine.getSheetDimensions(0);
  const dimensions = minimumDimensions
    ? {
        width: Math.max(engineDimensions.width, minimumDimensions.width),
        height: Math.max(engineDimensions.height, minimumDimensions.height),
      }
    : engineDimensions;
  const cells: WorkbookCellSnapshot[] = [];
  let totalNonEmptyCellCount = 0;
  const cellLimit = Math.max(0, Math.floor(maxCells));

  for (let row = 0; row < dimensions.height; row += 1) {
    for (let col = 0; col < dimensions.width; col += 1) {
      const address = { sheet: 0, row, col };
      const formula = formulaEngine.getCellFormula(address) ?? null;
      const value = formulaEngine.getCellValue(address);

      if (isBlankCell(value, formula)) {
        continue;
      }

      totalNonEmptyCellCount += 1;
      if (cells.length >= cellLimit) {
        continue;
      }

      const distribution = parseDistributionValue(value);
      const sampleSummary = summarizeSamples(value);

      cells.push({
        address: cellAddressToA1(row, col),
        row,
        col,
        formula,
        displayValue: serializeCellValue(value, distribution, sampleSummary),
        kind: getCellKind(value, distribution, sampleSummary),
        distribution: distribution
          ? {
              kind: distribution.kind,
              source: distribution.source,
              mean: distribution.mean,
              variance: distribution.variance,
              mu: distribution.mu,
              sigma: distribution.sigma,
              min: distribution.min,
              max: distribution.max,
              lower: distribution.lower,
              upper: distribution.upper,
              confidenceLevel: distribution.confidenceLevel,
            }
          : undefined,
        sampleSummary,
      });
    }
  }

  return {
    sheetName: resolveSheetName(formulaEngine),
    dimensions,
    selectedCell:
      selectedCell && isSelectedCellInBounds(selectedCell, dimensions)
        ? cellAddressToA1(selectedCell.row, selectedCell.col)
        : null,
    cells,
    includedCellCount: cells.length,
    totalNonEmptyCellCount,
    truncated: totalNonEmptyCellCount > cells.length,
  };
};
