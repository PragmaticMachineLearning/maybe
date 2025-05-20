import React, { useState } from 'react'

import { FlowDiag } from './components/FlowDiag'
import { Spreadsheet } from './components/Spreadsheet'
import { SpreadsheetProvider } from './SpreadsheetContext'

const SpreadsheetWithWizard: React.FC = () => {
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null)
  const [useflowDiag, setUseFlowDiag] = useState<boolean>(false)
  const handleCellSelect = (row: number, col: number) => {
    setSelectedCell({ row, col })
  }

  return (
    <div style={{ padding: '20px' }}>
      <button onClick={() => setUseFlowDiag(!useflowDiag)}>Toggle flow diagram </button>
      <header style={{ marginBottom: '20px' }}>
        <h1 style={{ margin: 0 }}>Probability Distribution Spreadsheet</h1>
        {selectedCell && (
          <span style={{ color: '#666', fontSize: '14px', marginTop: '8px', display: 'block' }}>
            Selected: {String.fromCharCode(65 + selectedCell.col)}{selectedCell.row + 1}
          </span>
        )}
      </header>

      {useflowDiag ? (
        <FlowDiag/>
      ) : (
        <Spreadsheet rows={20} columns={10} onCellSelect={handleCellSelect} selectedCell={selectedCell} />
      )}
    </div>
  )
}

export const App: React.FC = () => (
  <SpreadsheetProvider>
    <SpreadsheetWithWizard />
  </SpreadsheetProvider>
)
