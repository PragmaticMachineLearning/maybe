import type { CIInterpretation } from '../../hyperformula/src/interpreter/InterpreterValue'

export interface ParsedConfidenceInterval {
  lower: number
  upper: number
  confidenceLevel: number
  interpretation?: CIInterpretation
}

export const isConfidenceIntervalValue = (val: unknown): boolean => {
  if (val && typeof val === 'object' && 'lower' in (val as Record<string, unknown>) && 'upper' in (val as Record<string, unknown>) && 'confidenceLevel' in (val as Record<string, unknown>)) {
    return true
  }

  if (typeof val === 'string') {
    return /^\d+\.?\d*\s+to\s+\d+\.?\d*$/.test(val) || (val.startsWith('CI[') && val.endsWith(']'))
  }

  return false
}

export const parseConfidenceIntervalValue = (val: unknown): ParsedConfidenceInterval | null => {
  if (val && typeof val === 'object' && 'lower' in val && 'upper' in val && 'confidenceLevel' in val) {
    const ciVal = val as { lower: number; upper: number; confidenceLevel: number; interpretation?: CIInterpretation }
    return {
      lower: ciVal.lower,
      upper: ciVal.upper,
      confidenceLevel: ciVal.confidenceLevel,
      interpretation: ciVal.interpretation ?? 'normal',
    }
  }

  if (typeof val === 'string') {
    let match = val.match(/^(\d+\.?\d*)\s+to\s+(\d+\.?\d*)$/)
    if (match) {
      return {
        lower: parseFloat(match[1]),
        upper: parseFloat(match[2]),
        confidenceLevel: 95,
        interpretation: 'normal',
      }
    }

    match = val.match(/^CI\[(\-?\d+\.?\d*),\s*(\-?\d+\.?\d*)\]$/)
    if (match) {
      return {
        lower: parseFloat(match[1]),
        upper: parseFloat(match[2]),
        confidenceLevel: 95,
        interpretation: 'normal',
      }
    }
  }

  return null
}

export const isSampledDistributionValue = (val: unknown): boolean => {
  return Boolean(val && typeof val === 'object' && 'samples' in (val as Record<string, unknown>) && Array.isArray((val as { samples?: unknown }).samples))
}

export const parseSampledDistributionValue = (val: unknown): { samples: number[]; mean: number; std: number } | null => {
  if (val && typeof val === 'object' && 'samples' in (val as Record<string, unknown>) && Array.isArray((val as { samples: unknown[] }).samples)) {
    const samples = (val as { samples: number[] }).samples
    if (!samples.length) {
      return { samples, mean: 0, std: 0 }
    }

    const mean = samples.reduce((a, b) => a + b, 0) / samples.length
    const variance = samples.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / samples.length
    const std = Math.sqrt(variance)
    return { samples, mean, std }
  }
  return null
}

export const getSamplesFromDistribution = (val: unknown): number[] | null => {
  if (isSampledDistributionValue(val)) {
    return ((val as { samples: number[] }).samples)
  }

  if (val && typeof val === 'object' && 'toSamples' in (val as Record<string, unknown>) && typeof (val as { toSamples: () => number[] }).toSamples === 'function') {
    try {
      return (val as { toSamples: () => number[] }).toSamples()
    } catch (error) {
      console.error('Error calling toSamples:', error)
    }
  }

  return null
}

export const getConfidenceIntervalMedian = (ci: Pick<ParsedConfidenceInterval, 'lower' | 'upper' | 'interpretation'>): number => {
  switch (ci.interpretation) {
    case 'lognormal':
      return Math.sqrt(ci.lower * ci.upper)
    case 'uniform':
    case 'normal':
    default:
      return (ci.lower + ci.upper) / 2
  }
}

export const zScoreForConfidence = (confidenceLevel: number): number => {
  if (confidenceLevel >= 99.9) return 3.29;
  if (confidenceLevel >= 99) return 2.576;
  if (confidenceLevel >= 98) return 2.326;
  if (confidenceLevel >= 95) return 1.96;
  if (confidenceLevel >= 90) return 1.645;
  if (confidenceLevel >= 80) return 1.282;
  if (confidenceLevel >= 70) return 1.036;
  return 1.0;
}

