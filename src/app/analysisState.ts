import {
  getSamplesFromDistribution,
  isDistributionValue,
  isSampledDistributionValue,
  parseDistributionValue,
} from "../utils/distribution/distributionUtils";

type DistributionType = "normal" | "lognormal" | "uniform" | "sampled";

export interface SelectedCell {
  row: number;
  col: number;
}

interface AnalysisState {
  cellLabel: string;
  samples: number[] | null;
  distributionType: DistributionType;
  message?: string;
}

interface FormulaValueReader {
  getCellValue(address: { sheet: number; row: number; col: number }): unknown;
}

interface DeriveAnalysisStateInput {
  analysisMode: boolean;
  formulaEngine: FormulaValueReader | null;
  selectedCell: SelectedCell | null;
}

export const getColumnName = (index: number): string => {
  let result = "";
  let num = index;
  while (num >= 0) {
    result = String.fromCharCode((num % 26) + 65) + result;
    num = Math.floor(num / 26) - 1;
  }
  return result;
};

export const deriveAnalysisState = ({
  analysisMode,
  formulaEngine,
  selectedCell,
}: DeriveAnalysisStateInput): AnalysisState | null => {
  if (!analysisMode || !formulaEngine || !selectedCell) {
    return null;
  }

  const cellLabel = `${getColumnName(selectedCell.col)}${selectedCell.row + 1}`;
  const value = formulaEngine.getCellValue({
    sheet: 0,
    row: selectedCell.row,
    col: selectedCell.col,
  });

  const hasDistribution =
    isDistributionValue(value) ||
    isSampledDistributionValue(value);

  if (!hasDistribution) {
    return {
      cellLabel,
      samples: null,
      distributionType: "normal",
      message:
        "Select a cell containing uncertainty (N, LN, U, N.CI, LN.CI, or simulated outputs) to inspect its distribution.",
    };
  }

  const distribution = parseDistributionValue(value);
  const samples = getSamplesFromDistribution(value);

  let distributionType: DistributionType = "normal";
  if (distribution) {
    distributionType = distribution.kind;
  } else if (isSampledDistributionValue(value)) {
    distributionType = "sampled";
  }

  if (!samples || samples.length === 0) {
    return {
      cellLabel,
      samples: null,
      distributionType,
      message:
        "Unable to generate samples for this cell. Ensure the value exposes samples or an explicit distribution.",
    };
  }

  return {
    cellLabel,
    samples,
    distributionType,
  };
};
