import {
  getSamplesFromDistribution,
  isConfidenceIntervalValue,
  isSampledDistributionValue,
  parseConfidenceIntervalValue,
  type ParsedConfidenceInterval,
} from '../utils/distribution/distributionUtils'
import type { DistributionViewType } from '../context/SpreadsheetContext'

export type DistributionType = 'normal' | 'lognormal' | 'uniform' | 'sampled'

export interface SelectedCell {
  row: number
  col: number
}

export interface AnalysisState {
  cellLabel: string
  samples: number[] | null
  distributionType: DistributionType
  confidenceInterval?: ParsedConfidenceInterval | null
  message?: string
}

interface FormulaValueReader {
  getCellValue(address: { sheet: number; row: number; col: number }): unknown
}

interface DeriveAnalysisStateInput {
  analysisMode: boolean
  formulaEngine: FormulaValueReader | null
  selectedCell: SelectedCell | null
  getDistributionView: (row: number, col: number) => DistributionViewType | null
}

export const getColumnName = (index: number): string => {
  let result = ''
  let num = index
  while (num >= 0) {
    result = String.fromCharCode((num % 26) + 65) + result
    num = Math.floor(num / 26) - 1
  }
  return result
}

export const deriveAnalysisState = ({
  analysisMode,
  formulaEngine,
  selectedCell,
  getDistributionView,
}: DeriveAnalysisStateInput): AnalysisState | null => {
  if (!analysisMode || !formulaEngine || !selectedCell) {
    return null
  }

  const cellLabel = `${getColumnName(selectedCell.col)}${selectedCell.row + 1}`
  const value = formulaEngine.getCellValue({
    sheet: 0,
    row: selectedCell.row,
    col: selectedCell.col,
  })

  const hasDistribution =
    isConfidenceIntervalValue(value) || isSampledDistributionValue(value)

  if (!hasDistribution) {
    return {
      cellLabel,
      samples: null,
      distributionType: 'normal',
      confidenceInterval: null,
      message:
        'Select a cell containing uncertainty (CI[lower, upper] inputs or simulated outputs) to inspect its distribution.',
    }
  }

  const confidenceInterval = parseConfidenceIntervalValue(value)
  const samples = getSamplesFromDistribution(value)
  const viewOverride = getDistributionView(selectedCell.row, selectedCell.col)

  let distributionType: DistributionType = 'normal'
  if (viewOverride) {
    distributionType = viewOverride
  } else if (confidenceInterval?.interpretation === 'lognormal') {
    distributionType = 'lognormal'
  } else if (confidenceInterval?.interpretation === 'uniform') {
    distributionType = 'uniform'
  } else if (!confidenceInterval && isSampledDistributionValue(value)) {
    distributionType = 'sampled'
  }

  if (!samples || samples.length === 0) {
    return {
      cellLabel,
      samples: null,
      distributionType,
      confidenceInterval,
      message:
        'Unable to generate samples for this cell. Ensure the value exposes samples or a confidence interval.',
    }
  }

  return {
    cellLabel,
    samples,
    distributionType,
    confidenceInterval,
  }
}
