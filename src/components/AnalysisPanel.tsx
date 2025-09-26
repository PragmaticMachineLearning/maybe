import React from 'react'

import type { ParsedConfidenceInterval } from '../utils/distributionUtils'
import { DistributionPlot } from './DistributionPlot'

interface AnalysisPanelProps {
  cellLabel: string
  samples: number[] | null
  distributionType: 'normal' | 'lognormal' | 'uniform' | 'sampled'
  confidenceInterval?: ParsedConfidenceInterval | null
  onClose: () => void
  message?: string
  compact?: boolean
}

const formatNumber = (value: number) => {
  if (!Number.isFinite(value)) {
    return '—'
  }
  if (Math.abs(value) >= 1000 || Math.abs(value) < 0.01) {
    return value.toExponential(2)
  }
  return value.toFixed(2)
}

const percentile = (sorted: number[], p: number) => {
  if (!sorted.length) {
    return NaN
  }
  const index = (p / 100) * (sorted.length - 1)
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  if (lower === upper) {
    return sorted[lower]
  }
  const weight = index - lower
  return sorted[lower] * (1 - weight) + sorted[upper] * weight
}

const buildSummary = (samples: number[]) => {
  if (!samples.length) {
    return null
  }
  const sorted = [...samples].sort((a, b) => a - b)
  const mean = samples.reduce((acc, value) => acc + value, 0) / samples.length
  const variance = samples.reduce((acc, value) => acc + Math.pow(value - mean, 2), 0) / samples.length
  const std = Math.sqrt(variance)
  return {
    mean,
    std,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    p10: percentile(sorted, 10),
    p50: percentile(sorted, 50),
    p90: percentile(sorted, 90),
  }
}

export const AnalysisPanel: React.FC<AnalysisPanelProps> = ({
  cellLabel,
  samples,
  distributionType,
  confidenceInterval,
  onClose,
  message,
  compact = false,
}) => {
  const summary = samples ? buildSummary(samples) : null

  return (
    <aside
      style={{
        width: compact ? '100%' : '320px',
        maxWidth: compact ? '100%' : '320px',
        flex: compact ? '1 1 auto' : '0 0 320px',
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        padding: '16px',
        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        maxHeight: compact ? 'none' : 'calc(100vh - 120px)',
        overflow: 'visible',
        boxSizing: 'border-box',
      }}
    >
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Analysis
          </div>
          <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>{cellLabel}</div>
        </div>
        <button
          onClick={onClose}
          style={{
            border: 'none',
            background: 'var(--bg-surface)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            borderRadius: '6px',
            width: '28px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title="Close analysis mode"
        >
          ×
        </button>
      </header>

      {message ? (
        <div
          style={{
            backgroundColor: 'var(--bg-muted)',
            borderRadius: '8px',
            padding: '12px',
            color: 'var(--text-secondary)',
            fontSize: '13px',
            lineHeight: 1.5,
          }}
        >
          {message}
        </div>
      ) : (
        <>
          {summary && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Mean</div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>{formatNumber(summary.mean)}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Std Dev</div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>{formatNumber(summary.std)}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>10th %</div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>{formatNumber(summary.p10)}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Median</div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>{formatNumber(summary.p50)}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>90th %</div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>{formatNumber(summary.p90)}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Range</div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {formatNumber(summary.min)} – {formatNumber(summary.max)}
                </div>
              </div>
            </div>
          )}

          {confidenceInterval && (
            <div
              style={{
                backgroundColor: 'var(--bg-muted)',
                borderRadius: '8px',
                padding: '12px',
                fontSize: '13px',
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
              }}
            >
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                {confidenceInterval.confidenceLevel}% CI
              </div>
              <div>
                {formatNumber(confidenceInterval.lower)} – {formatNumber(confidenceInterval.upper)}
                {confidenceInterval.interpretation ? ` (${confidenceInterval.interpretation})` : ''}
              </div>
            </div>
          )}

          {samples && samples.length > 0 && (
            <div style={{ flex: 1, minHeight: '200px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Distribution
              </div>
              <div style={{ flex: 1, minHeight: '200px' }}>
                <DistributionPlot
                  samples={samples}
                  onClose={onClose}
                  inline
                  distributionType={distributionType}
                  confidenceInterval={confidenceInterval ? {
                    lower: confidenceInterval.lower,
                    upper: confidenceInterval.upper,
                    confidenceLevel: confidenceInterval.confidenceLevel,
                  } : undefined}
                />
              </div>
            </div>
          )}
        </>
      )}
    </aside>
  )
}
