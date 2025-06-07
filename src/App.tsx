import React, { useState } from 'react'

import { FlowDiag } from './components/FlowDiag'
import { FormulaBar } from './components/FormulaBar'
import { Spreadsheet } from './components/Spreadsheet'
import { SpreadsheetProvider } from './SpreadsheetContext'
import { Toolbar } from './components/Toolbar'

const SpreadsheetWithWizard: React.FC = () => {
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>({ row: 0, col: 0 })
  const [useflowDiag, setUseFlowDiag] = useState<boolean>(false)
  const handleCellSelect = (row: number, col: number) => {
    setSelectedCell({ row, col })
  }

  return (
    <div style={{ padding: '20px', paddingTop: '30px' }}>
     
      <header style={{ marginBottom: '4px' }}>
          
        <Toolbar 
          useFlowDiag={useflowDiag} 
          onToggleFlowDiag={() => setUseFlowDiag(!useflowDiag)} 
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

      {useflowDiag ? (
        <FlowDiag/>
      ) : (
        <Spreadsheet rows={50} columns={26} onCellSelect={handleCellSelect} selectedCell={selectedCell} />
      )}
    </div>
  )
}

export const App: React.FC = () => (
  
    <SpreadsheetProvider>
      <SpreadsheetWithWizard />
    </SpreadsheetProvider>
  
)
