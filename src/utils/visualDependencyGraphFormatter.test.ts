import { describe, expect, it } from 'vitest'

import { formatVisualDependencyValue } from './visualDependencyGraphFormatter'

describe('formatVisualDependencyValue', () => {
  it('formats scalar values', () => {
    expect(formatVisualDependencyValue({ kind: 'scalar', value: 42 })).toBe('42')
  })

  it('formats confidence intervals', () => {
    expect(
      formatVisualDependencyValue({
        kind: 'confidence_interval',
        lower: 10,
        upper: 20,
        confidenceLevel: 95,
        interpretation: 'normal',
      }),
    ).toBe('CI[10.00, 20.00]')
  })

  it('formats sampled distributions from summary stats', () => {
    expect(
      formatVisualDependencyValue({
        kind: 'sampled_distribution',
        mean: 5,
        variance: 4,
      }),
    ).toBe('S(μ=5.00, σ²=4.00)')
  })
})
