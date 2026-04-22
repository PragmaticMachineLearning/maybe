export type DistributionKind = 'normal' | 'lognormal' | 'uniform'

export interface ParsedDistribution {
  kind: DistributionKind
  source: 'parameters' | 'ci'
  mean?: number
  variance?: number
  mu?: number
  sigma?: number
  min?: number
  max?: number
  lower?: number
  upper?: number
  confidenceLevel?: number
}

const isDistributionKind = (value: unknown): value is DistributionKind =>
  value === 'normal' || value === 'lognormal' || value === 'uniform'

export const parseDistributionValue = (val: unknown): ParsedDistribution | null => {
  if (!val || typeof val !== 'object') {
    return null
  }

  const obj = val as Record<string, unknown>

  if (isDistributionKind(obj.kind)) {
    return {
      kind: obj.kind,
      source: obj.source === 'ci' ? 'ci' : 'parameters',
      mean: typeof obj.mean === 'number' ? obj.mean : undefined,
      variance: typeof obj.variance === 'number' ? obj.variance : undefined,
      mu: typeof obj.mu === 'number' ? obj.mu : undefined,
      sigma: typeof obj.sigma === 'number' ? obj.sigma : undefined,
      min: typeof obj.min === 'number' ? obj.min : undefined,
      max: typeof obj.max === 'number' ? obj.max : undefined,
      lower: typeof obj.lower === 'number' ? obj.lower : undefined,
      upper: typeof obj.upper === 'number' ? obj.upper : undefined,
      confidenceLevel: typeof obj.confidenceLevel === 'number'
        ? obj.confidenceLevel
        : undefined,
    }
  }

  if (obj.kind === 'distribution' && isDistributionKind(obj.distribution)) {
    return {
      kind: obj.distribution,
      source: obj.source === 'ci' ? 'ci' : 'parameters',
      mean: typeof obj.mean === 'number' ? obj.mean : undefined,
      variance: typeof obj.variance === 'number' ? obj.variance : undefined,
      mu: typeof obj.mu === 'number' ? obj.mu : undefined,
      sigma: typeof obj.sigma === 'number' ? obj.sigma : undefined,
      min: typeof obj.min === 'number' ? obj.min : undefined,
      max: typeof obj.max === 'number' ? obj.max : undefined,
      lower: typeof obj.lower === 'number' ? obj.lower : undefined,
      upper: typeof obj.upper === 'number' ? obj.upper : undefined,
      confidenceLevel: typeof obj.confidenceLevel === 'number'
        ? obj.confidenceLevel
        : undefined,
    }
  }

  return null
}

export const isDistributionValue = (val: unknown): boolean =>
  parseDistributionValue(val) !== null

export const confidenceLevelToFormulaArgument = (
  confidenceLevel: number,
): number => confidenceLevel > 1 ? confidenceLevel / 100 : confidenceLevel

type SampledDistributionLike = {
  samples?: unknown
  getSamples?: () => number[]
  getMean?: () => number
  getVariance?: () => number
}

const getSampleArray = (val: unknown): number[] | null => {
  if (!val || typeof val !== 'object') {
    return null
  }

  const sampled = val as SampledDistributionLike
  if (typeof sampled.getSamples === 'function') {
    return sampled.getSamples()
  }

  return Array.isArray(sampled.samples) ? sampled.samples as number[] : null
}

export const isSampledDistributionValue = (val: unknown): boolean => {
  return getSampleArray(val) !== null
}

export const parseSampledDistributionValue = (val: unknown): { samples: number[]; mean: number; std: number } | null => {
  const samples = getSampleArray(val)
  if (!samples) {
    return null
  }

  if (!samples.length) {
    return { samples, mean: 0, std: 0 }
  }

  const sampled = val as SampledDistributionLike
  const mean = typeof sampled.getMean === 'function'
    ? sampled.getMean()
    : samples.reduce((a, b) => a + b, 0) / samples.length
  const variance = typeof sampled.getVariance === 'function'
    ? sampled.getVariance()
    : samples.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / samples.length
  const std = Math.sqrt(variance)
  return { samples, mean, std }
}

export const getSamplesFromDistribution = (val: unknown): number[] | null => {
  const sampledSamples = getSampleArray(val)
  if (sampledSamples) {
    return sampledSamples
  }

  if (isDistributionValue(val) && val && typeof val === 'object' && 'toSamples' in (val as Record<string, unknown>) && typeof (val as { toSamples: () => number[] }).toSamples === 'function') {
    try {
      return (val as { toSamples: () => number[] }).toSamples()
    } catch (error) {
      console.error('Error calling distribution toSamples:', error)
    }
  }

  return null
}
