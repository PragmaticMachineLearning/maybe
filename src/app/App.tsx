import React, { useCallback, useContext, useEffect, useState } from 'react'

import { SpreadsheetContext, SpreadsheetProvider } from '../context/SpreadsheetContext'
import { AppLayout } from './AppLayout'
import {
  deriveAnalysisState,
  type AnalysisState,
  type SelectedCell,
} from './analysisState'

const SpreadsheetWithWizard: React.FC = () => {
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>({ row: 0, col: 0 })
  const [useflowDiag, setUseFlowDiag] = useState<boolean>(false)
  const [insightsOpen, setInsightsOpen] = useState(false)
  const [aiPanelOpen, setAiPanelOpen] = useState(false)
  const [analysisState, setAnalysisState] = useState<AnalysisState | null>(null)
  const [viewportWidth, setViewportWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1280
  )
  const { formulaEngine, getDistributionView } = useContext(SpreadsheetContext)

  const handleCellSelect = (row: number, col: number) => {
    setSelectedCell({ row, col })
  }

  const updateAnalysisState = useCallback(() => {
    setAnalysisState(
      deriveAnalysisState({
        analysisMode: insightsOpen,
        formulaEngine,
        selectedCell,
        getDistributionView,
      }),
    )
  }, [insightsOpen, formulaEngine, selectedCell, getDistributionView])

  useEffect(() => {
    updateAnalysisState()
  }, [updateAnalysisState])

  useEffect(() => {
    if (!formulaEngine) {
      return
    }
    const handleValuesUpdated = () => {
      if (insightsOpen) {
        updateAnalysisState()
      }
    }

    formulaEngine.on('valuesUpdated', handleValuesUpdated)
    return () => {
      formulaEngine.off('valuesUpdated', handleValuesUpdated)
    }
  }, [formulaEngine, insightsOpen, updateAnalysisState])

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
        setInsightsOpen(false)
        setAiPanelOpen(false)
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

  const handleToggleInsights = () => {
    if (useflowDiag) {
      return
    }
    setInsightsOpen((isOpen) => !isOpen)
  }

  const handleCloseInsights = () => {
    setInsightsOpen(false)
    setAnalysisState(null)
  }

  const handleToggleAiPanel = () => {
    if (useflowDiag) {
      return
    }
    setAiPanelOpen((isOpen) => !isOpen)
  }

  const handleCloseAiPanel = () => {
    setAiPanelOpen(false)
  }

  const handleFormulaSubmit = (row: number, col: number, formula: string) => {
    console.log(`Formula submitted for ${String.fromCharCode(65 + col)}${row + 1}: ${formula}`)
  }

  return (
    <AppLayout
      selectedCell={selectedCell}
      useFlowDiag={useflowDiag}
      insightsOpen={insightsOpen}
      aiPanelOpen={aiPanelOpen}
      analysisState={analysisState}
      isCompactLayout={isCompactLayout}
      onCellSelect={handleCellSelect}
      onToggleFlowDiag={handleToggleFlowDiag}
      onToggleInsights={handleToggleInsights}
      onToggleAiPanel={handleToggleAiPanel}
      onCloseInsights={handleCloseInsights}
      onCloseAiPanel={handleCloseAiPanel}
      onCloseFlowDiag={() => setUseFlowDiag(false)}
      onFormulaSubmit={handleFormulaSubmit}
    />
  )
}

export const App: React.FC = () => (
  <SpreadsheetProvider>
    <SpreadsheetWithWizard />
  </SpreadsheetProvider>
)
