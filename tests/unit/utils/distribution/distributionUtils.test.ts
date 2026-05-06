import { describe, expect, it } from 'bun:test'

import {
  getSamplesFromDistribution,
  isSampledDistributionValue,
  parseSampledDistributionValue,
} from '../../../../src/utils/distribution/distributionUtils'

describe('distributionUtils', () => {
  it('uses sampled distribution summary methods when available', () => {
    const sampled = {
      samples: [1, 2, 100],
      getMean: () => 42,
      getVariance: () => 9,
    }

    expect(parseSampledDistributionValue(sampled)).toEqual({
      samples: [1, 2, 100],
      mean: 42,
      std: 3,
    })
  })

  it('uses sampled distribution getSamples when available', () => {
    const sampled = {
      samples: [100],
      getSamples: () => [1, 2, 3],
    }

    expect(isSampledDistributionValue(sampled)).toBe(true)
    expect(getSamplesFromDistribution(sampled)).toEqual([1, 2, 3])
    expect(parseSampledDistributionValue(sampled)).toEqual({
      samples: [1, 2, 3],
      mean: 2,
      std: Math.sqrt(2 / 3),
    })
  })

  it('falls back to computing summaries for plain sampled objects', () => {
    const sampled = {
      samples: [1, 2, 3],
    }

    expect(parseSampledDistributionValue(sampled)).toEqual({
      samples: [1, 2, 3],
      mean: 2,
      std: Math.sqrt(2 / 3),
    })
  })
})
