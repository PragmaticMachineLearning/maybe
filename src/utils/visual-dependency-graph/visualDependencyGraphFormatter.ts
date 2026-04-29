import type { VisualDependencyNodeValue } from '../../types/visualDependencyGraph'
import { formatConfidenceFormulaSuffix } from '../distribution/distributionUtils'

const formatNumber = (value: number): string => value.toFixed(2)

export const formatVisualDependencyValue = (value: VisualDependencyNodeValue): string => {
  switch (value.kind) {
    case 'scalar':
      return Number.isInteger(value.value) ? `${value.value}` : formatNumber(value.value)
    case 'distribution':
      switch (value.distribution) {
        case 'normal':
          return value.source === 'ci'
            ? `N.CI(${formatNumber(value.lower ?? 0)}, ${formatNumber(value.upper ?? 0)}${formatConfidenceFormulaSuffix(value.confidenceLevel)})`
            : `N(μ=${formatNumber(value.mean ?? 0)}, σ²=${formatNumber(value.variance ?? 0)})`
        case 'lognormal':
          return value.source === 'ci'
            ? `LN.CI(${formatNumber(value.lower ?? 0)}, ${formatNumber(value.upper ?? 0)}${formatConfidenceFormulaSuffix(value.confidenceLevel)})`
            : `LN(μ=${formatNumber(value.mu ?? 0)}, σ=${formatNumber(value.sigma ?? 0)})`
        case 'uniform':
          return `U(${formatNumber(value.min ?? 0)}, ${formatNumber(value.max ?? 0)})`
      }
      return ''
    case 'sampled_distribution':
      return `sampled μ=${formatNumber(value.mean)} σ=${formatNumber(Math.sqrt(value.variance))}`
  }
}
