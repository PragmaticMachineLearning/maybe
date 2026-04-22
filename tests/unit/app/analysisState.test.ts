import { describe, expect, it } from 'vitest'

import { deriveAnalysisState, getColumnName } from '../../../src/app/analysisState'

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
      }),
    ).toMatchObject({
      cellLabel: 'A1',
      samples: null,
      distributionType: 'normal',
    })
  })

  it('uses explicit distribution kind when present', () => {
    const formulaEngine = {
      getCellValue: () => ({
        kind: 'lognormal',
        source: 'parameters',
        mu: 0,
        sigma: 0.2,
        toSamples: () => [1, 1.1, 1.2],
      }),
    }

    expect(
      deriveAnalysisState({
        analysisMode: true,
        formulaEngine,
        selectedCell: { row: 2, col: 0 },
      }),
    ).toMatchObject({
      cellLabel: 'A3',
      samples: [1, 1.1, 1.2],
      distributionType: 'lognormal',
    })
  })
})
