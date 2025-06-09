import React, { useContext, useEffect, useRef, useState } from 'react'

import { DistributionPlot } from './GaussianPlot'
import { SpreadsheetContext } from '../SpreadsheetContext';

type CellValue = string | number | number[] | null | { samples: number[] } | { mean: number, variance: number };

// Distribution view options for the dropdown
enum DistributionViewType {
  CONFIDENCE_INTERVAL = 'confidence_interval',
  MEAN_STD = 'mean_std',
  GAUSSIAN_NOTATION = 'gaussian_notation',
  PERCENTILES = 'percentiles',
}

interface DistributionViewOptions {
  type: DistributionViewType;
  confidenceLevel?: number;
  percentileLevel?: number;
}

interface CellRendererProps {
  row: number;
  col: number;
  value: CellValue;
  onEdit: (row: number, col: number, value: string) => void;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  isSelected?: boolean;
}

export const CellRenderer: React.FC<CellRendererProps> = ({
  row,
  col,
  value,
  onEdit,
  onClick,
  onContextMenu,
  isSelected = false,
}) => {
  const { getCellFormula, liveEditingState, setLiveEditingState } = useContext(SpreadsheetContext)
  const [editing, setEditing] = useState(false)
  const [tempValue, setTempValue] = useState('')
  const [showPlot, setShowPlot] = useState(false)
  const [plotPosition, setPlotPosition] = useState({ top: 0, left: 0 })
  const [showViewDropdown, setShowViewDropdown] = useState(false)
  const [viewOptions, setViewOptions] = useState<DistributionViewOptions>({
    type: DistributionViewType.GAUSSIAN_NOTATION,
    confidenceLevel: 95
  })
  const cellRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Update live editing state whenever tempValue changes
  useEffect(() => {
    if (editing) {
      setLiveEditingState({ row, col, value: tempValue })
    }
  }, [editing, tempValue, row, col, setLiveEditingState])

  // Clear live editing state when cell stops editing
  useEffect(() => {
    if (!editing && liveEditingState?.row === row && liveEditingState?.col === col) {
      setLiveEditingState(null)
    }
  }, [editing, row, col, liveEditingState, setLiveEditingState])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowViewDropdown(false)
      }
    }

    if (showViewDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showViewDropdown])

  const handleDoubleClick = () => {
    const formula = getCellFormula(row, col)
    if (formula) {
      setTempValue(formula)
      setEditing(true)
      return
    } 
    if (isGaussian(value)) {
      const gaussian = parseGaussian(value)
      if (gaussian) {
        const gaussianDistRepresentation = `N(μ=${gaussian.mean.toFixed(2)}, σ²=${gaussian.variance.toFixed(2)})`;
        setTempValue(gaussianDistRepresentation)
      } else {
        setTempValue('')
      }
    } else if (isSampledDistribution(value)) {
      const sampled = parseSampledDistribution(value)
      if (sampled) {
        const sampledDistRepresentation = `S(μ=${sampled.mean.toFixed(2)}, σ²=${(sampled.std ** 2).toFixed(2)})`;
        setTempValue(sampledDistRepresentation)
      } else {
        setTempValue('')
      }
    } else {
      setTempValue(value ? String(value) : '')
    }
    setEditing(true)
  }

  const handleBlur = () => {
    onEdit(row, col, tempValue)
    setEditing(false)
  }

  const handleTempValueChange = (newValue: string) => {
    setTempValue(newValue)
    // The useEffect above will automatically update the live editing state
  }

  const isGaussian = (val: unknown): boolean => {
    // Check if it's a GaussianNumber object from HyperFormula
    if (val && typeof val === 'object' && val.hasOwnProperty('mean') && val.hasOwnProperty('variance')) {
      return true;
    }
    
    // Also check for string representation
    if (typeof val === 'string') {
      return val.startsWith('N(') && val.endsWith(')')
    }
    
    return false;
  }

  const isSampledDistribution = (val: unknown): boolean => {
    if (val && typeof val === 'object' && 'samples' in val && Array.isArray((val as any).samples)) {
      return true;
    }
    return false;
  }

  const parseGaussian = (val: unknown): { mean: number, variance: number } | null => {
    // If it's already a GaussianNumber object from HyperFormula
    if (val && typeof val === 'object' && 'mean' in val && 'variance' in val) {
      return {
        mean: (val as any).mean,
        variance: (val as any).variance
      };
    }
    
    // If it's a string representation
    if (typeof val === 'string') {
      const match = val.match(/^N\((-?\d+\.?\d*),\s*(-?\d+\.?\d*)\)$/)
      if (!match) return null
      return {
        mean: parseFloat(match[1]),
        variance: parseFloat(match[2])
      }
    }
    
    return null;
  }

  const parseSampledDistribution = (val: unknown): { samples: number[], mean: number, std: number } | null => {
    if (val && typeof val === 'object' && 'samples' in val && Array.isArray((val as any).samples)) {
      const samples = (val as any).samples;
      const mean = samples.reduce((a: number, b: number) => a + b, 0) / samples.length;
      const variance = samples.reduce((a: number, b: number) => a + Math.pow(b - mean, 2), 0) / samples.length;
      const std = Math.sqrt(variance);
      return { samples, mean, std };
    }
    return null;
  }

  const handleCustomContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    if (onContextMenu) {
      onContextMenu(e)
    }
    
    if (cellRef.current) {
      const rect = cellRef.current.getBoundingClientRect();
      setPlotPosition({
        top: rect.top,
        left: rect.right + 10 // Position 10px to the right of the cell
      });
      
      if (isGaussian(value) || isSampledDistribution(value)) {
        setShowPlot(true);
      }
    }
  }

  const formatValue = (val: CellValue, options: DistributionViewOptions): string => {
    if (!val) return '';
    
    // Format GaussianNumber objects
    if (isGaussian(val)) {
      const gaussian = parseGaussian(val);
      if (gaussian) {
        switch (options.type) {
          case DistributionViewType.GAUSSIAN_NOTATION:
            return `N(μ=${gaussian.mean.toFixed(2)}, σ²=${gaussian.variance.toFixed(2)})`;
          case DistributionViewType.MEAN_STD:
            const std = Math.sqrt(gaussian.variance);
            return `μ=${gaussian.mean.toFixed(2)} ± ${std.toFixed(2)}`;
          case DistributionViewType.CONFIDENCE_INTERVAL:
            const confidenceLevel = options.confidenceLevel || 95;
            const zScore = getZScore(confidenceLevel / 100);
            const margin = zScore * Math.sqrt(gaussian.variance);
            return `${confidenceLevel}% CI [${(gaussian.mean - margin).toFixed(2)}, ${(gaussian.mean + margin).toFixed(2)}]`;
          case DistributionViewType.PERCENTILES:
            const p25 = gaussian.mean - 0.674 * Math.sqrt(gaussian.variance); // Approx 25th percentile
            const p75 = gaussian.mean + 0.674 * Math.sqrt(gaussian.variance); // Approx 75th percentile
            return `P25-P75: [${p25.toFixed(2)}, ${p75.toFixed(2)}]`;
          default:
            return `N(μ=${gaussian.mean.toFixed(2)}, σ²=${gaussian.variance.toFixed(2)})`;
        }
      }
    }
    
    // Format SampledDistribution objects
    if (isSampledDistribution(val)) {
      const sampled = parseSampledDistribution(val);
      if (sampled) {
        const sortedSamples = sampled.samples.sort((a, b) => a - b);
        const n = sortedSamples.length;
        
        switch (options.type) {
          case DistributionViewType.CONFIDENCE_INTERVAL:
            const confidenceLevel = options.confidenceLevel || 95;
            const lowerIndex = Math.floor(n * (1 - confidenceLevel / 100) / 2);
            const upperIndex = Math.floor(n * (1 + confidenceLevel / 100) / 2);
            const lowerBound = sortedSamples[lowerIndex];
            const upperBound = sortedSamples[upperIndex];
            return `${confidenceLevel}% CI [${lowerBound.toFixed(2)}, ${upperBound.toFixed(2)}]`;
          case DistributionViewType.MEAN_STD:
            return `μ=${sampled.mean.toFixed(2)} ± ${sampled.std.toFixed(2)}`;
          case DistributionViewType.PERCENTILES:
            const p25 = sortedSamples[Math.floor(n * 0.25)];
            const p75 = sortedSamples[Math.floor(n * 0.75)];
            return `P25-P75: [${p25.toFixed(2)}, ${p75.toFixed(2)}]`;
          case DistributionViewType.GAUSSIAN_NOTATION:
            return `S(μ=${sampled.mean.toFixed(2)}, σ²=${(sampled.std ** 2).toFixed(2)})`;
          default:
            return `S(μ=${sampled.mean.toFixed(2)}, σ²=${(sampled.std ** 2).toFixed(2)})`;
        }
      }
    }
    
    return String(val);
  }

  // Helper function to get Z-score for confidence intervals
  const getZScore = (confidence: number): number => {
    // Simplified Z-score lookup for common confidence levels
    const zScores: { [key: number]: number } = {
      0.90: 1.645,
      0.95: 1.96,
      0.99: 2.576
    };
    return zScores[confidence] || 1.96; // Default to 95% CI
  }

  const handleViewOptionChange = (newOptions: DistributionViewOptions) => {
    setViewOptions(newOptions);
    setShowViewDropdown(false);
  }

  const isDistribution = isGaussian(value) || isSampledDistribution(value);

  return (
    <>
      <div 
        ref={cellRef}
        onClick={onClick}
        onContextMenu={handleCustomContextMenu}
        onDoubleClick={handleDoubleClick}
        style={{ 
          padding: '2px 4px',
          height: '20px',
          backgroundColor: isSelected ? 'var(--resize-handle-bg)' : 'var(--bg-surface)',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          transition: 'background-color 0.2s',
          position: 'relative',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          width: '100%',
          boxSizing: 'border-box',
          fontSize: '12px',
          borderRight:'1px solid var(--border-color)',
          borderBottom:'1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        {editing ? (
          <input
            autoFocus
            value={tempValue}
            onChange={(e) => handleTempValueChange(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleBlur()
              if (e.key === 'Escape') setEditing(false)
            }}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              outline: 'none',
              padding: '0',
              backgroundColor: 'transparent',
              position: 'absolute',
              top: 0,
              left: 0,
              color: 'var(--text-primary)',
              fontFamily: 'inherit',
              fontSize: 'inherit'
            }}
            aria-label={`Cell ${String.fromCharCode(65 + col)}${row + 1}`}
          />
        ) : (
          <>
            <span style={{
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: 'var(--text-primary)',
              flex: 1
            }}>
              {formatValue(value, viewOptions)}
            </span>
            {isDistribution && !editing && (
              <div style={{ position: 'relative', marginLeft: '4px' }} ref={dropdownRef}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowViewDropdown(!showViewDropdown);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '2px',
                    color: 'var(--text-secondary)',
                    fontSize: '10px',
                    opacity: 0.7,
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  title="Change view"
                >
                  ▼
                </button>
                {showViewDropdown && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    backgroundColor: 'white',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    zIndex: 1000,
                    minWidth: '180px',
                    fontSize: '12px'
                  }}>
                    <div style={{ padding: '4px 0' }}>
                      <button
                        onClick={() => handleViewOptionChange({ type: DistributionViewType.CONFIDENCE_INTERVAL, confidenceLevel: 95 })}
                        style={{
                          width: '100%',
                          padding: '6px 12px',
                          border: 'none',
                          background: viewOptions.type === DistributionViewType.CONFIDENCE_INTERVAL ? 'var(--bg-accent)' : 'transparent',
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontSize: 'inherit'
                        }}
                      >
                        95% Confidence Interval
                      </button>
                      <button
                        onClick={() => handleViewOptionChange({ type: DistributionViewType.MEAN_STD })}
                        style={{
                          width: '100%',
                          padding: '6px 12px',
                          border: 'none',
                          background: viewOptions.type === DistributionViewType.MEAN_STD ? 'var(--bg-accent)' : 'transparent',
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontSize: 'inherit'
                        }}
                      >
                        Mean ± Std Dev
                      </button>
                                             {(isGaussian(value) || isSampledDistribution(value)) && (
                         <button
                           onClick={() => handleViewOptionChange({ type: DistributionViewType.GAUSSIAN_NOTATION })}
                           style={{
                             width: '100%',
                             padding: '6px 12px',
                             border: 'none',
                             background: viewOptions.type === DistributionViewType.GAUSSIAN_NOTATION ? 'var(--bg-accent)' : 'transparent',
                             textAlign: 'left',
                             cursor: 'pointer',
                             fontSize: 'inherit'
                           }}
                         >
                           Gaussian Notation
                         </button>
                       )}
                      <button
                        onClick={() => handleViewOptionChange({ type: DistributionViewType.PERCENTILES })}
                        style={{
                          width: '100%',
                          padding: '6px 12px',
                          border: 'none',
                          background: viewOptions.type === DistributionViewType.PERCENTILES ? 'var(--bg-accent)' : 'transparent',
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontSize: 'inherit'
                        }}
                      >
                        Percentiles (25th-75th)
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
      {showPlot && (isGaussian(value) || isSampledDistribution(value)) && (
        <DistributionPlot
          position={plotPosition}
          mean={isGaussian(value) ? parseGaussian(value)!.mean : parseSampledDistribution(value)!.mean}
          variance={isGaussian(value) ? parseGaussian(value)!.variance : parseSampledDistribution(value)!.std ** 2}
          samples={isSampledDistribution(value) ? parseSampledDistribution(value)!.samples : undefined}
          isGaussian={isGaussian(value)}
          onClose={() => setShowPlot(false)}
        />
      )}
    </>
  )
} 