import React, { useContext, useEffect, useRef, useState } from 'react'

import { DistributionPlot } from './GaussianPlot'
import { SpreadsheetContext } from '../SpreadsheetContext';
import type { CIInterpretation } from '../../hyperformula/src/interpreter/InterpreterValue';

// Distribution view options for the dropdown
enum DistributionViewType {
  CONFIDENCE_INTERVAL = 'confidence_interval',
  GAUSSIAN_NOTATION = 'gaussian_notation',
  LOG_NORMAL_NOTATION = 'log_normal_notation',
  UNIFORM_NOTATION = "uniform_notation",
  NATIVE_DISTRIBUTION = 'native_distribution'
}


interface DistributionViewOptions {
  type: DistributionViewType;
  confidenceLevel?: number;
  ciInterpretation?: CIInterpretation;
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
  // Debug logging to understand what values we're receiving
  if (value !== null && value !== undefined) {
    if (typeof value === 'object') {
      console.log(`Cell (${row}, ${col}) received object:`, value, 'Type:', Object.getPrototypeOf(value)?.constructor?.name, 'Keys:', Object.keys(value));
    } else {
      console.log(`Cell (${row}, ${col}) received primitive:`, value, 'Type:', typeof value);
    }
  }
  
  // Helper to detect ConfidenceIntervalNumber - defined early for use in initialization
  const isConfidenceInterval = (val: unknown): boolean => {
    if (val && typeof val === 'object' && 'lower' in val && 'upper' in val && 'confidenceLevel' in val) {
      return true;
    }
    // Also support string representation
    if (typeof val === 'string') {
      // Support "X to Y" format (Guesstimate style) or "CI[X, Y]"
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
          confidenceLevel: 90, // Default to 90% like Guesstimate
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
    // Initialize with CI interpretation if the value is a CI
    if (isConfidenceInterval(value)) {
      const ci = parseConfidenceInterval(value);
      return {
        type: DistributionViewType.NATIVE_DISTRIBUTION,
        confidenceLevel: ci?.confidenceLevel || 90,
        ciInterpretation: ci?.interpretation || 'normal'
      };
    }
    return {
      type: DistributionViewType.NATIVE_DISTRIBUTION,
      confidenceLevel: 90,
      ciInterpretation: 'normal'
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
    } else if (isLogNormal(value)) {
      const ln = parseLogNormal(value)
      if (ln) {
        const lnDistRepresentation = `LN(${ln.mu.toFixed(2)}, ${ln.sigma2.toFixed(2)})`;
        setTempValue(lnDistRepresentation)
      } else {
        setTempValue('')
      }
    } else if (isUniform(value)) {
      const u = parseUniform(value)
      if (u) {
        const uDistRepresentation = `U(${u.a.toFixed(2)}, ${u.b.toFixed(2)})`;
        setTempValue(uDistRepresentation)
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
    // Use multiple detection methods to handle class identity issues across module boundaries
    if (val && typeof val === 'object') {
      const hasGaussianProps = 'mean' in val && 'variance' in val;
      const hasGaussianMethods = 'getMean' in val && 'getVariance' in val && 'getSamples' in val;
      const hasDetailedType = 'getDetailedType' in val && typeof (val as any).getDetailedType === 'function';
      
      if (hasGaussianProps || (hasGaussianMethods && hasDetailedType)) {
        console.log('Gaussian object detected:', val, 'Constructor:', Object.getPrototypeOf(val)?.constructor?.name);
        
        // Additional check: try calling getDetailedType if it exists
        if (hasDetailedType) {
          try {
            const detailedType = (val as any).getDetailedType();
            console.log('DetailedType:', detailedType);
            if (detailedType === 'NUMBER_GAUSSIAN') {
              return true;
            }
          } catch (e) {
            console.log('Error calling getDetailedType:', e);
          }
        }
        
        return hasGaussianProps;
      }
    }
    
    // Also check for string representation
    if (typeof val === 'string') {
      return val.startsWith('N(') && val.endsWith(')')
    }
    
    return false;
  }

  const isLogNormal = (val: unknown): boolean => {
    // Check if it's a LogNormalNumber object from HyperFormula
    // Use multiple detection methods to handle class identity issues across module boundaries
    if (val && typeof val === 'object') {
      const hasLogNormalProps = 'mu' in val && 'sigma2' in val;
      const hasLogNormalMethods = 'getMean' in val && 'getVariance' in val && 'getSamples' in val;
      const hasDetailedType = 'getDetailedType' in val && typeof (val as any).getDetailedType === 'function';
      
      if (hasLogNormalProps || (hasLogNormalMethods && hasDetailedType)) {
        console.log('LogNormal object detected:', val, 'Constructor:', Object.getPrototypeOf(val)?.constructor?.name);
        
        // Additional check: try calling getDetailedType if it exists
        if (hasDetailedType) {
          try {
            const detailedType = (val as any).getDetailedType();
            console.log('DetailedType:', detailedType);
            if (detailedType === 'NUMBER_LOGNORMAL') {
              return true;
            }
          } catch (e) {
            console.log('Error calling getDetailedType:', e);
          }
        }
        
        return hasLogNormalProps;
      }
    }
    
    // Also check for string representation
    if (typeof val === 'string') {
      return val.startsWith('LN(') && val.endsWith(')')
    }
    
    return false;
  }

  const isUniform = (val: unknown): boolean => {
    // Check if it's a UniformNumber object from HyperFormula
    // Use multiple detection methods to handle class identity issues across module boundaries
    if (val && typeof val === 'object') {
      const hasUniformProps = 'a' in val && 'b' in val;
      const hasUniformMethods = 'getMean' in val && 'getVariance' in val && 'getSamples' in val;
      const hasDetailedType = 'getDetailedType' in val && typeof (val as any).getDetailedType === 'function';
      
      if (hasUniformProps || (hasUniformMethods && hasDetailedType)) {
        console.log('Uniform object detected:', val, 'Constructor:', Object.getPrototypeOf(val)?.constructor?.name);
        
        // Additional check: try calling getDetailedType if it exists
        if (hasDetailedType) {
          try {
            const detailedType = (val as any).getDetailedType();
            console.log('DetailedType:', detailedType);
            if (detailedType === 'NUMBER_UNIFORM') {
              return true;
            }
          } catch (e) {
            console.log('Error calling getDetailedType:', e);
          }
        }
        
        return hasUniformProps;
      }
    }
    
    // Also check for string representation
    if (typeof val === 'string') {
      return val.startsWith('U(') && val.endsWith(')')
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

  const parseLogNormal = (val: unknown): { mu: number, sigma2: number } | null => {
    // If it's already a LogNormalNumber object from HyperFormula
    if (val && typeof val === 'object' && 'mu' in val && 'sigma2' in val) {
      return {
        mu: (val as any).mu,
        sigma2: (val as any).sigma2
      };
    }
    
    // If it's a string representation
    if (typeof val === 'string') {
      const match = val.match(/^LN\s*\(\s*([+-]?\d*\.?\d+)\s*,\s*([+-]?\d*\.?\d+)\s*\)$/i)
      if (!match) return null
      return {
        mu: parseFloat(match[1]),
        sigma2: parseFloat(match[2])
      }
    }
    
    return null;
  }

  const parseUniform = (val: unknown): { a: number, b: number } | null => {
    // If it's already a UniformNumber object from HyperFormula
    if (val && typeof val === 'object' && 'a' in val && 'b' in val) {
      return {
        a: (val as any).a,
        b: (val as any).b
      };
    }
    
    // If it's a string representation
    if (typeof val === 'string') {
      const match = val.match(/^U\s*\(\s*([+-]?\d*\.?\d+)\s*,\s*([+-]?\d*\.?\d+)\s*\)$/i)
      if (!match) return null
      return {
        a: parseFloat(match[1]),
        b: parseFloat(match[2])
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
      
      if (isGaussian(value) || isSampledDistribution(value) || isLogNormal(value) || isUniform(value)) {
        setShowPlot(true);
      }
    }
  }

  // Update isDistribution to include all distribution types
  const isDistribution = isGaussian(value) || isSampledDistribution(value) || isConfidenceInterval(value) || isLogNormal(value) || isUniform(value);

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
        switch (options.type) {
          case DistributionViewType.CONFIDENCE_INTERVAL:
          case DistributionViewType.NATIVE_DISTRIBUTION:
            // Show interpretation type for clarity
            const interpLabel = ci.interpretation === 'normal' ? 'N' : 
                              ci.interpretation === 'uniform' ? 'U' : 
                              ci.interpretation === 'lognormal' ? 'LN' : '';
            return `${ci.lower.toFixed(2)} to ${ci.upper.toFixed(2)} (${interpLabel})`;
          case DistributionViewType.GAUSSIAN_NOTATION:
            // Calculate as Gaussian based on CI interpretation
            const mean = (ci.lower + ci.upper) / 2;
            const zScore = ci.confidenceLevel === 90 ? 1.645 : 1.96;
            const std = (ci.upper - ci.lower) / (2 * zScore);
            return `N(μ=${mean.toFixed(2)}, σ²=${(std * std).toFixed(2)})`;
          case DistributionViewType.LOG_NORMAL_NOTATION:
            // Calculate log-normal parameters
            if (ci.lower > 0 && ci.upper > 0) {
              const lnLower = Math.log(ci.lower);
              const lnUpper = Math.log(ci.upper);
              const mu = (lnLower + lnUpper) / 2;
              const sigma = (lnUpper - lnLower) / 3.29;
              return `LN(μ=${mu.toFixed(2)}, σ²=${(sigma * sigma).toFixed(2)})`;
            }
            return `${ci.lower.toFixed(2)} to ${ci.upper.toFixed(2)}`;
          case DistributionViewType.UNIFORM_NOTATION:
            return `U[${ci.lower.toFixed(2)}, ${ci.upper.toFixed(2)}]`;
          default:
            return `${ci.lower.toFixed(2)} to ${ci.upper.toFixed(2)}`;
        }
      }
    }
    // Format LogNormalNumber objects
    if (isLogNormal(val)) {
      const logNormal = parseLogNormal(val);
      if (logNormal) {
        switch (options.type) {
          case DistributionViewType.NATIVE_DISTRIBUTION:
            return `LN(${logNormal.mu.toFixed(2)}, ${logNormal.sigma2.toFixed(2)})`;
          case DistributionViewType.CONFIDENCE_INTERVAL:
            // For log-normal, estimate confidence interval from mean and variance
            const mean = Math.exp(logNormal.mu + logNormal.sigma2 / 2);
            const variance = (Math.exp(logNormal.sigma2) - 1) * Math.exp(2 * logNormal.mu + logNormal.sigma2);
            const std = Math.sqrt(variance);
            const confidenceLevel = options.confidenceLevel || 95;
            const zScore = getZScore(confidenceLevel / 100);
            const margin = zScore * std;
            return `${confidenceLevel}% CI [${(mean - margin).toFixed(2)}, ${(mean + margin).toFixed(2)}]`;
          default:
            return `LN(${logNormal.mu.toFixed(2)}, ${logNormal.sigma2.toFixed(2)})`;
        }
      }
    }
    // Format UniformNumber objects
    if (isUniform(val)) {
      const uniform = parseUniform(val);
      if (uniform) {
        switch (options.type) {
          case DistributionViewType.NATIVE_DISTRIBUTION:
            return `U(${uniform.a.toFixed(2)}, ${uniform.b.toFixed(2)})`;
          case DistributionViewType.CONFIDENCE_INTERVAL:
            const confidenceLevel = options.confidenceLevel || 95;
            // For uniform distribution, confidence interval is based on order statistics
            const width = uniform.b - uniform.a;
            const margin = width * (1 - confidenceLevel / 100) / 2;
            return `${confidenceLevel}% CI [${(uniform.a + margin).toFixed(2)}, ${(uniform.b - margin).toFixed(2)}]`;
          default:
            return `U[${uniform.a.toFixed(2)}, ${uniform.b.toFixed(2)}]`;
        }
      }
    }
    // Format GaussianNumber objects
    if (isGaussian(val)) {
      const gaussian = parseGaussian(val);
      if (gaussian) {
        switch (options.type) {
          case DistributionViewType.NATIVE_DISTRIBUTION:
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
    // Sampled distributions are unique - they result from arithmetic operations that don't preserve
    // other distribution types, so we should not provide options to convert them back to parametric forms
    if (isSampledDistribution(val)) {
      const sampled = parseSampledDistribution(val);
      if (sampled) {
        const sortedSamples = sampled.samples.sort((a, b) => a - b);
        const n = sortedSamples.length;
        switch (options.type) {
          case DistributionViewType.NATIVE_DISTRIBUTION:
            return `S(μ=${sampled.mean.toFixed(2)}, σ²=${(sampled.std ** 2).toFixed(2)})`;
          case DistributionViewType.CONFIDENCE_INTERVAL:
            const confidenceLevel = options.confidenceLevel || 95;
            const lowerIndex = Math.floor(n * (1 - confidenceLevel / 100) / 2);
            const upperIndex = Math.floor(n * (1 + confidenceLevel / 100) / 2);
            const lowerBound = sortedSamples[lowerIndex];
            const upperBound = sortedSamples[upperIndex];
            return `${confidenceLevel}% CI [${lowerBound.toFixed(2)}, ${upperBound.toFixed(2)}]`;
          // For sampled distributions, we only show native and confidence interval views
          // since they are the result of operations that don't preserve parametric distribution types
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
                    minWidth: '220px',
                    fontSize: '12px'
                  }}>
                    <div style={{ padding: '4px 0' }}>
                      {/* Show interpretation options for confidence intervals */}
                      {isConfidenceInterval(value) && (
                        <>
                          <div style={{ 
                            padding: '6px 12px', 
                            borderBottom: '1px solid var(--border-color)',
                            fontWeight: 'bold',
                            color: 'var(--text-secondary)'
                          }}>
                            Interpretation:
                          </div>
                          <button
                            onClick={() => {
                              // TODO: Update the CI interpretation to 'normal'
                              handleViewOptionChange({ 
                                ...viewOptions, 
                                ciInterpretation: 'normal' 
                              });
                            }}
                            style={{
                              width: '100%',
                              padding: '6px 12px',
                              border: 'none',
                              background: viewOptions.ciInterpretation === 'normal' ? 'var(--resize-handle-active)' : 'transparent',
                              color: 'var(--text-primary)',
                              textAlign: 'left',
                              cursor: 'pointer',
                              fontSize: 'inherit'
                            }}
                          >
                            Normal (symmetric CI)
                          </button>
                          <button
                            onClick={() => {
                              // TODO: Update the CI interpretation to 'uniform'
                              handleViewOptionChange({ 
                                ...viewOptions, 
                                ciInterpretation: 'uniform' 
                              });
                            }}
                            style={{
                              width: '100%',
                              padding: '6px 12px',
                              border: 'none',
                              background: viewOptions.ciInterpretation === 'uniform' ? 'var(--resize-handle-active)' : 'transparent',
                              color: 'var(--text-primary)',
                              textAlign: 'left',
                              cursor: 'pointer',
                              fontSize: 'inherit'
                            }}
                          >
                            Uniform (hard bounds)
                          </button>
                          <button
                            onClick={() => {
                              // TODO: Update the CI interpretation to 'lognormal'
                              handleViewOptionChange({ 
                                ...viewOptions, 
                                ciInterpretation: 'lognormal' 
                              });
                            }}
                            style={{
                              width: '100%',
                              padding: '6px 12px',
                              border: 'none',
                              background: viewOptions.ciInterpretation === 'lognormal' ? 'var(--resize-handle-active)' : 'transparent',
                              color: 'var(--text-primary)',
                              textAlign: 'left',
                              cursor: 'pointer',
                              fontSize: 'inherit'
                            }}
                          >
                            Log-normal (positive only)
                          </button>
                          <div style={{ 
                            padding: '6px 12px', 
                            borderBottom: '1px solid var(--border-color)',
                            borderTop: '1px solid var(--border-color)',
                            marginTop: '4px',
                            fontWeight: 'bold',
                            color: 'var(--text-secondary)'
                          }}>
                            View as:
                          </div>
                        </>
                      )}
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
                      
                      {(isGaussian(value) || isSampledDistribution(value) || isConfidenceInterval(value) || isLogNormal(value) || isUniform(value)) && (
                        <>
                          <button
                            onClick={() => handleViewOptionChange({ type: DistributionViewType.NATIVE_DISTRIBUTION })}
                            style={{
                              width: '100%',
                              padding: '6px 12px',
                              border: 'none',
                              background: viewOptions.type === DistributionViewType.NATIVE_DISTRIBUTION ? 'var(--resize-handle-active)' : 'transparent',
                              color: 'var(--text-primary)',
                              textAlign: 'left',
                              cursor: 'pointer',
                              fontSize: 'inherit'
                            }}
                          >
                            Native Format
                          </button>
                          {/* Show distribution conversion options only for confidence intervals */}
                          {isConfidenceInterval(value) && (
                            <>
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
                                Gaussian Approximation
                              </button>
                              <button
                                onClick={() => handleViewOptionChange({ type: DistributionViewType.LOG_NORMAL_NOTATION })}
                                style={{
                                  width: '100%',
                                  padding: '6px 12px',
                                  border: 'none',
                                  background: viewOptions.type === DistributionViewType.LOG_NORMAL_NOTATION ? 'var(--resize-handle-active)' : 'transparent',
                                  color: 'var(--text-primary)',
                                  textAlign: 'left',
                                  cursor: 'pointer',
                                  fontSize: 'inherit'
                                }}
                              >
                                Log-Normal Approximation
                              </button>
                              <button
                                onClick={() => handleViewOptionChange({ type: DistributionViewType.UNIFORM_NOTATION })}
                                style={{
                                  width: '100%',
                                  padding: '6px 12px',
                                  border: 'none',
                                  background: viewOptions.type === DistributionViewType.UNIFORM_NOTATION ? 'var(--resize-handle-active)' : 'transparent',
                                  color: 'var(--text-primary)',
                                  textAlign: 'left',
                                  cursor: 'pointer',
                                  fontSize: 'inherit'
                                }}
                              >
                                Uniform Approximation
                              </button>
                            </>
                          )}
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
      {showPlot && (isGaussian(value) || isSampledDistribution(value) || isConfidenceInterval(value) || isLogNormal(value) || isUniform(value)) && (
        <DistributionPlot
          position={plotPosition}
          mean={
            isGaussian(value) ? parseGaussian(value)!.mean :
            isSampledDistribution(value) ? parseSampledDistribution(value)!.mean :
            isConfidenceInterval(value) ? (
              typeof value === 'object' && value !== null && 'toGaussian' in value ?
                (value as any).toGaussian().mean :
                parseConfidenceInterval(value)!.lower + (parseConfidenceInterval(value)!.upper - parseConfidenceInterval(value)!.lower) / 2
            ) :
            isLogNormal(value) ? (
              typeof value === 'object' && value !== null && 'getMean' in value ?
                (value as any).getMean() :
                Math.exp(parseLogNormal(value)!.mu + parseLogNormal(value)!.sigma2 / 2)
            ) :
            isUniform(value) ? (
              typeof value === 'object' && value !== null && 'getMean' in value ?
                (value as any).getMean() :
                (parseUniform(value)!.a + parseUniform(value)!.b) / 2
            ) : 0
          }
          variance={
            isGaussian(value) ? parseGaussian(value)!.variance :
            isSampledDistribution(value) ? parseSampledDistribution(value)!.std ** 2 :
            isConfidenceInterval(value) ? (
              typeof value === 'object' && value !== null && 'toGaussian' in value ?
                (value as any).toGaussian().variance :
                Math.pow((parseConfidenceInterval(value)!.upper - parseConfidenceInterval(value)!.lower) / (2 * 1.96), 2)
            ) :
            isLogNormal(value) ? (
              typeof value === 'object' && value !== null && 'getVariance' in value ?
                (value as any).getVariance() :
                (Math.exp(parseLogNormal(value)!.sigma2) - 1) * Math.exp(2 * parseLogNormal(value)!.mu + parseLogNormal(value)!.sigma2)
            ) :
            isUniform(value) ? (
              typeof value === 'object' && value !== null && 'getVariance' in value ?
                (value as any).getVariance() :
                Math.pow(parseUniform(value)!.b - parseUniform(value)!.a, 2) / 12
            ) : 0
          }
          samples={isSampledDistribution(value) ? parseSampledDistribution(value)!.samples : undefined}
          isGaussian={isGaussian(value)}
          onClose={() => setShowPlot(false)}
        />
      )}
    </>
  )
} 