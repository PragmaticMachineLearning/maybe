import React, { useRef, useState } from 'react'

import { DistributionPlot } from './GaussianPlot'

type CellValue = string | number | number[] | null | { samples: number[] } | { mean: number, variance: number };

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
  const [editing, setEditing] = useState(false)
  const [tempValue, setTempValue] = useState('')
  const [showPlot, setShowPlot] = useState(false)
  const [plotPosition, setPlotPosition] = useState({ top: 0, left: 0 })
  const cellRef = useRef<HTMLTableCellElement>(null)

  const handleDoubleClick = () => {
    if (isGaussian(value)) {
      const gaussian = parseGaussian(value)
      if (gaussian) {
        setTempValue(`N(μ=${gaussian.mean.toFixed(2)}, σ²=${gaussian.variance.toFixed(2)})`)
      } else {
        setTempValue('')
      }
    } else if (isProductDistribution(value)) {
      const product = parseProductDistribution(value)
      if (product) {
        const variance = product.std * product.std;
        setTempValue(`P(μ=${product.mean.toFixed(2)}, σ²=${variance.toFixed(2)})`)
      } else {
        setTempValue('')
      }
    } else if (isRatioDistribution(value)) {
      const ratio = parseRatioDistribution(value)
      if (ratio) {
        setTempValue(`R(μ=${ratio.mean.toFixed(2)}, σ²=${ratio.variance.toFixed(2)})`)
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

  const isGaussian = (val: unknown): boolean => {
    // Check if it's a GaussianNumber object from HyperFormula
    if (val && typeof val === 'object' && 
        val.hasOwnProperty('mean') && 
        val.hasOwnProperty('variance') &&
        !val.hasOwnProperty('sourceMeanX') && // RatioDistribution has these properties
        !val.hasOwnProperty('sourceMeanY') && // RatioDistribution has these properties
        !val.hasOwnProperty('sourceVarX') &&  // RatioDistribution has these properties
        !val.hasOwnProperty('sourceVarY')) {  // RatioDistribution has these properties
      return true;
    }
    
    // Also check for string representation
    if (typeof val === 'string') {
      return val.startsWith('N(') && val.endsWith(')')
    }
    
    return false;
  }

  const isProductDistribution = (val: unknown): boolean => {
    if (val && typeof val === 'object' && 'samples' in val && Array.isArray((val as any).samples)) {
      return true;
    }
    return false;
  }

  const isRatioDistribution = (val: unknown): boolean => {
    if (val && typeof val === 'object' && 
        val.hasOwnProperty('mean') && 
        val.hasOwnProperty('variance') &&
        val.hasOwnProperty('sourceMeanX') && 
        val.hasOwnProperty('sourceMeanY') && 
        val.hasOwnProperty('sourceVarX') && 
        val.hasOwnProperty('sourceVarY')) {
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

  const parseProductDistribution = (val: unknown): { samples: number[], mean: number, std: number } | null => {
    if (val && typeof val === 'object' && 'samples' in val && Array.isArray((val as any).samples)) {
      const samples = (val as any).samples;
      const mean = samples.reduce((a: number, b: number) => a + b, 0) / samples.length;
      const variance = samples.reduce((a: number, b: number) => a + Math.pow(b - mean, 2), 0) / samples.length;
      const std = Math.sqrt(variance);
      return { samples, mean, std };
    }
    return null;
  }

  const parseRatioDistribution = (val: unknown): { mean: number, variance: number } | null => {
    if (val && typeof val === 'object' && 'mean' in val && 'variance' in val) {
      return {
        mean: (val as any).mean,
        variance: (val as any).variance
      };
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
      
      if (isGaussian(value) || isProductDistribution(value) || isRatioDistribution(value)) {
        setShowPlot(true);
      }
    }
  }

  const formatValue = (val: CellValue): string => {
    if (!val) return '';
    
    // Format GaussianNumber objects
    if (isGaussian(val)) {
      const gaussian = parseGaussian(val);
      if (gaussian) {
        return `N(μ=${gaussian.mean.toFixed(2)}, σ²=${gaussian.variance.toFixed(2)})`;
      }
    }
    
    // Format ProductDistribution objects
    if (isProductDistribution(val)) {
      const product = parseProductDistribution(val);
      if (product) {
        const variance = product.std * product.std;
        return `P(μ=${product.mean.toFixed(2)}, σ²=${variance.toFixed(2)})`;
      }
    }

    // Format RatioDistribution objects
    if (isRatioDistribution(val)) {
      const ratio = parseRatioDistribution(val);
      if (ratio) {
        return `R(μ=${ratio.mean.toFixed(2)}, σ²=${ratio.variance.toFixed(2)})`;
      }
    }
    
    return String(val);
  }

  return (
    <>
      <td 
        ref={cellRef}
        onClick={onClick}
        onContextMenu={handleCustomContextMenu}
        onDoubleClick={handleDoubleClick}
        style={{ 
          border: '1px solid #ddd',
          padding: '4px 8px',
          minWidth: '100px',
          height: '24px',
          backgroundColor: isSelected ? '#e3f2fd' : 'white',
          color: '#333',
          cursor: 'pointer',
          transition: 'background-color 0.2s',
          position: 'relative',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}
      >
        {editing ? (
          <input
            autoFocus
            value={tempValue}
            onChange={(e) => setTempValue(e.target.value)}
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
              color: '#333',
              fontFamily: 'inherit',
              fontSize: 'inherit'
            }}
            aria-label={`Cell ${String.fromCharCode(65 + col)}${row + 1}`}
          />
        ) : (
          <span style={{
            display: 'block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            color: '#333'
          }}>
            {formatValue(value)}
          </span>
        )}
      </td>
      {showPlot && (isGaussian(value) || isProductDistribution(value) || isRatioDistribution(value)) && (
        <DistributionPlot
          position={plotPosition}
          mean={isGaussian(value) ? parseGaussian(value)!.mean : 
                isProductDistribution(value) ? parseProductDistribution(value)!.mean :
                parseRatioDistribution(value)!.mean}
          variance={isGaussian(value) ? parseGaussian(value)!.variance : 
                   isProductDistribution(value) ? parseProductDistribution(value)!.std ** 2 :
                   parseRatioDistribution(value)!.variance}
          samples={isProductDistribution(value) ? parseProductDistribution(value)!.samples : undefined}
          isGaussian={isGaussian(value)}
          onClose={() => setShowPlot(false)}
        />
      )}
    </>
  )
} 