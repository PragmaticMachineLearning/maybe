import React, { useState } from 'react'
import { GaussianPlot } from './GaussianPlot'

type CellValue = string | number | number[] | null;

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

  const handleDoubleClick = () => {
    setTempValue(String(value))
    setEditing(true)
  }

  const handleBlur = () => {
    onEdit(row, col, tempValue)
    setEditing(false)
  }

  const isGaussian = (val: unknown): val is string => {
    if (typeof val !== 'string') return false
    return val.startsWith('G(') && val.endsWith(')')
  }

  const parseGaussian = (val: string): { mean: number, variance: number } | null => {
    const match = val.match(/^G\((-?\d+\.?\d*),\s*(-?\d+\.?\d*)\)$/)
    if (!match) return null
    return {
      mean: parseFloat(match[1]),
      variance: parseFloat(match[2])
    }
  }

  const handleCustomContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    if (onContextMenu) {
      onContextMenu(e)
    }
    
    // Only show plot option for Gaussian values
    if (isGaussian(value as string)) {
      const gaussian = parseGaussian(value as string)
      if (gaussian) {
        setShowPlot(true)
      }
    }
  }

  const formatValue = (val: CellValue): string => {
    if (!val) return ''
    return String(val)
  }

  return (
    <>
      <td 
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
      {showPlot && isGaussian(value as string) && (
        <GaussianPlot
          {...parseGaussian(value as string)!}
          onClose={() => setShowPlot(false)}
        />
      )}
    </>
  )
} 