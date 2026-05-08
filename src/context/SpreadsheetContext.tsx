import React, { createContext, useCallback, useEffect, useState } from "react";

import {
  applyAssistantChangesToEngine,
  type AssistantCellChange,
} from "../assistant/proposals";
import {
  buildWorkbookSnapshot,
  type SelectedCell,
} from "../assistant/workbookSnapshot";
import { maybeFormulaEngineConfig } from "../config/simulation";
import { GaussFormulaEngine, type FormulaEngine } from "../lib/formulaEngine";
import type { WorkbookSnapshot } from "../schemas/workbook";
import {
  createBlankSheetContent,
  getSerializedContentFromWorkbookResponse,
  type SerializedWorkbookContent,
} from "../workbook/persistence";

type SheetData = SerializedWorkbookContent;

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
    let isDisposed = false;
    const engine = GaussFormulaEngine.buildEmpty(maybeFormulaEngineConfig);

    engine.addSheet("Sheet1");

    const loadWorkbook = async () => {
      let sheetContent: SheetData = createBlankSheetContent({
        rows: VISIBLE_SHEET_ROWS,
        columns: VISIBLE_SHEET_COLUMNS,
      });

      try {
        const response = await fetch("/api/workbook");
        if (response.ok) {
          const savedContent = getSerializedContentFromWorkbookResponse(
            await response.json(),
          );

          if (savedContent !== null) {
            sheetContent = savedContent;
          }
        }
      } catch (error) {
        console.error("Error loading persisted workbook:", error);
      }

      if (isDisposed) {
        return;
      }

      engine.setSheetContent(0, sheetContent);
      setFormulaEngine(engine);
    };

    void loadWorkbook();

    return () => {
      isDisposed = true;
      engine.destroy();
    };
  }, []);

  useEffect(() => {
    if (!formulaEngine) return;

    let saveTimeout: ReturnType<typeof setTimeout> | null = null;

    const saveWorkbook = async () => {
      const dimensions = formulaEngine.getSheetDimensions(0);
      const minimumDimensions = {
        width: VISIBLE_SHEET_COLUMNS,
        height: VISIBLE_SHEET_ROWS,
      };
      const workbookSnapshot = buildWorkbookSnapshot({
        formulaEngine,
        selectedCell: null,
        maxCells:
          Math.max(dimensions.width, minimumDimensions.width) *
          Math.max(dimensions.height, minimumDimensions.height),
        minimumDimensions,
      });

      try {
        await fetch("/api/workbook", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            serializedContent: workbookSnapshot.serializedContent,
          }),
        });
      } catch (error) {
        console.error("Error saving persisted workbook:", error);
      }
    };

    const scheduleSave = () => {
      if (saveTimeout !== null) {
        clearTimeout(saveTimeout);
      }

      saveTimeout = setTimeout(() => {
        void saveWorkbook();
      }, 1000);
    };

    formulaEngine.on("valuesUpdated", scheduleSave);

    return () => {
      if (saveTimeout !== null) {
        clearTimeout(saveTimeout);
      }
      formulaEngine.off("valuesUpdated", scheduleSave);
    };
  }, [formulaEngine]);

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
        return formula ?? null;
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
