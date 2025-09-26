import React, { useContext, useEffect, useState } from 'react'

import { SpreadsheetContext } from '../SpreadsheetContext'

interface FormulaBarProps {
  selectedCell?: { row: number; col: number } | null
  onFormulaSubmit?: (row: number, col: number, formula: string) => void
}

// Helper function to format distribution objects for display
const formatCellValue = (value: any): string => {
  if (value === null || value === undefined) {
    return ''
  }
  
  // Handle boolean values from comparison operations
  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  }

  // Check if it's a distribution object
  if (typeof value === 'object' && value !== null) {
    // Check for GaussianNumber pattern
    if (typeof value.mean === 'number' && typeof value.variance === 'number') {
      return `N(μ=${value.mean.toFixed(2)}, σ²=${value.variance.toFixed(2)})`
    }

    // Check for LogNormalNumber pattern
    if (typeof value.mu === 'number' && typeof value.sigma2 === 'number') {
      return `LN(μ=${value.mu.toFixed(2)}, σ²=${value.sigma2.toFixed(2)})`
    }

    // Check for UniformNumber pattern
    if (typeof value.a === 'number' && typeof value.b === 'number') {
      return `U[${value.a.toFixed(2)}, ${value.b.toFixed(2)}]`
    }
    
    // Check for ConfidenceIntervalNumber pattern
    if (typeof value.lower === 'number' && typeof value.upper === 'number' && typeof value.confidenceLevel === 'number') {
      return `CI[${value.lower.toFixed(2)}, ${value.upper.toFixed(2)}]`
    }
  }

  // For regular values, convert to string
  return String(value)
}

export const FormulaBar: React.FC<FormulaBarProps> = ({ 
  selectedCell, 
  onFormulaSubmit 
}) => {
  const { hfInstance, submitFormula, liveEditingState } = useContext(SpreadsheetContext)
  const [formulaInput, setFormulaInput] = useState('')
  const [isEditing, setIsEditing] = useState(false)

  // Function to update the formula input based on the current selected cell
  const updateFormulaInput = React.useCallback(() => {
    if (!selectedCell || !hfInstance) {
      setFormulaInput('')
      return
    }

    const { row, col } = selectedCell
    
    // Check if this cell is currently being edited live
    if (liveEditingState && liveEditingState.row === row && liveEditingState.col === col) {
      setFormulaInput(liveEditingState.value)
      return
    }
    
    // Get the formula if it exists, otherwise get the value
    const formula = hfInstance.getCellFormula({ sheet: 0, row, col })
    const value = hfInstance.getCellValue({ sheet: 0, row, col })
    
    if (formula) {
      setFormulaInput(formula)
    } else if (value !== null && value !== undefined) {
      // Use our custom formatter for better distribution display
      setFormulaInput(formatCellValue(value))
    } else {
      setFormulaInput('')
    }
  }, [selectedCell, hfInstance, liveEditingState])

  // Update formula input when selected cell changes
  useEffect(() => {
    updateFormulaInput()
  }, [updateFormulaInput])

  // Listen for cell value changes and update formula bar if the selected cell content changed
  useEffect(() => {
    if (!hfInstance) return

    const handleValuesUpdated = () => {
      // Only update if we're not currently editing (to avoid overwriting user input)
      if (!isEditing) {
        updateFormulaInput()
      }
    }

    // Subscribe to HyperFormula value updates
    hfInstance.on('valuesUpdated', handleValuesUpdated)

    return () => {
      hfInstance.off('valuesUpdated', handleValuesUpdated)
    }
  }, [hfInstance, isEditing, updateFormulaInput])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormulaInput(e.target.value)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSubmit()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }

  const handleSubmit = () => {
    if (selectedCell) {
      // Use the context's submitFormula function
      submitFormula(selectedCell.row, selectedCell.col, formulaInput)
      
      // Also call the optional callback prop if provided
      if (onFormulaSubmit) {
        onFormulaSubmit(selectedCell.row, selectedCell.col, formulaInput)
      }
    }
    setIsEditing(false)
  }

  const handleCancel = () => {
    // Reset to original value
    updateFormulaInput()
    setIsEditing(false)
  }

  const handleFocus = () => {
    setIsEditing(true)
  }

  const handleBlur = () => {
    if (isEditing) {
      handleSubmit()
    }
  }

  const getCellReference = () => {
    if (!selectedCell) return ''
    const columnLetter = String.fromCharCode(65 + selectedCell.col)
    return `${columnLetter}${selectedCell.row + 1}`
  }

  return (
    <div style={formulaBarContainerStyle}>
      <div style={cellReferenceStyle}>
        {getCellReference()}
      </div>
      <div style={formulaInputContainerStyle}>
        <input
          type="text"
          value={formulaInput}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          style={formulaInputStyle}
          placeholder={selectedCell ? "Enter formula or value..." : "Select a cell"}
          disabled={!selectedCell}
        />
      </div>
      
    </div>
  )
}

const formulaBarContainerStyle = {
  display: 'flex',
  alignItems: 'center',
  backgroundColor: 'var(--bg-surface)',
  padding: '4px',
  marginBottom: '8px',
  boxShadow: '0 1px 3px var(--shadow)',
  gap: '8px',
  flexWrap: 'wrap' as const,
  width: '100%',
  boxSizing: 'border-box' as const,
}

const cellReferenceStyle = {
  minWidth: '20px',
  padding: '6px 10px',
  backgroundColor: 'var(--bg-header)',
  fontWeight: 'bold',
  fontSize: '12px',
  textAlign: 'center' as const,
  color: 'var(--text-secondary)',
  flex: '0 0 auto',
}

const formulaInputContainerStyle = {
  flex: 1,
  position: 'relative' as const,
  minWidth: '180px',
}

const formulaInputStyle = {
  width: '100%',
  padding: '6px 10px',
  border: '1px solid var(--border-color)',
  borderRadius: '4px',
  fontSize: '12px',
  fontFamily: 'monospace',
  backgroundColor: 'var(--bg-surface)',
  color: 'var(--text-primary)',
  outline: 'none',
  transition: 'border-color 0.2s ease',
} as const

