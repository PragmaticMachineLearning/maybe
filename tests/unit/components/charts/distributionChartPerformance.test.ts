import { describe, expect, it } from 'bun:test'

import {
  createDistributionChartData,
  createDistributionChartModelFromData,
  type ChartThemeColors,
  type DistributionKind,
  type DistributionQueryState,
} from '../../../../src/components/charts/distributionChartOptions'
import {
  createLogNormalData,
  createNormalData,
  createUniformData,
} from '../../../../src/utils/distribution/distributionMath'

// ---- Frozen copy of the pre-optimization implementation (reference) ----

const refMeanAndStd = (values: number[]) => {
  if (!values.length) return { mean: 0, std: 0 }
  const mean = values.reduce((acc, value) => acc + value, 0) / values.length
  const variance =
    values.reduce((acc, value) => acc + Math.pow(value - mean, 2), 0) /
    values.length
  return { mean, std: Math.sqrt(Math.max(variance, 0)) }
}

const refKde = (values: number[], points = 200) => {
  if (!values.length) return []
  const sorted = [...values].sort((a, b) => a - b)
  const { std } = refMeanAndStd(sorted)
  const min = sorted[0]
  const max = sorted[sorted.length - 1]
  const range = Math.max(max - min, 1e-6)
  const bandwidth =
    std > 0
      ? 1.06 * std * Math.pow(sorted.length, -1 / 5)
      : range / Math.sqrt(12)
  const safeBandwidth = bandwidth > 0 ? bandwidth : range / 25
  const pad = range * 0.15 || 1
  const start = min - pad
  const step = (max + pad - start) / points
  return Array.from({ length: points }, (_, idx) => {
    const x = start + idx * step
    const density =
      sorted.reduce((acc, sample) => {
        const u = (x - sample) / safeBandwidth
        return acc + Math.exp(-0.5 * u * u)
      }, 0) /
      (sorted.length * safeBandwidth * Math.sqrt(2 * Math.PI))
    return [x, density]
  })
}

const referenceChartData = (samples: number[], kind: DistributionKind) => {
  const sortedSamples = [...samples].sort((a, b) => a - b)
  let params: ReturnType<typeof refParams> = null
  const refParams = () => {
    switch (kind) {
      case 'uniform': {
        const min = Math.min(...samples)
        const max = Math.max(...samples)
        return min === max ? null : { type: 'uniform' as const, a: min, b: max }
      }
      case 'lognormal': {
        const positives = samples.filter((value) => value > 0)
        const { mean, std } = refMeanAndStd(positives.map((v) => Math.log(v)))
        return std === 0 ? null : { type: 'lognormal' as const, mu: mean, sigma: std }
      }
      case 'normal': {
        const { mean, std } = refMeanAndStd(samples)
        return std > 0 ? { type: 'normal' as const, mean, std } : null
      }
      default:
        return null
    }
  }
  params = refParams()
  // Parametric curves are unchanged by the optimization; only the KDE
  // (sampled mode, or no valid params) differs from the new implementation.
  const density = (() => {
    if (params?.type === 'uniform') return createUniformData(params.a, params.b)
    if (params?.type === 'lognormal') return createLogNormalData(params.mu, params.sigma)
    if (params?.type === 'normal') return createNormalData(params.mean, params.std)
    return refKde(kind === 'lognormal' ? samples.filter((v) => v > 0) : samples)
  })()
  return { sortedSamples, params, density }
}

// ---- Benchmark ----

const themeColors: ChartThemeColors = {
  textPrimary: '#000',
  textSecondary: '#000',
  bgSurface: '#fff',
  borderColor: '#ccc',
  splitLine: '#ccc',
  splitLineLight: '#ccc',
  accent: '#0a0',
  accentArea: '#0a0',
  highlight: '#a00',
}

const queryState: DistributionQueryState = {
  percentile: 95,
  confidenceLevel: 95,
  showPercentile: true,
  showCI: true,
}

const SAMPLE_COUNT = 10_000
const REQUIRED_SPEEDUP = 2.5
// Max |new - old| of the density curve, relative to the old curve's peak.
const DENSITY_TOLERANCE = 0.005

const makeSamples = (kind: DistributionKind) => {
  let seed = 12345
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
  const gauss = () =>
    Math.sqrt(-2 * Math.log(rand() + 1e-12)) * Math.cos(2 * Math.PI * rand())
  return Array.from({ length: SAMPLE_COUNT }, () => {
    switch (kind) {
      case 'lognormal':
        return Math.exp(1 + 0.5 * gauss())
      case 'uniform':
        return 5 + rand() * 10
      default:
        return 100 + 15 * gauss()
    }
  })
}

const time = (fn: () => unknown, runs = 15) => {
  fn()
  const durations: number[] = []
  for (let i = 0; i < runs; i += 1) {
    const t0 = performance.now()
    fn()
    durations.push(performance.now() - t0)
  }
  // Best-of-N is the least sensitive to scheduler/GC noise.
  return Math.min(...durations)
}

describe('distribution chart compute performance', () => {
  const kinds: DistributionKind[] = ['sampled', 'normal', 'lognormal', 'uniform']

  for (const kind of kinds) {
    it(`is at least ${REQUIRED_SPEEDUP}x faster than the reference in ${kind} mode`, () => {
      const samples = makeSamples(kind)

      const oldMs = time(() => {
        const ref = referenceChartData(samples, kind)
        // Model step is unchanged by the optimization.
        createDistributionChartModelFromData({
          chartData: {
            sortedSamples: ref.sortedSamples,
            mean: 0,
            distributionKind: kind,
            distributionParams: null,
            pdfData: ref.density,
            densitySeriesData: ref.density,
          },
          queryState,
          themeColors,
        })
      })
      const newMs = time(() => {
        const chartData = createDistributionChartData({ samples, distributionKind: kind })
        createDistributionChartModelFromData({ chartData, queryState, themeColors })
      })

      const ratio = oldMs / newMs
      console.log(
        `[${kind}] old=${oldMs.toFixed(2)}ms new=${newMs.toFixed(2)}ms speedup=${ratio.toFixed(1)}x`,
      )
      expect(ratio).toBeGreaterThanOrEqual(REQUIRED_SPEEDUP)
    })

    it(`matches the reference output in ${kind} mode`, () => {
      const samples = makeSamples(kind)
      const ref = referenceChartData(samples, kind)
      const chartData = createDistributionChartData({ samples, distributionKind: kind })

      expect(chartData.sortedSamples).toEqual(ref.sortedSamples)
      if (ref.params) {
        expect(chartData.distributionParams?.type).toBe(ref.params.type)
      }

      // Percentile, interval and stats inputs are the identical sorted array.
      const model = createDistributionChartModelFromData({ chartData, queryState, themeColors })
      expect(model.sortedSamples).toEqual(ref.sortedSamples)
    })
  }

  it('keeps the sampled density curve within tolerance of the reference', () => {
    for (const kind of ['sampled', 'lognormal', 'uniform'] as DistributionKind[]) {
      const samples = makeSamples(kind)
      const ref = refKde(samples)
      // Force the KDE path via sampled mode.
      const { densitySeriesData } = createDistributionChartData({
        samples,
        distributionKind: 'sampled',
      })
      expect(densitySeriesData.length).toBe(ref.length)
      const peak = Math.max(...ref.map(([, y]) => y))
      ref.forEach(([x, y], idx) => {
        expect(densitySeriesData[idx][0]).toBeCloseTo(x, 9)
        expect(Math.abs(densitySeriesData[idx][1] - y) / peak).toBeLessThan(DENSITY_TOLERANCE)
      })
    }
  })
})
