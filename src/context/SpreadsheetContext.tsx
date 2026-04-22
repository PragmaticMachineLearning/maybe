import React, { createContext, useCallback, useEffect, useState } from "react";

import {
  applyAssistantChangesToEngine,
  type AssistantCellChange,
} from "../assistant/proposals";
import {
  buildWorkbookSnapshot,
  type SelectedCell,
  type WorkbookSnapshot,
} from "../assistant/workbookSnapshot";
import { GaussFormulaEngine, type FormulaEngine } from "../lib/formulaEngine";

type CellContent = string | number | null;
type SheetData = CellContent[][];

const VISIBLE_SHEET_ROWS = 50;
const VISIBLE_SHEET_COLUMNS = 26;

interface SpreadsheetContextValue {
  formulaEngine: FormulaEngine | null;
  updateCell: (row: number, col: number, value: string) => void;
  getCellFormula: (row: number, col: number) => string | null;
  submitFormula: (row: number, col: number, formula: string) => void;
  getWorkbookSnapshot: (
    selectedCell: SelectedCell | null,
  ) => WorkbookSnapshot | null;
  applyAssistantChanges: (changes: AssistantCellChange[]) => void;
}

const SpreadsheetContext = createContext<SpreadsheetContextValue>({
  formulaEngine: null,
  updateCell: () => {},
  getCellFormula: () => null,
  submitFormula: () => {},
  getWorkbookSnapshot: () => null,
  applyAssistantChanges: () => {},
});

export const SpreadsheetProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [formulaEngine, setFormulaEngine] = useState<FormulaEngine | null>(
    null,
  );
  useEffect(() => {
    const config = {
      licenseKey: "gpl-v3",
      language: "enGB",
      useColumnIndex: true,
      sampleSize: 10000,
    };

    const engine = GaussFormulaEngine.buildEmpty(config);

    // Initialize sheet
    engine.addSheet("Sheet1");
    const initialData: SheetData = Array(VISIBLE_SHEET_ROWS)
      .fill(null)
      .map(() => Array(VISIBLE_SHEET_COLUMNS).fill(null));

    engine.setSheetContent(0, initialData);
    setFormulaEngine(engine);

    return () => {
      engine.destroy();
    };
  }, []);

  const updateCell = useCallback(
    (row: number, col: number, value: string) => {
      if (!formulaEngine) return;

      try {
        formulaEngine.setCellContents({ sheet: 0, row, col }, value);
      } catch (error) {
        console.error("Error updating cell:", error);
      }
    },
    [formulaEngine],
  );

  const getCellFormula = useCallback(
    (row: number, col: number) => {
      if (!formulaEngine) return null;
      try {
        const formula = formulaEngine.getCellFormula({ sheet: 0, row, col });
        return formula;
      } catch (error) {
        console.error("Error getting cell formula:", error);
        return null;
      }
    },
    [formulaEngine],
  );

  const submitFormula = useCallback(
    (row: number, col: number, formula: string) => {
      if (!formulaEngine) return;

      try {
        // If the formula starts with '=', treat it as a formula
        // Otherwise, treat it as a raw value
        const cellContent = formula.trim();

        formulaEngine.setCellContents({ sheet: 0, row, col }, cellContent);

        // Check for formula validation errors
        if (cellContent.startsWith("=")) {
          formulaEngine.validateFormula(cellContent);
        }
      } catch (error) {
        console.error("Error submitting formula:", error);
      }
    },
    [formulaEngine],
  );

  const getWorkbookSnapshot = useCallback(
    (selectedCell: SelectedCell | null) => {
      if (!formulaEngine) return null;

      const dimensions = formulaEngine.getSheetDimensions(0);
      const minimumDimensions = {
        width: VISIBLE_SHEET_COLUMNS,
        height: VISIBLE_SHEET_ROWS,
      };

      return buildWorkbookSnapshot({
        formulaEngine,
        selectedCell,
        maxCells:
          Math.max(dimensions.width, minimumDimensions.width) *
          Math.max(dimensions.height, minimumDimensions.height),
        minimumDimensions,
      });
    },
    [formulaEngine],
  );

  const applyAssistantChanges = useCallback(
    (changes: AssistantCellChange[]) => {
      if (!formulaEngine) return;

      const engineDimensions = formulaEngine.getSheetDimensions(0);
      const dimensions = {
        width: Math.max(engineDimensions.width, VISIBLE_SHEET_COLUMNS),
        height: Math.max(engineDimensions.height, VISIBLE_SHEET_ROWS),
      };
      applyAssistantChangesToEngine(formulaEngine, dimensions, changes);
    },
    [formulaEngine],
  );

  return (
    <SpreadsheetContext
      value={{
        formulaEngine,
        updateCell,
        getCellFormula,
        submitFormula,
        getWorkbookSnapshot,
        applyAssistantChanges,
      }}
    >
      {children}
    </SpreadsheetContext>
  );
};

export { SpreadsheetContext };
