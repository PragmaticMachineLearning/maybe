import { describe, expect, it } from 'vitest'

import { deriveAnalysisState, getColumnName } from './analysisState'

describe('analysisState', () => {
  it('formats spreadsheet column labels', () => {
    expect(getColumnName(0)).toBe('A')
    expect(getColumnName(25)).toBe('Z')
    expect(getColumnName(26)).toBe('AA')
    expect(getColumnName(27)).toBe('AB')
  })

  it('returns null when analysis mode is off', () => {
    expect(
      deriveAnalysisState({
        analysisMode: false,
        formulaEngine: null,
        selectedCell: { row: 0, col: 0 },
        getDistributionView: () => null,
      }),
    ).toBeNull()
  })

  it('returns a prompt message for non-distribution cells', () => {
    const formulaEngine = {
      getCellValue: () => 42,
    }

    expect(
      deriveAnalysisState({
        analysisMode: true,
        formulaEngine,
        selectedCell: { row: 0, col: 0 },
        getDistributionView: () => null,
      }),
    ).toMatchObject({
      cellLabel: 'A1',
      samples: null,
      distributionType: 'normal',
      confidenceInterval: null,
    })
  })

  it('respects distribution view overrides for confidence interval cells', () => {
    const formulaEngine = {
      getCellValue: () => ({
        lower: 10,
        upper: 20,
        confidenceLevel: 95,
        samples: [10, 15, 20],
      }),
    }

    expect(
      deriveAnalysisState({
        analysisMode: true,
        formulaEngine,
        selectedCell: { row: 1, col: 1 },
        getDistributionView: () => 'uniform',
      }),
    ).toMatchObject({
      cellLabel: 'B2',
      samples: [10, 15, 20],
      distributionType: 'uniform',
    })
  })
})
