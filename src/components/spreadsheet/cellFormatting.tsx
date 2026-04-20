/* eslint-disable react-refresh/only-export-components */

import React from 'react'

import {
  getConfidenceIntervalMedian,
  isConfidenceIntervalValue,
  isSampledDistributionValue,
  parseConfidenceIntervalValue,
  parseSampledDistributionValue,
  zScoreForConfidence,
} from '../../utils/distribution/distributionUtils'

export interface DistributionViewOptions {
  type: 'normal' | 'lognormal' | 'uniform'
}

export type CellValue =
  | string
  | number
  | boolean
  | number[]
  | null
  | undefined
  | { samples: number[] }
  | { mean: number; variance: number }
  | { lower: number; upper: number; confidenceLevel: number }

export const BooleanIcon: React.FC<{ value: boolean }> = ({ value }) => (
  <svg
    width={16}
    height={16}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <circle
      cx="12"
      cy="12"
      r="9"
      stroke="var(--border-header)"
      strokeWidth="1.5"
    />
    {value ? (
      <path
        d="M9 12.5L11 14.5L15 9.5"
        stroke="var(--resize-handle-active)"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ) : (
      <>
        <path
          d="M9 9L15 15"
          stroke="var(--text-muted)"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
        <path
          d="M15 9L9 15"
          stroke="var(--text-muted)"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </>
    )}
  </svg>
)

export const MicroSparkline: React.FC<{
  type: 'normal' | 'lognormal' | 'uniform' | 'sampled'
  color: string
}> = ({ type, color }) => {
  const getPath = () => {
    switch (type) {
      case 'normal':
        return 'M0,14 C4,14 6,12 8,8 C10,4 11,1 14,1 C17,1 18,4 20,8 C22,12 24,14 28,14'
      case 'lognormal':
        return 'M0,14 C2,14 3,13 5,8 C6,5 7,1 9,1 C11,1 13,4 16,8 C19,11 22,13 28,14'
      case 'uniform':
        return 'M0,14 L0,14 L4,14 L4,3 L24,3 L24,14 L28,14'
      case 'sampled':
        return 'M0,14 L3,12 L6,8 L9,10 L12,4 L14,2 L16,3 L19,7 L22,10 L25,12 L28,14'
      default:
        return 'M0,14 L28,14'
    }
  }

  return (
    <svg
      width={28}
      height={14}
      viewBox="0 0 28 14"
      style={{ flexShrink: 0, opacity: 0.7 }}
      aria-hidden="true"
    >
      <path
        d={getPath()}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export const formatCellValue = (
  val: CellValue,
  options: DistributionViewOptions,
): string => {
  if (val === null || val === undefined) return ''

  if (typeof val === 'boolean') {
    return val ? 'TRUE' : 'FALSE'
  }

  if (typeof val === 'string' || typeof val === 'number') {
    return String(val)
  }

  if (isConfidenceIntervalValue(val)) {
    const ci = parseConfidenceIntervalValue(val)
    if (ci) {
      const median = getConfidenceIntervalMedian(ci)

      switch (options.type) {
        case 'normal': {
          const mean = (ci.lower + ci.upper) / 2
          const zScore = zScoreForConfidence(ci.confidenceLevel)
          const std = (ci.upper - ci.lower) / (2 * zScore)
          return `N(μ=${mean.toFixed(2)}, σ=${std.toFixed(2)})`
        }
        case 'lognormal':
          if (ci.lower > 0 && ci.upper > 0) {
            const lnLower = Math.log(ci.lower)
            const lnUpper = Math.log(ci.upper)
            const mu = (lnLower + lnUpper) / 2
            const sigma = (lnUpper - lnLower) / 3.29
            return `LN(μ=${mu.toFixed(2)}, σ=${sigma.toFixed(2)})`
          }
          return `${median.toFixed(2)} [${ci.lower}-${ci.upper}]`
        case 'uniform':
          return `U[${ci.lower.toFixed(2)}, ${ci.upper.toFixed(2)}]`
        default:
          return `${median.toFixed(2)} [${ci.lower}-${ci.upper}]`
      }
    }
  }

  if (isSampledDistributionValue(val)) {
    const sampled = parseSampledDistributionValue(val)
    if (sampled) {
      return `S(μ=${sampled.mean.toFixed(2)}, σ=${sampled.std.toFixed(2)})`
    }
  }

  return String(val)
}
