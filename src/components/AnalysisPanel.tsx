import React, { useCallback, useEffect, useRef, useState } from 'react'
import { DistributionPlot } from './DistributionPlot'
import type { ParsedConfidenceInterval } from '../utils/distributionUtils'

interface AnalysisPanelProps {
  cellLabel: string
  samples: number[] | null
  distributionType: 'normal' | 'lognormal' | 'uniform' | 'sampled'
  confidenceInterval?: ParsedConfidenceInterval | null
  onClose: () => void
  message?: string
  compact?: boolean
}

const DEFAULT_PANEL_WIDTH = 320
const MIN_PANEL_WIDTH = 260
const MAX_PANEL_WIDTH = 640

const clampPanelWidth = (value: number) =>
  Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, value))

const formatNumber = (value: number) => {
  if (!Number.isFinite(value)) {
    return '—'
  }
  if (value === 0) {
    return '0'
  }

  const formatExponential = (num: number) =>
    num
      .toExponential(2)
      .replace(/\.0+e/, 'e')
      .replace(/\.([1-9])0+e/, '.$1e')
      .replace('e+', 'e')

  const absValue = Math.abs(value)

  if (Number.isInteger(value)) {
    if (absValue >= 100) {
      return formatExponential(value)
    }
    return value.toString()
  }

  if (absValue >= 10000 || absValue < 0.01) {
    return formatExponential(value)
  }

  const fixed = value
    .toFixed(2)
    .replace(/\.0+$/, '')
    .replace(/(\.\d*[1-9])0+$/, '$1')

  return fixed.startsWith('-0') ? fixed.replace('-0', '0') : fixed
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
  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH)
  const [isResizing, setIsResizing] = useState(false)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const resizeStateRef = useRef<{ startX: number; startWidth: number } | null>(
    null,
  )

  const handleResizeStart = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (compact) {
        return
      }
      event.preventDefault()
      event.stopPropagation()
      const container = panelRef.current
      const startWidth = container?.getBoundingClientRect().width ?? panelWidth
      resizeStateRef.current = {
        startX: event.clientX,
        startWidth: clampPanelWidth(startWidth),
      }
      setIsResizing(true)
    },
    [compact, panelWidth],
  )

  useEffect(() => {
    if (typeof window === 'undefined' || !isResizing || compact) {
      return
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (!resizeStateRef.current) {
        return
      }
      const { startX, startWidth } = resizeStateRef.current
      const delta = startX - event.clientX
      setPanelWidth(clampPanelWidth(startWidth + delta))
    }

    const handlePointerEnd = () => {
      resizeStateRef.current = null
      setIsResizing(false)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerEnd)
    window.addEventListener('pointercancel', handlePointerEnd)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerEnd)
      window.removeEventListener('pointercancel', handlePointerEnd)
    }
  }, [compact, isResizing])

  useEffect(() => {
    if (typeof document === 'undefined' || !isResizing) {
      return
    }

    const previousCursor = document.body.style.cursor
    const previousUserSelect = document.body.style.userSelect
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    return () => {
      document.body.style.cursor = previousCursor
      document.body.style.userSelect = previousUserSelect
    }
  }, [isResizing])

  useEffect(() => {
    if (!compact) {
      return
    }
    resizeStateRef.current = null
    setIsResizing(false)
  }, [compact])

  const effectiveWidth = compact ? '100%' : `${panelWidth}px`
  const effectiveFlex = compact ? '1 1 auto' : `0 0 ${panelWidth}px`

  return (
    <aside
      ref={panelRef}
      style={{
        width: effectiveWidth,
        maxWidth: compact ? '100%' : `${MAX_PANEL_WIDTH}px`,
        minWidth: compact ? '100%' : `${MIN_PANEL_WIDTH}px`,
        flex: effectiveFlex,
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
        position: 'relative',
        userSelect: isResizing ? 'none' : 'auto',
        transition: isResizing ? 'none' : 'width 0.15s ease',
      }}
    >
      {!compact && (
        <div
          onPointerDown={handleResizeStart}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize analysis panel"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            width: '12px',
            cursor: 'ew-resize',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: 'translateX(-6px)',
            zIndex: 1,
          }}
        >
          <div
            style={{
              width: '3px',
              height: '32px',
              borderRadius: '999px',
              backgroundColor: isResizing
                ? 'var(--resize-handle-active)'
                : 'var(--resize-handle)',
              transition: 'background-color 0.2s ease',
            }}
          />
        </div>
      )}
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
