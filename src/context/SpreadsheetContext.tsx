import React, { createContext, useCallback, useEffect, useState } from "react";

import { GaussFormulaEngine, type FormulaEngine } from "../lib/formulaEngine";
import {
  canUseLognormalInterpretation,
  parseConfidenceIntervalValue,
  type DistributionViewType,
} from "../utils/distribution/distributionUtils";

type CellContent = string | number | null;
type SheetData = CellContent[][];

export type { DistributionViewType };

interface SpreadsheetContextValue {
  formulaEngine: FormulaEngine | null;
  updateCell: (row: number, col: number, value: string) => void;
  getCellFormula: (row: number, col: number) => string | null;
  submitFormula: (row: number, col: number, formula: string) => void;
  getDistributionView: (
    row: number,
    col: number,
  ) => DistributionViewType | null;
  setDistributionView: (
    row: number,
    col: number,
    view: DistributionViewType,
  ) => void;
  clearDistributionView: (row: number, col: number) => void;
}

const SpreadsheetContext = createContext<SpreadsheetContextValue>({
  formulaEngine: null,
  updateCell: () => {},
  getCellFormula: () => null,
  submitFormula: () => {},
  getDistributionView: () => null,
  setDistributionView: () => {},
  clearDistributionView: () => {},
});

export const SpreadsheetProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [formulaEngine, setFormulaEngine] = useState<FormulaEngine | null>(
    null,
  );
  const [distributionViews, setDistributionViews] = useState<
    Record<string, DistributionViewType>
  >({});

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
    const initialRows = 50;
    const initialCols = 26;
    const initialData: SheetData = Array(initialRows)
      .fill(null)
      .map(() => Array(initialCols).fill(null));

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

  const getDistributionView = useCallback(
    (row: number, col: number) => {
      const key = `${row}:${col}`;
      return distributionViews[key] ?? null;
    },
    [distributionViews],
  );

  const setDistributionView = useCallback(
    (row: number, col: number, view: DistributionViewType) => {
      const key = `${row}:${col}`;
      let appliedView = view;

      if (formulaEngine) {
        const address = { sheet: 0, row, col };
        const formula = formulaEngine.getCellFormula(address);
        const value = formulaEngine.getCellValue(address);
        const confidenceInterval = parseConfidenceIntervalValue(value);

        if (!formula && confidenceInterval) {
          appliedView =
            view === "lognormal" &&
            !canUseLognormalInterpretation(confidenceInterval)
              ? "normal"
              : view;
          formulaEngine.setCellContents(
            address,
            new GaussFormulaEngine.ConfidenceIntervalNumber(
              confidenceInterval.lower,
              confidenceInterval.upper,
              confidenceInterval.confidenceLevel,
              { interpretation: appliedView },
            ),
          );
        }
      }

      setDistributionViews((prev) => {
        if (prev[key] === appliedView) {
          return prev;
        }
        return { ...prev, [key]: appliedView };
      });
    },
    [formulaEngine],
  );

  const clearDistributionView = useCallback((row: number, col: number) => {
    const key = `${row}:${col}`;
    setDistributionViews((prev) => {
      if (!(key in prev)) {
        return prev;
      }
      const nextViews = { ...prev };
      delete nextViews[key];
      return nextViews;
    });
  }, []);

  return (
    <SpreadsheetContext
      value={{
        formulaEngine,
        updateCell,
        getCellFormula,
        submitFormula,
        getDistributionView,
        setDistributionView,
        clearDistributionView,
      }}
    >
      {children}
    </SpreadsheetContext>
  );
};

export { SpreadsheetContext };
