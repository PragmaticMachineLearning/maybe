import type { VisualDependencyNodeValue } from '../../types/visualDependencyGraph'

const formatNumber = (value: number): string => value.toFixed(2)

export const formatVisualDependencyValue = (value: VisualDependencyNodeValue): string => {
  switch (value.kind) {
    case 'scalar':
      return Number.isInteger(value.value) ? `${value.value}` : formatNumber(value.value)
    case 'confidence_interval':
      return `CI[${formatNumber(value.lower)}, ${formatNumber(value.upper)}]`
    case 'sampled_distribution':
      return `S(μ=${formatNumber(value.mean)}, σ=${formatNumber(Math.sqrt(value.variance))})`
  }
}
