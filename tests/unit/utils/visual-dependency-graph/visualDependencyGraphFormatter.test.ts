import { describe, expect, it } from 'vitest'

import { formatVisualDependencyValue } from '../../../../src/utils/visual-dependency-graph/visualDependencyGraphFormatter'

describe('formatVisualDependencyValue', () => {
  it('formats scalar values', () => {
    expect(formatVisualDependencyValue({ kind: 'scalar', value: 42 })).toBe('42')
  })

  it('formats sampled distributions from summary stats', () => {
    expect(
      formatVisualDependencyValue({
        kind: 'sampled_distribution',
        mean: 5,
        variance: 4,
      }),
    ).toBe('sampled μ=5.00 σ=2.00')
  })

  it('formats explicit distributions', () => {
    expect(
      formatVisualDependencyValue({
        kind: 'distribution',
        distribution: 'normal',
        source: 'ci',
        lower: 10,
        upper: 20,
        confidenceLevel: 95,
      }),
    ).toBe('N.CI(10.00, 20.00)')

    expect(
      formatVisualDependencyValue({
        kind: 'distribution',
        distribution: 'normal',
        source: 'ci',
        lower: 10,
        upper: 20,
        confidenceLevel: 90,
      }),
    ).toBe('N.CI(10.00, 20.00, 0.9)')

    expect(
      formatVisualDependencyValue({
        kind: 'distribution',
        distribution: 'uniform',
        source: 'parameters',
        min: 10,
        max: 20,
      }),
    ).toBe('U(10.00, 20.00)')
  })
})
