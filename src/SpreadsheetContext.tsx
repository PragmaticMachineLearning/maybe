import React, { createContext, useEffect, useState, useCallback } from 'react'
import HyperFormula from 'hyperformula'
import { DistributionFunctionsPlugin, DistributionFunctionsTranslations } from './hfExtensions/customFunctions'

type CellContent = string | number | null;
type SheetData = CellContent[][];

interface LiveEditingState {
  row: number;
  col: number;
  value: string;
}

interface SpreadsheetContextValue {
  hfInstance: HyperFormula | null;
  updateCell: (row: number, col: number, value: string) => void;
  getCellFormula: (row: number, col: number) => string|null;
  submitFormula: (row: number, col: number, formula: string) => void;
  liveEditingState: LiveEditingState | null;
  setLiveEditingState: (state: LiveEditingState | null) => void;
}

const SpreadsheetContext = createContext<SpreadsheetContextValue>({
  hfInstance: null,
  updateCell: () => {},
  getCellFormula: () => null,
  submitFormula: () => {},
  liveEditingState: null,
  setLiveEditingState: () => {},
})

export const SpreadsheetProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [hfInstance, setHfInstance] = useState<HyperFormula | null>(null)
  const [liveEditingState, setLiveEditingState] = useState<LiveEditingState | null>(null)

  useEffect(() => {
    // Register our custom functions plugin before creating instance
    console.log('Registering DistributionFunctionsPlugin...')
    HyperFormula.registerFunctionPlugin(DistributionFunctionsPlugin, DistributionFunctionsTranslations)
    
    const config = {
      licenseKey: 'gpl-v3',
      language: 'enGB'
    }

    // Build an empty instance
    const instance = HyperFormula.buildEmpty(config)
    console.log('Available functions in instance:', instance.getRegisteredFunctionNames())

    // Initialize sheet
    instance.addSheet('Sheet1')
    const initialRows = 50
    const initialCols = 26
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

  const getCellFormula = useCallback((row: number, col: number) => {
    if (!hfInstance) return null
    try {
      const formula = hfInstance.getCellFormula({ sheet: 0, row, col })
      console.log('Cell formula:', formula)
      return formula
    } catch (error) {
      console.error('Error getting cell formula:', error)
      return null
    }
  }, [hfInstance])

  const submitFormula = useCallback((row: number, col: number, formula: string) => {
    if (!hfInstance) return

    try {
      console.log(`Submitting formula to cell (${row}, ${col}): ${formula}`)
      
      // If the formula starts with '=', treat it as a formula
      // Otherwise, treat it as a raw value
      const cellContent = formula.trim()
      
      hfInstance.setCellContents({ sheet: 0, row, col }, cellContent)
      
      const resultValue = hfInstance.getCellValue({ sheet: 0, row, col })
      const resultFormula = hfInstance.getCellFormula({ sheet: 0, row, col })
      
      console.log('Formula submitted successfully')
      console.log('Result value:', resultValue)
      console.log('Result formula:', resultFormula)
      
      // Check for formula validation errors
      if (cellContent.startsWith('=')) {
        const validation = hfInstance.validateFormula(cellContent)
        if (!validation.isValid) {
          console.warn('Formula validation warning:', validation)
        }
      }
      
    } catch (error) {
      console.error('Error submitting formula:', error)
    }
  }, [hfInstance])

  return (
    <SpreadsheetContext.Provider value={{ 
      hfInstance, 
      updateCell, 
      getCellFormula, 
      submitFormula, 
      liveEditingState, 
      setLiveEditingState 
    }}>
      {children}
    </SpreadsheetContext.Provider>
  )
}

export { SpreadsheetContext }