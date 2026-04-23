import { describe, expect, it } from 'vitest'

import {
  formatCellEditValue,
  formatCellValue,
} from '../../../../src/components/spreadsheet/cellFormatting'

const sampledValue = {
  samples: [1, 2, 3],
  mean: 99,
  std: 99,
} satisfies {
  samples: number[]
  mean: number
  std: number
}

describe('formatCellValue', () => {
  it('formats primitive values', () => {
    expect(formatCellValue(null)).toBe('')
    expect(formatCellValue(true)).toBe('TRUE')
    expect(formatCellValue(false)).toBe('FALSE')
    expect(formatCellValue(123)).toBe('123')
    expect(formatCellValue('abc')).toBe('abc')
  })

  it('formats explicit distributions', () => {
    expect(
      formatCellValue(
        {
          kind: 'normal',
          source: 'parameters',
          mean: 10,
          variance: 4,
        },
      ),
    ).toBe('N μ=10 σ²=4')

    expect(
      formatCellValue(
        {
          kind: 'normal',
          source: 'ci',
          lower: 10,
          upper: 20,
          confidenceLevel: 95,
        },
      ),
    ).toBe('N 95% CI [10, 20]')

    expect(
      formatCellValue(
        {
          kind: 'lognormal',
          source: 'ci',
          lower: 1,
          upper: 2,
          confidenceLevel: 95,
        },
      ),
    ).toBe('LN 95% CI [1, 2]')

    expect(
      formatCellValue(
        {
          kind: 'uniform',
          source: 'parameters',
          min: 1,
          max: 2,
        },
      ),
    ).toBe('U [1, 2]')
  })

  it('formats explicit distributions as editable formulas', () => {
    expect(
      formatCellEditValue(
        {
          kind: 'lognormal',
          source: 'ci',
          lower: 1,
          upper: 2,
          confidenceLevel: 95,
        },
      ),
    ).toBe('LN.CI(1.00, 2.00)')

    expect(
      formatCellEditValue(
        {
          kind: 'lognormal',
          source: 'ci',
          lower: 1,
          upper: 2,
          confidenceLevel: 90,
        },
      ),
    ).toBe('LN.CI(1.00, 2.00, 0.9)')
  })

  it('preserves small CI bounds in editable formulas', () => {
    expect(
      formatCellEditValue(
        {
          kind: 'normal',
          source: 'ci',
          lower: 0.009,
          upper: 0.011,
          confidenceLevel: 95,
        },
      ),
    ).toBe('N.CI(0.009, 0.011)')
  })

  it('formats sampled distributions', () => {
    expect(
      formatCellValue(sampledValue),
    ).toBe('S(μ=2.00, σ=0.82)')
  })
})
