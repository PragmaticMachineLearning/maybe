import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react'

import { FlowDiag } from './components/FlowDiag'
import { AnalysisPanel } from './components/AnalysisPanel'
import { FormulaBar } from './components/FormulaBar'
import { Spreadsheet } from './components/Spreadsheet'
import { SpreadsheetProvider } from './SpreadsheetContext'
import { Toolbar } from './components/Toolbar'
import { SpreadsheetContext } from './SpreadsheetContext'
import {
  getSamplesFromDistribution,
  isConfidenceIntervalValue,
  isSampledDistributionValue,
  parseConfidenceIntervalValue,
  type ParsedConfidenceInterval,
} from './utils/distributionUtils'

type DistributionType = 'normal' | 'lognormal' | 'uniform' | 'sampled'

interface AnalysisState {
  cellLabel: string
  samples: number[] | null
  distributionType: DistributionType
  confidenceInterval?: ParsedConfidenceInterval | null
  message?: string
}

const SpreadsheetWithWizard: React.FC = () => {
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>({ row: 0, col: 0 })
  const [useflowDiag, setUseFlowDiag] = useState<boolean>(false)
  const [analysisMode, setAnalysisMode] = useState<boolean>(false)
  const [analysisState, setAnalysisState] = useState<AnalysisState | null>(null)
  const [viewportWidth, setViewportWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1280
  )
  const { hfInstance, getDistributionView } = useContext(SpreadsheetContext)

  const handleCellSelect = (row: number, col: number) => {
    setSelectedCell({ row, col })
  }

  const columnName = useMemo(() => {
    const cache: Record<number, string> = {}
    const compute = (index: number): string => {
      if (cache[index]) return cache[index]
      let result = ''
      let num = index
      while (num >= 0) {
        result = String.fromCharCode((num % 26) + 65) + result
        num = Math.floor(num / 26) - 1
      }
      cache[index] = result
      return result
    }
    return compute
  }, [])

  const updateAnalysisState = useCallback(() => {
    if (!analysisMode || !hfInstance || !selectedCell) {
      setAnalysisState(null)
      return
    }

    const columnLabel = columnName(selectedCell.col)
    const cellLabel = `${columnLabel}${selectedCell.row + 1}`
    const value = hfInstance.getCellValue({ sheet: 0, row: selectedCell.row, col: selectedCell.col })

    const hasDistribution = isConfidenceIntervalValue(value) || isSampledDistributionValue(value)

    if (!hasDistribution) {
      setAnalysisState({
        cellLabel,
        samples: null,
        distributionType: 'normal',
        confidenceInterval: null,
        message: 'Select a cell containing uncertainty (CI[lower, upper] inputs or simulated outputs) to inspect its distribution.',
      })
      return
    }

    const confidenceInterval = parseConfidenceIntervalValue(value)
    const samples = getSamplesFromDistribution(value)

    const viewOverride = getDistributionView(selectedCell.row, selectedCell.col)

    let distributionType: DistributionType = 'normal'
    if (viewOverride) {
      distributionType = viewOverride
    } else if (confidenceInterval?.interpretation === 'lognormal') {
      distributionType = 'lognormal'
    } else if (confidenceInterval?.interpretation === 'uniform') {
      distributionType = 'uniform'
    } else if (!confidenceInterval && isSampledDistributionValue(value)) {
      distributionType = 'sampled'
    }

    if (!samples || samples.length === 0) {
      setAnalysisState({
        cellLabel,
        samples: null,
        distributionType,
        confidenceInterval,
        message: 'Unable to generate samples for this cell. Ensure the value exposes samples or a confidence interval.',
      })
      return
    }

    setAnalysisState({
      cellLabel,
      samples,
      distributionType,
      confidenceInterval,
    })
  }, [analysisMode, hfInstance, selectedCell, columnName, getDistributionView])

  useEffect(() => {
    updateAnalysisState()
  }, [updateAnalysisState])

  useEffect(() => {
    if (!hfInstance) {
      return
    }
    const handleValuesUpdated = () => {
      if (analysisMode) {
        updateAnalysisState()
      }
    }

    hfInstance.on('valuesUpdated', handleValuesUpdated)
    return () => {
      hfInstance.off('valuesUpdated', handleValuesUpdated)
    }
  }, [hfInstance, analysisMode, updateAnalysisState])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    const handleResize = () => {
      setViewportWidth(window.innerWidth)
    }
    window.addEventListener('resize', handleResize)
    handleResize()
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const isCompactLayout = viewportWidth < 1024

  const handleToggleFlowDiag = () => {
    setUseFlowDiag((prev) => {
      if (!prev) {
        setAnalysisMode(false)
        setAnalysisState(null)
      }
      return !prev
    })
  }

  // Handle ESC key to close flow diagram overlay
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && useflowDiag) {
        setUseFlowDiag(false)
      }
    }

    if (useflowDiag) {
      document.addEventListener('keydown', handleEscapeKey)
      return () => document.removeEventListener('keydown', handleEscapeKey)
    }
  }, [useflowDiag])

  const handleToggleAnalysisMode = () => {
    if (useflowDiag) {
      return
    }
    setAnalysisMode((prev) => !prev)
  }

  const handleCloseAnalysis = () => {
    setAnalysisMode(false)
    setAnalysisState(null)
  }

  return (
    <div style={{ padding: '20px', paddingTop: '30px', height: '100%', boxSizing: 'border-box' }}>
     
      <header style={{ marginBottom: '4px' }}>
          
        <Toolbar 
          useFlowDiag={useflowDiag} 
          onToggleFlowDiag={handleToggleFlowDiag}
          analysisMode={analysisMode && !useflowDiag}
          onToggleAnalysisMode={handleToggleAnalysisMode} 
        />
        
      </header>

      {!useflowDiag && (
        <FormulaBar 
          selectedCell={selectedCell}
          onFormulaSubmit={(row, col, formula) => {
            // This will be handled by the FormulaBar component itself via the SpreadsheetContext
            // We could add additional logic here if needed
            console.log(`Formula submitted for ${String.fromCharCode(65 + col)}${row + 1}: ${formula}`)
          }}
        />
      )}

      <div
        style={{
          display: 'flex',
          flexDirection: isCompactLayout ? 'column' : 'row',
          gap: isCompactLayout ? '12px' : '16px',
          alignItems: 'stretch',
          minHeight: '0',
          position: 'relative',
        }}
      >
        <div style={{ flex: '1 1 auto', minWidth: 0, order: 1 }}>
          <Spreadsheet rows={50} columns={26} onCellSelect={handleCellSelect} selectedCell={selectedCell} onOpenAnalysis={handleToggleAnalysisMode} />
        </div>
        {analysisMode && !useflowDiag && analysisState && (
          <div style={{ flex: isCompactLayout ? '1 1 auto' : '0 0 auto', order: isCompactLayout ? 2 : 0 }}>
            <AnalysisPanel
              cellLabel={analysisState.cellLabel}
              samples={analysisState.samples}
              distributionType={analysisState.distributionType}
              confidenceInterval={analysisState.confidenceInterval}
              message={analysisState.message}
              onClose={handleCloseAnalysis}
              compact={isCompactLayout}
            />
          </div>
        )}
        
        {/* Flow Diagram Overlay */}
        {useflowDiag && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
            }}
            onClick={(e) => {
              // Close overlay when clicking on backdrop
              if (e.target === e.currentTarget) {
                setUseFlowDiag(false)
              }
            }}
          >
            <div
              style={{
                width: '90vw',
                height: '80vh',
                maxWidth: '1200px',
                maxHeight: '800px',
                backgroundColor: 'var(--bg-surface)',
                borderRadius: '12px',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
                border: '1px solid var(--border-color)',
                overflow: 'hidden',
                position: 'relative',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={() => setUseFlowDiag(false)}
                style={{
                  position: 'absolute',
                  top: '16px',
                  right: '16px',
                  background: 'var(--bg-hover)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  width: '32px',
                  height: '32px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-secondary)',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  zIndex: 1001,
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-surface)'
                  e.currentTarget.style.color = 'var(--text-primary)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-hover)'
                  e.currentTarget.style.color = 'var(--text-secondary)'
                }}
                title="Close Flow Diagram"
              >
                ×
              </button>
              
              {/* Flow diagram content */}
              <FlowDiag />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export const App: React.FC = () => (
  
    <SpreadsheetProvider>
      <SpreadsheetWithWizard />
    </SpreadsheetProvider>
  
)
