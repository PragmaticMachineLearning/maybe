import { describe, expect, it } from 'vitest'

import { formatCellValue } from './cellFormatting'

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
    expect(formatCellValue(null, { type: 'normal' })).toBe('')
    expect(formatCellValue(true, { type: 'normal' })).toBe('TRUE')
    expect(formatCellValue(false, { type: 'normal' })).toBe('FALSE')
    expect(formatCellValue(123, { type: 'normal' })).toBe('123')
    expect(formatCellValue('abc', { type: 'normal' })).toBe('abc')
  })

  it('formats normal confidence intervals', () => {
    expect(
      formatCellValue(
        { lower: 10, upper: 20, confidenceLevel: 95 },
        { type: 'normal' },
      ),
    ).toBe('N(μ=15.00, σ=2.55)')
  })

  it('formats uniform confidence intervals', () => {
    expect(
      formatCellValue(
        { lower: 10, upper: 20, confidenceLevel: 95 },
        { type: 'uniform' },
      ),
    ).toBe('U[10.00, 20.00]')
  })

  it('formats sampled distributions', () => {
    expect(
      formatCellValue(sampledValue, { type: 'normal' }),
    ).toBe('S(μ=2.00, σ=0.82)')
  })
})
