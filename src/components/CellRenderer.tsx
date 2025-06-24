import React, { useContext, useEffect, useRef, useState } from 'react'

import { DistributionPlot } from './GaussianPlot'
import { SpreadsheetContext } from '../SpreadsheetContext';

// Distribution view options for the dropdown
enum DistributionViewType {
  CONFIDENCE_INTERVAL = 'confidence_interval',
  GAUSSIAN_NOTATION = 'gaussian_notation',
}

interface DistributionViewOptions {
  type: DistributionViewType;
  confidenceLevel?: number;
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

type CellValue = string | number | number[] | null | { samples: number[] } | { mean: number, variance: number };

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
    type: DistributionViewType.CONFIDENCE_INTERVAL,
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
    } else if (isConfidenceInterval(value)) {
      const ci = parseConfidenceInterval(value)
      if (ci) {
        const ciDistRepresentation = `CI[${ci.lower.toFixed(2)}, ${ci.upper.toFixed(2)}]`;
        setTempValue(ciDistRepresentation)
      } else {
        setTempValue('')
      }
    }
    else {
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

  // Helper to detect ConfidenceIntervalNumber
  const isConfidenceInterval = (val: unknown): boolean => {
    if (val && typeof val === 'object' && 'lower' in val && 'upper' in val && 'confidenceLevel' in val) {
      return true;
    }
    // Also support string representation
    if (typeof val === 'string') {
      return val.startsWith('CI[') && val.endsWith(']');
    }
    return false;
  }

  // Helper to parse ConfidenceIntervalNumber
  const parseConfidenceInterval = (val: unknown): { lower: number, upper: number, confidenceLevel: number } | null => {
    if (val && typeof val === 'object' && 'lower' in val && 'upper' in val && 'confidenceLevel' in val) {
      return {
        lower: (val as any).lower,
        upper: (val as any).upper,
        confidenceLevel: (val as any).confidenceLevel,
      };
    }
    if (typeof val === 'string') {
      const match = val.match(/^CI\[(\-?\d+\.?\d*),\s*(\-?\d+\.?\d*)\]$/);
      if (!match) return null;
      return {
        lower: parseFloat(match[1]),
        upper: parseFloat(match[2]),
        confidenceLevel: 95,
      };
    }
    return null;
  }

  // Helper function to convert confidence interval to Gaussian format
  const confidenceIntervalToGaussian = (lower: number, upper: number, confidenceLevel: number): { mean: number; variance: number } => {
    const mean = (lower + upper) / 2;
    const zScore = confidenceLevel === 90 ? 1.645 : confidenceLevel === 99 ? 2.576 : 1.96; // Default to 95%
    const standardDeviation = (upper - lower) / (2 * zScore);
    const variance = standardDeviation * standardDeviation;
    return { mean, variance };
  };

  // Update isDistribution to include confidence intervals
  const isDistribution = isGaussian(value) || isSampledDistribution(value) || isConfidenceInterval(value);

  // Update formatValue to handle confidence intervals
  const formatValue = (val: CellValue, options: DistributionViewOptions): string => {
    if (!val) return '';

    // Format ConfidenceIntervalNumber
    if (isConfidenceInterval(val)) {
      const ci = parseConfidenceInterval(val);
      if (ci) {
        switch (options.type) {
          case DistributionViewType.CONFIDENCE_INTERVAL:
            return `${ci.confidenceLevel}% CI [${ci.lower.toFixed(2)}, ${ci.upper.toFixed(2)}]`;
          case DistributionViewType.GAUSSIAN_NOTATION:
            const gaussian = confidenceIntervalToGaussian(ci.lower, ci.upper, ci.confidenceLevel);
            return `N(μ=${gaussian.mean.toFixed(2)}, σ²=${gaussian.variance.toFixed(2)})`;
          default:
            return `${ci.confidenceLevel}% CI [${ci.lower.toFixed(2)}, ${ci.upper.toFixed(2)}]`;
        }
      }
    }
    // Format GaussianNumber objects
    if (isGaussian(val)) {
      const gaussian = parseGaussian(val);
      if (gaussian) {
        switch (options.type) {
          case DistributionViewType.GAUSSIAN_NOTATION:
            return `N(μ=${gaussian.mean.toFixed(2)}, σ²=${gaussian.variance.toFixed(2)})`;
          case DistributionViewType.CONFIDENCE_INTERVAL:
            const confidenceLevel = options.confidenceLevel || 95;
            const zScore = getZScore(confidenceLevel / 100);
            const margin = zScore * Math.sqrt(gaussian.variance);
            return `${confidenceLevel}% CI [${(gaussian.mean - margin).toFixed(2)}, ${(gaussian.mean + margin).toFixed(2)}]`;
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
                    backgroundColor: 'var(--bg-surface)',
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
                          background: viewOptions.type === DistributionViewType.CONFIDENCE_INTERVAL ? 'var(--resize-handle-active)' : 'transparent',
                          color: 'var(--text-primary)',
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontSize: 'inherit'
                        }}
                      >
                        95% Confidence Interval
                      </button>
                      
                      {(isGaussian(value) || isSampledDistribution(value) || isConfidenceInterval(value)) && (
                        <button
                          onClick={() => handleViewOptionChange({ type: DistributionViewType.GAUSSIAN_NOTATION })}
                          style={{
                            width: '100%',
                            padding: '6px 12px',
                            border: 'none',
                            background: viewOptions.type === DistributionViewType.GAUSSIAN_NOTATION ? 'var(--resize-handle-active)' : 'transparent',
                            color: 'var(--text-primary)',
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontSize: 'inherit'
                          }}
                        >
                          Gaussian Notation
                        </button>
                      )}
                      
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
      {showPlot && (isGaussian(value) || isSampledDistribution(value) || isConfidenceInterval(value)) && (
        <DistributionPlot
          position={plotPosition}
          mean={isGaussian(value) ? parseGaussian(value)!.mean : isSampledDistribution(value) ? parseSampledDistribution(value)!.mean : parseConfidenceInterval(value)!.lower + (parseConfidenceInterval(value)!.upper - parseConfidenceInterval(value)!.lower) / 2}
          variance={isGaussian(value) ? parseGaussian(value)!.variance : isSampledDistribution(value) ? parseSampledDistribution(value)!.std ** 2 : Math.pow((parseConfidenceInterval(value)!.upper - parseConfidenceInterval(value)!.lower) / (2 * 1.96), 2)}
          samples={isSampledDistribution(value) ? parseSampledDistribution(value)!.samples : undefined}
          isGaussian={isGaussian(value)}
          onClose={() => setShowPlot(false)}
        />
      )}
    </>
  )
} 