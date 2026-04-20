import React from 'react'

import { AnalysisPanel } from '../components/analysis/AnalysisPanel'
import { FlowDiag } from '../components/flow-diagram/FlowDiag'
import { FormulaBar } from '../components/formula-bar/FormulaBar'
import { Spreadsheet } from '../components/spreadsheet/Spreadsheet'
import { Toolbar } from '../components/toolbar/Toolbar'
import type { AnalysisState, SelectedCell } from './analysisState'

interface AppLayoutProps {
  selectedCell: SelectedCell | null
  useFlowDiag: boolean
  analysisMode: boolean
  analysisState: AnalysisState | null
  isCompactLayout: boolean
  onCellSelect: (row: number, col: number) => void
  onToggleFlowDiag: () => void
  onToggleAnalysisMode: () => void
  onCloseAnalysis: () => void
  onCloseFlowDiag: () => void
  onFormulaSubmit: (row: number, col: number, formula: string) => void
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  selectedCell,
  useFlowDiag,
  analysisMode,
  analysisState,
  isCompactLayout,
  onCellSelect,
  onToggleFlowDiag,
  onToggleAnalysisMode,
  onCloseAnalysis,
  onCloseFlowDiag,
  onFormulaSubmit,
}) => (
  <div
    style={{
      padding: '20px',
      paddingTop: '30px',
      height: '100%',
      boxSizing: 'border-box',
    }}
  >
    <header style={{ marginBottom: '4px' }}>
      <Toolbar
        useFlowDiag={useFlowDiag}
        onToggleFlowDiag={onToggleFlowDiag}
        analysisMode={analysisMode && !useFlowDiag}
        onToggleAnalysisMode={onToggleAnalysisMode}
      />
    </header>

    {!useFlowDiag && (
      <FormulaBar
        selectedCell={selectedCell}
        onFormulaSubmit={onFormulaSubmit}
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
        <Spreadsheet
          rows={50}
          columns={26}
          onCellSelect={onCellSelect}
          selectedCell={selectedCell}
          onOpenAnalysis={onToggleAnalysisMode}
        />
      </div>

      {analysisMode && !useFlowDiag && analysisState && (
        <div
          style={{
            flex: isCompactLayout ? '1 1 auto' : '0 0 auto',
            order: 2,
          }}
        >
          <AnalysisPanel
            cellLabel={analysisState.cellLabel}
            samples={analysisState.samples}
            distributionType={analysisState.distributionType}
            confidenceInterval={analysisState.confidenceInterval}
            message={analysisState.message}
            onClose={onCloseAnalysis}
            compact={isCompactLayout}
          />
        </div>
      )}

      {useFlowDiag && (
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
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              onCloseFlowDiag()
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
            onClick={(event) => event.stopPropagation()}
          >
            <button
              onClick={onCloseFlowDiag}
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
              onMouseEnter={(event) => {
                event.currentTarget.style.backgroundColor = 'var(--bg-surface)'
                event.currentTarget.style.color = 'var(--text-primary)'
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.backgroundColor = 'var(--bg-hover)'
                event.currentTarget.style.color = 'var(--text-secondary)'
              }}
              title="Close Flow Diagram"
            >
              ×
            </button>
            <FlowDiag />
          </div>
        </div>
      )}
    </div>
  </div>
)
