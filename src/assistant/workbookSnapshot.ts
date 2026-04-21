import type { FormulaEngine } from "../lib/formulaEngine";
import {
  getSamplesFromDistribution,
  isSampledDistributionValue,
  parseConfidenceIntervalValue,
  parseSampledDistributionValue,
} from "../utils/distribution/distributionUtils";
import { percentileFromSorted } from "../utils/distribution/distributionMath";
import { cellAddressToA1 } from "./address";
import type { SheetDimensions, ZeroBasedCellAddress } from "./address";

export type { SheetDimensions, ZeroBasedCellAddress };

export interface SelectedCell extends ZeroBasedCellAddress {}

export type WorkbookCellKind =
  | "scalar"
  | "text"
  | "boolean"
  | "confidence_interval"
  | "sampled_distribution"
  | "error"
  | "unknown_object";

export interface WorkbookConfidenceIntervalSummary {
  lower: number;
  upper: number;
  confidenceLevel: number;
  interpretation: string;
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
  confidenceInterval?: WorkbookConfidenceIntervalSummary;
  sampleSummary?: WorkbookSampleSummary;
}

export interface WorkbookSnapshot {
  sheetName: "Sheet1";
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
}

const DEFAULT_MAX_CELLS = 200;

const isBlankCell = (value: unknown, formula: string | null): boolean =>
  formula == null && (value === null || value === undefined || value === "");

const round6 = (value: number): number => Number(value.toFixed(6));

const summarizeSamples = (value: unknown): WorkbookSampleSummary | undefined => {
  const parsed = parseSampledDistributionValue(value);
  const samples = parsed?.samples ?? getSamplesFromDistribution(value);

  if (!samples || samples.length === 0) {
    return undefined;
  }

  const sorted = [...samples].sort((a, b) => a - b);
  const mean =
    samples.reduce((sum, sample) => sum + sample, 0) / samples.length;
  const variance =
    samples.reduce((sum, sample) => sum + Math.pow(sample - mean, 2), 0) /
    samples.length;

  return {
    sampleCount: samples.length,
    mean: round6(mean),
    standardDeviation: round6(Math.sqrt(variance)),
    p10: round6(percentileFromSorted(sorted, 10)),
    p50: round6(percentileFromSorted(sorted, 50)),
    p90: round6(percentileFromSorted(sorted, 90)),
  };
};

const getCellKind = (
  value: unknown,
  confidenceInterval: ReturnType<typeof parseConfidenceIntervalValue>,
  sampleSummary: WorkbookSampleSummary | undefined,
): WorkbookCellKind => {
  if (confidenceInterval) {
    return "confidence_interval";
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
  confidenceInterval: ReturnType<typeof parseConfidenceIntervalValue>,
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
  if (confidenceInterval) {
    return `CI[${confidenceInterval.lower}, ${confidenceInterval.upper}]`;
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
}: BuildWorkbookSnapshotInput): WorkbookSnapshot => {
  const dimensions = formulaEngine.getSheetDimensions(0);
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

      const confidenceInterval = parseConfidenceIntervalValue(value);
      const sampleSummary = summarizeSamples(value);

      cells.push({
        address: cellAddressToA1(row, col),
        row,
        col,
        formula,
        displayValue: serializeCellValue(value, confidenceInterval, sampleSummary),
        kind: getCellKind(value, confidenceInterval, sampleSummary),
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
