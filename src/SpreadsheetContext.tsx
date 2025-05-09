import React, { createContext, useCallback, useEffect, useState } from 'react'

// Import from the workspace package
import HyperFormula from 'hyperformula'

type CellContent = string | number | null;
type SheetData = CellContent[][];

interface SpreadsheetContextValue {
  hfInstance: HyperFormula | null;
  updateCell: (row: number, col: number, value: string) => void;
}

const SpreadsheetContext = createContext<SpreadsheetContextValue>({
  hfInstance: null,
  updateCell: () => {},
})

export const SpreadsheetProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [hfInstance, setHfInstance] = useState<HyperFormula | null>(null)

  useEffect(() => {
    const config = {
      licenseKey: 'gpl-v3',
      language: 'enGB',
      useColumnIndex: true,
      sampleSize: 50000,
      
    }

    // Build an empty instance
    const instance = HyperFormula.buildEmpty(config)
    

    // Initialize sheet
    instance.addSheet('Sheet1')
    const initialRows = 20
    const initialCols = 10
    const initialData: SheetData = Array(initialRows).fill(null)
      .map(() => Array(initialCols).fill(null))
    
    instance.setSheetContent(0, initialData)
    setHfInstance(instance)

    return () => {
      instance.destroy()
    }
  }, [])

  const updateCell = useCallback((row: number, col: number, value: string) => {
    if (!hfInstance) return

    try {
      console.log(`Updating cell (${row}, ${col}) with value: ${value}`)
      hfInstance.setCellContents({ sheet: 0, row, col }, value)
      console.log('Cell value after update:', hfInstance.getCellValue({ sheet: 0, row, col }))
      console.log('Cell formula after update:', hfInstance.getCellFormula({ sheet: 0, row, col }))
      if (value.startsWith('=')) {
        console.log('Parse result:', hfInstance.validateFormula(value))
      }
    } catch (error) {
      console.error('Error updating cell:', error)
    }
  }, [hfInstance])

  return (
    <SpreadsheetContext.Provider value={{ hfInstance, updateCell }}>
      {children}
    </SpreadsheetContext.Provider>
  )
}

export { SpreadsheetContext }