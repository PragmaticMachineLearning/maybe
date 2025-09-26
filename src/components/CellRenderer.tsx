import React, { useContext, useEffect, useRef, useState } from 'react'

import type { CIInterpretation } from '../../hyperformula/src/interpreter/InterpreterValue';
import { DistributionPlot } from './DistributionPlot'
import { SpreadsheetContext } from '../SpreadsheetContext';

// Distribution interpretation options for the dropdown
enum DistributionViewType {
  NORMAL = 'normal',
  LOGNORMAL = 'lognormal',
  UNIFORM = 'uniform'
}


interface DistributionViewOptions {
  type: DistributionViewType;
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

type CellValue = string | number | boolean | number[] | null | { samples: number[] } | { mean: number, variance: number };

export const CellRenderer: React.FC<CellRendererProps> = ({
  row,
  col,
  value,
  onEdit,
  onClick,
  onContextMenu,
  isSelected = false,
}) => {
  
  // Helper to detect ConfidenceIntervalNumber - defined early for use in initialization
  const isConfidenceInterval = (val: unknown): boolean => {
    if (val && typeof val === 'object' && 'lower' in val && 'upper' in val && 'confidenceLevel' in val) {
      return true;
    }
    // Also support string representation
    if (typeof val === 'string') {
      // Support "X to Y" format or "CI[X, Y]"
      return /^\d+\.?\d*\s+to\s+\d+\.?\d*$/.test(val) || 
             (val.startsWith('CI[') && val.endsWith(']'));
    }
    return false;
  }

  // Helper to parse ConfidenceIntervalNumber - defined early for use in initialization
  const parseConfidenceInterval = (val: unknown): { lower: number, upper: number, confidenceLevel: number, interpretation?: CIInterpretation } | null => {
    if (val && typeof val === 'object' && 'lower' in val && 'upper' in val && 'confidenceLevel' in val) {
      return {
        lower: (val as any).lower,
        upper: (val as any).upper,
        confidenceLevel: (val as any).confidenceLevel,
        interpretation: (val as any).interpretation || 'normal',
      };
    }
    if (typeof val === 'string') {
      // Support formats like "12 to 20" or "CI[12, 20]"
      let match = val.match(/^(\d+\.?\d*)\s+to\s+(\d+\.?\d*)$/);
      if (match) {
        return {
          lower: parseFloat(match[1]),
          upper: parseFloat(match[2]),
          confidenceLevel: 90, // Default to 90%
          interpretation: 'normal',
        };
      }
      
      match = val.match(/^CI\[(\-?\d+\.?\d*),\s*(\-?\d+\.?\d*)\]$/);
      if (match) {
        return {
          lower: parseFloat(match[1]),
          upper: parseFloat(match[2]),
          confidenceLevel: 90,
          interpretation: 'normal',
        };
      }
    }
    return null;
  }
  
  const { getCellFormula, liveEditingState, setLiveEditingState } = useContext(SpreadsheetContext)
  const [editing, setEditing] = useState(false)
  const [tempValue, setTempValue] = useState('')
  const [showPlot, setShowPlot] = useState(false)
  const [plotPosition, setPlotPosition] = useState({ top: 0, left: 0 })
  const [showViewDropdown, setShowViewDropdown] = useState(false)
  const [viewOptions, setViewOptions] = useState<DistributionViewOptions>(() => {
    // Initialize with the detected interpretation if the value is a CI
    if (isConfidenceInterval(value)) {
      const ci = parseConfidenceInterval(value);
      const interpretation = ci?.interpretation || 'normal';
      return {
        type: interpretation === 'normal' ? DistributionViewType.NORMAL :
              interpretation === 'lognormal' ? DistributionViewType.LOGNORMAL :
              interpretation === 'uniform' ? DistributionViewType.UNIFORM :
              DistributionViewType.NORMAL
      };
    }
    return {
      type: DistributionViewType.NORMAL
    };
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
    if (isConfidenceInterval(value)) {
      const ci = parseConfidenceInterval(value)
      if (ci) {
        const ciDistRepresentation = `[${ci.lower.toFixed(2)}, ${ci.upper.toFixed(2)}]`;
        setTempValue(ciDistRepresentation)
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


  const isSampledDistribution = (val: unknown): boolean => {
    if (val && typeof val === 'object' && 'samples' in val && Array.isArray((val as any).samples)) {
      return true;
    }
    return false;
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

  // Helper function to extract samples from distribution types (simplified for unified approach)
  const getSamplesFromDistribution = (val: unknown): number[] | null => {
    // Check if it's a SampledDistribution (output from calculations)
    if (val && typeof val === 'object' && 'samples' in val && Array.isArray((val as any).samples)) {
      return (val as any).samples;
    }
    
    // Check if it has toSamples method (ConfidenceIntervalNumber - our only input type)
    if (val && typeof val === 'object' && 'toSamples' in val && typeof (val as any).toSamples === 'function') {
      try {
        return (val as any).toSamples();
      } catch (e) {
        console.log('Error calling toSamples:', e);
      }
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
      
      if (isConfidenceInterval(value) || isSampledDistribution(value)) {
        setShowPlot(true);
      }
    }
  }

  // Update isDistribution to only include the two types we support in unified approach
  const isDistribution = isConfidenceInterval(value) || isSampledDistribution(value);
  
  // Only show view options for confidence intervals, not sampled distributions
  const showViewOptions = isConfidenceInterval(value);

  // Helper to calculate median for confidence intervals
  const getConfidenceIntervalMedian = (ci: { lower: number, upper: number, interpretation?: CIInterpretation }): number => {
    switch (ci.interpretation) {
      case 'lognormal':
        // For log-normal: median = geometric mean
        return Math.sqrt(ci.lower * ci.upper);
      case 'uniform':
      case 'normal':
      default:
        // For normal/uniform: median = arithmetic mean
        return (ci.lower + ci.upper) / 2;
    }
  };

  // Update formatValue to handle confidence intervals
  const formatValue = (val: CellValue, options: DistributionViewOptions): string => {
    if (val === null || val === undefined) return '';
    
    // Handle boolean values from comparison operations
    if (typeof val === 'boolean') {
      return val ? 'TRUE' : 'FALSE';
    }
    
    // Handle primitive types
    if (typeof val === 'string' || typeof val === 'number') {
      return String(val);
    }

    // Format ConfidenceIntervalNumber
    if (isConfidenceInterval(val)) {
      const ci = parseConfidenceInterval(val);
      if (ci) {
        const median = getConfidenceIntervalMedian(ci);
        
        switch (options.type) {
          case DistributionViewType.NORMAL:
            // Show as normal distribution approximation
            const mean = (ci.lower + ci.upper) / 2;
            const zScore = ci.confidenceLevel === 90 ? 1.645 : 1.96;
            const std = (ci.upper - ci.lower) / (2 * zScore);
            return `N(μ=${mean.toFixed(2)}, σ=${std.toFixed(2)})`;
            
          case DistributionViewType.LOGNORMAL:
            // Show as log-normal parameters
            if (ci.lower > 0 && ci.upper > 0) {
              const lnLower = Math.log(ci.lower);
              const lnUpper = Math.log(ci.upper);
              const mu = (lnLower + lnUpper) / 2;
              const sigma = (lnUpper - lnLower) / 3.29;
              return `LN(μ=${mu.toFixed(2)}, σ=${sigma.toFixed(2)})`;
            }
            return `${median.toFixed(2)} [${ci.lower}-${ci.upper}]`;
            
          case DistributionViewType.UNIFORM:
            // Show as uniform distribution
            return `U[${ci.lower.toFixed(2)}, ${ci.upper.toFixed(2)}]`;
            
          default:
            return `${median.toFixed(2)} [${ci.lower}-${ci.upper}]`;
        }
      }
    }
    // These distribution types no longer exist as input types in our unified approach
    // Format SampledDistribution objects (results from calculations)
    // Always show as samples with mean and std deviation
    if (isSampledDistribution(val)) {
      const sampled = parseSampledDistribution(val);
      if (sampled) {
        return `S(μ=${sampled.mean.toFixed(2)}, σ=${sampled.std.toFixed(2)})`;
      }
    }

    return String(val);
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
            {showViewOptions && !editing && (
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
                      {/* Only show interpretation options for confidence intervals */}
                      {isConfidenceInterval(value) && (
                        <>
                          <div style={{ 
                            padding: '6px 12px', 
                            borderBottom: '1px solid var(--border-color)',
                            fontWeight: 'bold',
                            color: 'var(--text-secondary)',
                            fontSize: '11px'
                          }}>
                            View as:
                          </div>
                          <button
                            onClick={() => handleViewOptionChange({ type: DistributionViewType.NORMAL })}
                            style={{
                              width: '100%',
                              padding: '6px 12px',
                              border: 'none',
                              background: viewOptions.type === DistributionViewType.NORMAL ? 'var(--resize-handle-active)' : 'transparent',
                              color: 'var(--text-primary)',
                              textAlign: 'left',
                              cursor: 'pointer',
                              fontSize: 'inherit'
                            }}
                          >
                            Normal Distribution
                          </button>
                          <button
                            onClick={() => handleViewOptionChange({ type: DistributionViewType.LOGNORMAL })}
                            style={{
                              width: '100%',
                              padding: '6px 12px',
                              border: 'none',
                              background: viewOptions.type === DistributionViewType.LOGNORMAL ? 'var(--resize-handle-active)' : 'transparent',
                              color: 'var(--text-primary)',
                              textAlign: 'left',
                              cursor: 'pointer',
                              fontSize: 'inherit'
                            }}
                          >
                            Log-Normal Distribution
                          </button>
                          <button
                            onClick={() => handleViewOptionChange({ type: DistributionViewType.UNIFORM })}
                            style={{
                              width: '100%',
                              padding: '6px 12px',
                              border: 'none',
                              background: viewOptions.type === DistributionViewType.UNIFORM ? 'var(--resize-handle-active)' : 'transparent',
                              color: 'var(--text-primary)',
                              textAlign: 'left',
                              cursor: 'pointer',
                              fontSize: 'inherit'
                            }}
                          >
                            Uniform Distribution
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
      {showPlot && isDistribution && (() => {
        const samples = getSamplesFromDistribution(value);
        if (!samples) return null;
        
        // Get distribution type and confidence interval info
        let distributionType: 'normal' | 'lognormal' | 'uniform' = 'normal';
        let confidenceInterval: { lower: number; upper: number; confidenceLevel: number } | undefined;
        
        if (isConfidenceInterval(value)) {
          const ci = parseConfidenceInterval(value);
          if (ci) {
            confidenceInterval = {
              lower: ci.lower,
              upper: ci.upper,
              confidenceLevel: ci.confidenceLevel,
            };
            
            // Map view options to distribution types
            switch (viewOptions.type) {
              case DistributionViewType.NORMAL:
                distributionType = 'normal';
                break;
              case DistributionViewType.LOGNORMAL:
                distributionType = 'lognormal';
                break;
              case DistributionViewType.UNIFORM:
                distributionType = 'uniform';
                break;
            }
          }
        }
        
        return (
          <DistributionPlot
            position={plotPosition}
            samples={samples}
            onClose={() => setShowPlot(false)}
            distributionType={distributionType}
            confidenceInterval={confidenceInterval}
          />
        );
      })()}
    </>
  )
} 
